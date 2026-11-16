import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

    _raw_db_url = os.getenv("MYSQL_URL") or os.getenv("DATABASE_URL")
    if _raw_db_url:
        if _raw_db_url.startswith("mysql://"):
            _raw_db_url = _raw_db_url.replace("mysql://", "mysql+pymysql://", 1)
        SQLALCHEMY_DATABASE_URI = _raw_db_url
    else:
        DB_USER = os.getenv("DB_USER")
        DB_PASSWORD = os.getenv("DB_PASSWORD")
        DB_HOST = os.getenv("DB_HOST")
        DB_PORT = os.getenv("DB_PORT")
        DB_NAME = os.getenv("DB_NAME")
        SQLALCHEMY_DATABASE_URI = (
            f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
        )