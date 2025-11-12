'''
Business: API для управления событиями (создание, чтение, обновление, удаление)
Args: event - dict с httpMethod, body, queryStringParameters
      context - object с attributes: request_id, function_name
Returns: HTTP response dict с событиями или статусом операции
'''

import json
import os
from typing import Dict, Any, List, Optional
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

def get_db_connection():
    database_url = os.environ.get('DATABASE_URL')
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    try:
        if method == 'GET':
            return get_events()
        elif method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            return create_event(body_data)
        elif method == 'PUT':
            body_data = json.loads(event.get('body', '{}'))
            return update_event(body_data)
        elif method == 'DELETE':
            params = event.get('queryStringParameters', {})
            event_id = params.get('id')
            return delete_event(event_id)
        else:
            return {
                'statusCode': 405,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Method not allowed'}),
                'isBase64Encoded': False
            }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }

def get_events() -> Dict[str, Any]:
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute('''
        SELECT id, title, event_date, event_type, description, notification_enabled, created_at
        FROM events
        ORDER BY event_date ASC
    ''')
    
    events = cur.fetchall()
    cur.close()
    conn.close()
    
    events_list = []
    for event in events:
        events_list.append({
            'id': str(event['id']),
            'title': event['title'],
            'date': event['event_date'].isoformat(),
            'type': event['event_type'],
            'description': event['description'],
            'notificationEnabled': event['notification_enabled']
        })
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'events': events_list}),
        'isBase64Encoded': False
    }

def create_event(data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute('''
        INSERT INTO events (title, event_date, event_type, description, notification_enabled)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id, title, event_date, event_type, description, notification_enabled
    ''', (
        data.get('title'),
        data.get('date'),
        data.get('type'),
        data.get('description'),
        data.get('notificationEnabled', True)
    ))
    
    conn.commit()
    new_event = cur.fetchone()
    cur.close()
    conn.close()
    
    return {
        'statusCode': 201,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({
            'id': str(new_event['id']),
            'title': new_event['title'],
            'date': new_event['event_date'].isoformat(),
            'type': new_event['event_type'],
            'description': new_event['description'],
            'notificationEnabled': new_event['notification_enabled']
        }),
        'isBase64Encoded': False
    }

def update_event(data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute('''
        UPDATE events
        SET title = %s, event_date = %s, event_type = %s, description = %s, 
            notification_enabled = %s, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
        RETURNING id, title, event_date, event_type, description, notification_enabled
    ''', (
        data.get('title'),
        data.get('date'),
        data.get('type'),
        data.get('description'),
        data.get('notificationEnabled', True),
        data.get('id')
    ))
    
    conn.commit()
    updated_event = cur.fetchone()
    cur.close()
    conn.close()
    
    if not updated_event:
        return {
            'statusCode': 404,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Event not found'}),
            'isBase64Encoded': False
        }
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({
            'id': str(updated_event['id']),
            'title': updated_event['title'],
            'date': updated_event['event_date'].isoformat(),
            'type': updated_event['event_type'],
            'description': updated_event['description'],
            'notificationEnabled': updated_event['notification_enabled']
        }),
        'isBase64Encoded': False
    }

def delete_event(event_id: Optional[str]) -> Dict[str, Any]:
    if not event_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Event ID is required'}),
            'isBase64Encoded': False
        }
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute('DELETE FROM events WHERE id = %s RETURNING id', (event_id,))
    conn.commit()
    deleted = cur.fetchone()
    cur.close()
    conn.close()
    
    if not deleted:
        return {
            'statusCode': 404,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Event not found'}),
            'isBase64Encoded': False
        }
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'success': True}),
        'isBase64Encoded': False
    }
