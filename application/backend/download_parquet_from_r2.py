import os
import logging
from botocore.client import Config
import boto3

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def download_parquet_from_r2():
    """Download the 311 requests parquet file from Cloudflare R2 storage"""
    
    try:
        # Load credentials from environment variables
        ACCOUNT_ID = os.environ.get('R2_ACCOUNT_ID')
        ACCESS_KEY_ID = os.environ.get('R2_ACCESS_KEY_ID')
        SECRET_ACCESS_KEY = os.environ.get('R2_SECRET_ACCESS_KEY')
        BUCKET_NAME = os.environ.get('R2_BUCKET_NAME')
                
        # Define file names and paths
        OBJECT_NAMES = ['requests_311.parquet', 'NTA_population.csv']
        DOWNLOAD_DIRECTORY = 'data'

        # Ensure the download directory exists
        os.makedirs(DOWNLOAD_DIRECTORY, exist_ok=True)

        ENDPOINT_URL = f'https://{ACCOUNT_ID}.r2.cloudflarestorage.com'
        
        logger.info(f"Connecting to R2 storage at {ENDPOINT_URL}")
        
        # Create session and client
        session = boto3.session.Session()
        s3_client = session.client(
            's3',
            region_name='auto',
            endpoint_url=ENDPOINT_URL,
            aws_access_key_id=ACCESS_KEY_ID,
            aws_secret_access_key=SECRET_ACCESS_KEY,
            config=Config(signature_version='s3v4')
        )
        
        # Download each object
        for object_name in OBJECT_NAMES:
            download_path = os.path.join(DOWNLOAD_DIRECTORY, object_name)
            s3_client.download_file(BUCKET_NAME, object_name, download_path)
            logger.info(f"Downloading {object_name} from bucket {BUCKET_NAME}")
        
        # Download the file
        logger.info(f"Download complete!")
        
    except Exception as e:
        logger.error(f"Error downloading parquet file: {str(e)}")
        raise

if __name__ == "__main__":
    download_parquet_from_r2()