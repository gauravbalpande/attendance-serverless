"""
Enroll employee: Index face in Rekognition collection and store in DynamoDB.
Expects S3 key in body: { "key": "uploads/enrollment/xxx.jpg", "employeeId": "E001", "name": "...", "email": "...", "department": "..." }
"""
import json
import os

import boto3
from botocore.exceptions import ClientError

rekognition = boto3.client('rekognition')
dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')

COLLECTION_ID = os.environ.get('COLLECTION_ID', 'attendance-faces')
EMPLOYEES_TABLE = os.environ.get('EMPLOYEES_TABLE')
BUCKET_NAME = os.environ.get('BUCKET_NAME')


def _ensure_collection_exists():
    """Create Rekognition collection if it doesn't exist."""
    try:
        rekognition.describe_collection(CollectionId=COLLECTION_ID)
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            rekognition.create_collection(CollectionId=COLLECTION_ID)


def handler(event, context):
    """
    POST body: {
      "key": "uploads/enrollment/xxx.jpg",
      "employeeId": "E001",
      "name": "John Doe",
      "email": "john@example.com",
      "department": "Engineering"
    }
    """
    try:
        body = json.loads(event.get('body', '{}'))
        key = body.get('key')
        employee_id = body.get('employeeId')
        name = body.get('name', '')
        email = body.get('email', '')
        department = body.get('department', '')

        if not key or not employee_id:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Missing key or employeeId'}),
            }

        bucket = body.get('bucket') or BUCKET_NAME
        _ensure_collection_exists()

        response = rekognition.index_faces(
            CollectionId=COLLECTION_ID,
            Image={'S3Object': {'Bucket': bucket, 'Name': key}},
            ExternalImageId=employee_id,
            DetectionAttributes=['DEFAULT'],
        )

        face_records = response.get('FaceRecords', [])
        if not face_records:
            unindexed = response.get('UnindexedFaces', [])
            reason = unindexed[0].get('Reasons', ['No face detected'])[0] if unindexed else 'No face detected'
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': f'No face detected in image: {reason}'}),
            }

        face = face_records[0]['Face']
        face_id = face['FaceId']

        table = dynamodb.Table(EMPLOYEES_TABLE)
        table.put_item(
            Item={
                'employeeId': employee_id,
                'faceId': face_id,
                'name': name,
                'email': email,
                'department': department,
                'imageS3Key': key,
            }
        )

        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'employeeId': employee_id,
                'faceId': face_id,
                'message': 'Employee enrolled successfully',
            }),
        }
    except ClientError as e:
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e.response['Error']['Message'])}),
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
        }
