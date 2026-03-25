#!/usr/bin/env python3
"""
Run script to start the FastAPI application with uvicorn
"""

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
    )
