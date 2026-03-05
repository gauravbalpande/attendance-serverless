"""
Generate presigned S3 URL for uploading attendance or enrollment images.
"""
import json
import os
import uuid
from datetime import timedelta

import boto3

s3 = boto3.client('s3')
BUCKET_NAME = os.environ.get('BUCKET_NAME')


def handler(event, context):
    """
    POST body: { "type": "attendance" | "enrollment", "fileName": "optional" }
    Returns: { "uploadUrl": "...", "key": "...", "expiresIn": 3600 }
    """
    try:
        body = json.loads(event.get('body', '{}'))
        upload_type = body.get('type', 'attendance')
        file_name = body.get('fileName') or f'{uuid.uuid4()}.jpg'

        if upload_type == 'enrollment':
            prefix = 'uploads/enrollment/'
        else:
            prefix = 'uploads/attendance/'

        key = f'{prefix}{file_name}'
        expires_in = 3600  # 1 hour

        upload_url = s3.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': key,
                'ContentType': 'image/jpeg',
            },
            ExpiresIn=expires_in,
        )

        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'uploadUrl': upload_url,
                'key': key,
                'bucket': BUCKET_NAME,
                'expiresIn': expires_in,
            }),
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
        }
