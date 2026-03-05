FROM python:3.11-slim

# System deps — ffmpeg essential for video processing
RUN apt-get update && apt-get install -y \
    ffmpeg \
    espeak \
    libespeak1 \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Output dirs
RUN mkdir -p output/videos output/audio

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]