# Use a lightweight Python base image
FROM python:3.10-slim

# Install ffmpeg and required system
# RUN apt-get update && apt-get install -y ffmpeg


# Set working directory inside container
WORKDIR /app

# # Install system dependencies (if needed)
# RUN apt-get update && apt-get install -y --no-install-recommends \
#     build-essential \
#     && rm -rf /var/lib/apt/lists/*

# Install system dependencies in one layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency file first for caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code
COPY . .

# Expose the backend port (Flask default: 5000, FastAPI default: 8000)
EXPOSE 5000

# Start the app (adjust if you're using FastAPI/Uvicorn instead of Flask)
CMD ["python", "app.py"]