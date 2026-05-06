#!/usr/bin/env bash
#
# One-shot deploy script: builds the image with Cloud Build and deploys it
# to Cloud Run with an attached NVIDIA L4 GPU.
#
# Required:
#   PROJECT_ID    GCP project (or rely on `gcloud config get-value project`)
# Optional:
#   REGION        default us-central1 (must support Cloud Run GPU)
#   SERVICE       default auto-excitement-server
#   REPO          default auto-excitement (Artifact Registry repo)
#   IMAGE_TAG     default latest
#   ALLOWED_ORIGINS default "*" (set to your Vercel URL in production)
#   GPU_TYPE      default nvidia-l4
#   MEMORY        default 16Gi
#   CPU           default 4
#   MAX_INSTANCES default 3
#   TIMEOUT       default 3600 (Cloud Run request timeout, seconds; max 3600)

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || echo)}"
if [ -z "${PROJECT_ID}" ]; then
  echo "ERROR: PROJECT_ID not set and no gcloud project configured." >&2
  exit 1
fi

REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-auto-excitement-server}"
REPO="${REPO:-auto-excitement}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
GPU_TYPE="${GPU_TYPE:-nvidia-l4}"
MEMORY="${MEMORY:-16Gi}"
CPU="${CPU:-4}"
MAX_INSTANCES="${MAX_INSTANCES:-3}"
TIMEOUT="${TIMEOUT:-3600}"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-*}"

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/server:${IMAGE_TAG}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Project:        ${PROJECT_ID}"
echo "==> Region:         ${REGION}"
echo "==> Service:        ${SERVICE}"
echo "==> Image:          ${IMAGE}"
echo "==> GPU type:       ${GPU_TYPE}"
echo

echo "==> Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  --project="${PROJECT_ID}"

echo "==> Ensuring Artifact Registry repo '${REPO}' exists in ${REGION}..."
gcloud artifacts repositories describe "${REPO}" \
    --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1 || \
  gcloud artifacts repositories create "${REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --project="${PROJECT_ID}" \
    --description="auto-excitement backend images"

echo "==> Submitting Cloud Build (this can take 30-60 min on first build)..."
gcloud builds submit "${SCRIPT_DIR}" \
  --config="${SCRIPT_DIR}/cloudbuild.yaml" \
  --substitutions="_REGION=${REGION},_REPO=${REPO},_IMAGE=server,_TAG=${IMAGE_TAG}" \
  --project="${PROJECT_ID}"

echo "==> Deploying to Cloud Run with ${GPU_TYPE} GPU..."
gcloud beta run deploy "${SERVICE}" \
  --image="${IMAGE}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --platform=managed \
  --allow-unauthenticated \
  --gpu=1 \
  --gpu-type="${GPU_TYPE}" \
  --no-cpu-throttling \
  --execution-environment=gen2 \
  --memory="${MEMORY}" \
  --cpu="${CPU}" \
  --timeout="${TIMEOUT}" \
  --max-instances="${MAX_INSTANCES}" \
  --min-instances=0 \
  --concurrency=1 \
  --port=8080 \
  --set-env-vars="ALLOWED_ORIGINS=${ALLOWED_ORIGINS}"

URL="$(gcloud run services describe "${SERVICE}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format='value(status.url)')"

echo
echo "==> Deployed: ${URL}"
echo "    Set NEXT_PUBLIC_BACKEND_URL=${URL} on Vercel to point the frontend here."
