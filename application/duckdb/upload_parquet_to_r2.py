import json
from botocore.client import Config
import boto3

# Load secrets from JSON
with open('../../secrets.json') as f:
    secrets = json.load(f)

ACCOUNT_ID = secrets['R2_ACCOUNT_ID']
ACCESS_KEY_ID = secrets['R2_ACCESS_KEY_ID']
SECRET_ACCESS_KEY = secrets['R2_SECRET_ACCESS_KEY']
BUCKET_NAME = secrets['R2_BUCKET_NAME']
OBJECT_NAME = 'requests_311.parquet'
FILE_PATH = '../backend/data/requests_311.parquet'

ENDPOINT_URL = f'https://{ACCOUNT_ID}.r2.cloudflarestorage.com'

session = boto3.session.Session()

s3_client = session.client(
    's3',
    region_name='auto',
    endpoint_url=ENDPOINT_URL,
    aws_access_key_id=ACCESS_KEY_ID,
    aws_secret_access_key=SECRET_ACCESS_KEY,
    config=Config(signature_version='s3v4')
)

with open(FILE_PATH, 'rb') as data:
    s3_client.upload_fileobj(data, BUCKET_NAME, OBJECT_NAME)

print("Upload complete!")
