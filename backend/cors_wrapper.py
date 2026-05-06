"""
CORS-enabled launcher for shi3z/auto-excitement on Cloud Run.

We import the FastAPI ``app`` from the upstream ``server`` module and attach
``CORSMiddleware`` so that a Vercel-hosted frontend can call ``/predict`` and
the SSE ``/events/{job_id}`` endpoint cross-origin. Hosting policy is
controlled by the ``ALLOWED_ORIGINS`` env var (comma-separated, defaults to
``*``).

Cloud Run provides ``$PORT`` (defaults to 8080); we honour it.
"""

from __future__ import annotations

import os
import uvicorn
from fastapi.middleware.cors import CORSMiddleware

from server import app  # noqa: E402 — auto-excitement's FastAPI app


def _origins() -> list[str]:
    raw = os.environ.get("ALLOWED_ORIGINS", "*")
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    return parts or ["*"]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins(),
    allow_credentials=False,  # incompatible with allow_origins=["*"]; we don't use cookies
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
