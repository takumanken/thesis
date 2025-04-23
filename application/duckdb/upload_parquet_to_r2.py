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

PARQUET_OBJECT_NAME = 'requests_311.parquet'
PARQUET_FILE_PATH = f'../backend/data/{PARQUET_OBJECT_NAME}'

CSV_OBJECT_NAME = 'NTA_population.csv'
CSV_FILE_PATH = f'../backend/data/{CSV_OBJECT_NAME}'

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

with open(PARQUET_FILE_PATH, 'rb') as data:
    s3_client.upload_fileobj(data, BUCKET_NAME, PARQUET_OBJECT_NAME)

with open(CSV_FILE_PATH, 'rb') as data:
    s3_client.upload_fileobj(data, BUCKET_NAME, CSV_OBJECT_NAME)

print("Upload complete!")
