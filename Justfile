# The AI Scientist — dev runner
# Usage: just dev

set dotenv-load := false

venv := "backend/.venv/bin"

# Start both backend and frontend concurrently
dev:
    @echo "Starting backend (port 8000) and frontend (port 3000)..."
    @trap 'kill 0' SIGINT; \
        (cd backend && {{venv}}/uvicorn main:app --reload --port 8000) & \
        (cd frontend && npm run dev) & \
        wait

# Backend only
backend:
    cd backend && {{venv}}/uvicorn main:app --reload --port 8000

# Frontend only
frontend:
    cd frontend && npm run dev

# Install all dependencies
install:
    python3 -m venv backend/.venv
    {{venv}}/pip install -r backend/requirements.txt
    cd frontend && npm install

# Copy env example if .env doesn't exist
setup:
    @[ -f backend/.env ] || (cp backend/.env.example backend/.env && echo "Created backend/.env — fill in your API keys.")
