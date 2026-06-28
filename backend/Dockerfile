# ---------- build stage ----------
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build deps for psycopg2-binary
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ---------- runtime stage ----------
FROM python:3.11-slim AS runtime

WORKDIR /app

# Runtime deps: psycopg2 + curl (needed for Docker healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY . .

# Cloud Run delivers PORT via env; default 8080
ENV PORT=8080

# Run as non-root
RUN adduser --disabled-password --gecos "" appuser
USER appuser

# Start uvicorn directly. Migrations and user seeding run inside the FastAPI
# lifespan hook (app/main.py) with full error logging and no fatal crashes.
# Running alembic here with && would abort startup if the DB is briefly
# unreachable, preventing uvicorn from ever binding to PORT.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1"]
