from fastapi import FastAPI
from uvicorn import run
import os
import sys

# Add the backend directory to sys.path
backend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend')
if backend_path not in sys.path:
    sys.path.append(backend_path)

from main import app as application

# Vercel needs the app object to be named 'app'
app = application
