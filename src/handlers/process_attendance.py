"""
Process attendance: Detect face, match against Rekognition collection, log to DynamoDB.
Invoked by S3 trigger (new object in uploads/attendance/) or API Gateway POST.
"""
import json
import os
from datetime import datetime
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError

rekognition = boto3.client('rekognition')
dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')

COLLECTION_ID = os.environ.get('COLLECTION_ID', 'attendance-faces')
ATTENDANCE_TABLE = os.environ.get('ATTENDANCE_TABLE')
EMPLOYEES_TABLE = os.environ.get('EMPLOYEES_TABLE')
BUCKET_NAME = os.environ.get('BUCKET_NAME')
SIMILARITY_THRESHOLD = 90.0


def _ensure_collection_exists():
    """Create Rekognition collection if it doesn't exist."""
    try:
        rekognition.describe_collection(CollectionId=COLLECTION_ID)
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            rekognition.create_collection(CollectionId=COLLECTION_ID)


def _get_employee(employee_id: str) -> dict | None:
    """Fetch employee details from DynamoDB."""
    table = dynamodb.Table(EMPLOYEES_TABLE)
    try:
        resp = table.get_item(Key={'employeeId': employee_id})
        return resp.get('Item')
    except ClientError:
        return None


def _record_attendance(employee_id: str, confidence: float, source: str = 'webcam') -> dict:
    """Save attendance record to DynamoDB."""
    table = dynamodb.Table(ATTENDANCE_TABLE)
    now = datetime.utcnow()
    check_in_date = now.strftime('%Y-%m-%d')
    timestamp = now.isoformat() + 'Z'

    # Check for duplicate (one check-in per day)
    try:
        existing = table.get_item(
            Key={'employeeId': employee_id, 'checkInDate': check_in_date}
        )
        if existing.get('Item'):
            return {
                'status': 'already_recorded',
                'timestamp': existing['Item'].get('timestamp'),
                'message': 'Attendance already recorded for today',
            }
    except ClientError:
        pass

    item = {
        'employeeId': employee_id,
        'checkInDate': check_in_date,
        'timestamp': timestamp,
        'confidence': Decimal(str(confidence)),
        'source': source,
    }
    table.put_item(Item=item)
    return {'status': 'success', 'timestamp': timestamp}


def _process_image(bucket: str, key: str) -> dict:
    """Search for face in image against Rekognition collection."""
    _ensure_collection_exists()
    response = rekognition.search_faces_by_image(
        CollectionId=COLLECTION_ID,
        Image={'S3Object': {'Bucket': bucket, 'Name': key}},
        MaxFaces=1,
        FaceMatchThreshold=SIMILARITY_THRESHOLD,
    )
    matches = response.get('FaceMatches', [])
    if not matches:
        return {'matched': False, 'message': 'No matching face found'}
    match = matches[0]
    face = match['Face']
    similarity = match['Similarity']
    external_id = face.get('ExternalImageId') or face.get('FaceId')
    return {
        'matched': True,
        'employeeId': external_id,
        'confidence': similarity,
        'faceId': face['FaceId'],
    }


def _handle_s3_event(event: dict) -> dict:
    """Process S3 bucket event (new object uploaded)."""
    for record in event.get('Records', []):
        bucket = record['s3']['bucket']['name']
        key = record['s3']['object']['key']
        result = _process_image(bucket, key)
        if result.get('matched'):
            emp_id = result['employeeId']
            emp = _get_employee(emp_id)
            if not emp:
                emp_id = result.get('faceId', emp_id)
            record_result = _record_attendance(emp_id, result['confidence'], source='upload')
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'recognized': True,
                    'employeeId': emp_id,
                    'attendance': record_result,
                    'employee': emp,
                }, default=str),
            }
        return {
            'statusCode': 200,
            'body': json.dumps({
                'recognized': False,
                'message': result.get('message', 'Face not recognized'),
            }),
        }
    return {'statusCode': 400, 'body': json.dumps({'error': 'No records'})}


def _handle_api_event(event: dict) -> dict:
    """Process API Gateway event (POST body with S3 key or base64 image)."""
    try:
        body = json.loads(event.get('body', '{}'))
        bucket = body.get('bucket') or BUCKET_NAME
        key = body.get('key')

        if not key:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Missing s3 key or image data'}),
            }

        result = _process_image(bucket, key)
        if not result.get('matched'):
            return {
                'statusCode': 200,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'recognized': False,
                    'message': result.get('message', 'Face not recognized'),
                }),
            }

        emp_id = result['employeeId']
        emp = _get_employee(emp_id)
        if not emp:
            emp_id = result.get('faceId', emp_id)
        record_result = _record_attendance(emp_id, result['confidence'], source='api')

        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'recognized': True,
                'employeeId': emp_id,
                'employee': emp,
                'attendance': record_result,
                'confidence': result['confidence'],
            }, default=str),
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
        }


def handler(event, context):
    """Route to S3 or API handler."""
    if 'Records' in event and event['Records'] and 's3' in event['Records'][0]:
        return _handle_s3_event(event)
    return _handle_api_event(event)
