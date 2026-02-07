# SheetWorkflowAutomation - single service (frontend + backend)
# Build frontend, then run FastAPI serving API + static SPA

# --- Frontend build ---
FROM node:20-alpine AS frontend
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# --- Backend + combined static ---
FROM python:3.11-slim
WORKDIR /app

# Copy backend
COPY backend/requirements.txt backend/
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ ./backend/

# Copy built frontend into backend static (so FastAPI can serve SPA)
RUN mkdir -p backend/app/static
COPY --from=frontend /app/frontend/dist/. backend/app/static/

# Data dir for SQLite and uploads (use env or default)
ENV SHEET_WORKFLOW_DATA_DIR=/app/data
RUN mkdir -p /app/data

# Railway (and most PaaS) set PORT at runtime
ENV PORT=8000
EXPOSE 8000

# Run FastAPI; use 0.0.0.0 so it's reachable from outside
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --chdir backend"]
