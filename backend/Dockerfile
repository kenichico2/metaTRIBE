# syntax=docker/dockerfile:1.6
#
# Cloud Run GPU container for shi3z/auto-excitement (Meta TRIBEv2).
# Targets NVIDIA L4 GPU on Cloud Run (gen2 execution environment, CUDA 12.x).
#
# Build:
#   docker build -t auto-excitement-server backend/
# Deploy via Cloud Build + Cloud Run:
#   bash backend/deploy.sh

FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080 \
    PYTHONPATH=/opt/auto-excitement

# System packages
RUN apt-get update && apt-get install -y --no-install-recommends \
        software-properties-common ca-certificates curl git build-essential \
        ffmpeg libsndfile1 \
    && add-apt-repository -y ppa:deadsnakes/ppa \
    && apt-get update && apt-get install -y --no-install-recommends \
        python3.11 python3.11-venv python3.11-dev python3-pip \
    && ln -sf /usr/bin/python3.11 /usr/local/bin/python \
    && ln -sf /usr/bin/python3.11 /usr/local/bin/python3 \
    && rm -rf /var/lib/apt/lists/*

RUN python -m pip install --upgrade pip setuptools wheel

# Clone auto-excitement and TRIBEv2
ARG AUTO_EXCITEMENT_REF=main
ARG TRIBEV2_REF=main
WORKDIR /opt
RUN git clone https://github.com/shi3z/auto-excitement.git \
    && cd auto-excitement && git checkout ${AUTO_EXCITEMENT_REF} \
    && git clone https://github.com/facebookresearch/tribev2.git tribev2-src \
    && cd tribev2-src && git checkout ${TRIBEV2_REF}

WORKDIR /opt/auto-excitement

# Pre-install PyTorch matching the CUDA base (2.4 + cu121).
RUN pip install --extra-index-url https://download.pytorch.org/whl/cu121 \
        torch==2.4.1 torchaudio==2.4.1 torchvision==0.19.1

# Project dependencies + FastAPI server stack
RUN pip install -r requirements.txt \
    && pip install -e ./tribev2-src \
    && pip install "fastapi>=0.110" "uvicorn[standard]>=0.30"

# Apply upstream patches and download spaCy Japanese model (best-effort).
RUN bash patches/apply.sh || echo "[warn] patches/apply.sh failed — continuing"
RUN python -m spacy download ja_core_news_lg || echo "[warn] spacy ja model skipped"

# CORS wrapper + entrypoint (the wrapper imports server.app and adds CORSMiddleware
# so the Vercel frontend can call us cross-origin).
COPY cors_wrapper.py /opt/auto-excitement/cors_wrapper.py
COPY entrypoint.sh /opt/entrypoint.sh
RUN chmod +x /opt/entrypoint.sh

EXPOSE 8080
CMD ["/opt/entrypoint.sh"]
