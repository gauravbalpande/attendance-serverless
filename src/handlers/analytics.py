"""
Generate attendance analytics: daily and weekly summaries.
GET /analytics?period=daily&date=2025-02-28
GET /analytics?period=weekly&startDate=2025-02-24
"""
import json
import os
from datetime import datetime, timedelta

import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb')
ATTENDANCE_TABLE = os.environ.get('ATTENDANCE_TABLE')


def handler(event, context):
    """Return attendance analytics based on query params."""
    try:
        params = event.get('queryStringParameters') or {}
        period = params.get('period', 'daily')
        date_str = params.get('date')
        start_date_str = params.get('startDate')

        table = dynamodb.Table(ATTENDANCE_TABLE)

        if period == 'daily':
            if not date_str:
                date_str = datetime.utcnow().strftime('%Y-%m-%d')
            # Query by checkInDate
            resp = table.query(
                IndexName='date-timestamp-index',
                KeyConditionExpression=Key('checkInDate').eq(date_str),
            )
            items = resp.get('Items', [])
            unique_employees = set(item['employeeId'] for item in items)
            return {
                'statusCode': 200,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'date': date_str,
                    'totalCheckIns': len(items),
                    'uniqueEmployees': len(unique_employees),
                    'employees': list(unique_employees),
                }, default=str),
            }

        elif period == 'weekly':
            if not start_date_str:
                start_date_str = (datetime.utcnow() - timedelta(days=6)).strftime('%Y-%m-%d')
            start = datetime.strptime(start_date_str, '%Y-%m-%d')
            daily_summary = {}
            total_unique = set()
            for i in range(7):
                d = (start + timedelta(days=i)).strftime('%Y-%m-%d')
                resp = table.query(
                    IndexName='date-timestamp-index',
                    KeyConditionExpression=Key('checkInDate').eq(d),
                )
                items = resp.get('Items', [])
                employees = set(item['employeeId'] for item in items)
                daily_summary[d] = {'count': len(items), 'employees': list(employees)}
                total_unique.update(employees)
            return {
                'statusCode': 200,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'period': 'weekly',
                    'startDate': start_date_str,
                    'dailySummary': daily_summary,
                    'totalUniqueEmployees': len(total_unique),
                }, default=str),
            }

        else:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Invalid period. Use daily or weekly'}),
            }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
        }
