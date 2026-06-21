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
# Install deps then strip CUDA/CuDNN packages — not needed on a CPU-only VPS
# and each nvidia-* package is ~100-600 MB, causing "no space left" during builds.
RUN pip install --no-cache-dir -r requirements.txt \
    && pip uninstall -y \
       nvidia-cublas-cu12 \
       nvidia-cufft-cu12 \
       nvidia-cudnn-cu12 \
       nvidia-curand-cu12 \
       nvidia-cusolver-cu12 \
       nvidia-cusparse-cu12 \
       nvidia-nccl-cu12 \
       nvidia-nvtx-cu12 \
       nvidia-cuda-nvrtc-cu12 \
       nvidia-cuda-runtime-cu12 \
       nvidia-cuda-cupti-cu12 \
    2>/dev/null; true

COPY . .

# Output dirs
RUN mkdir -p output/videos output/audio

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]