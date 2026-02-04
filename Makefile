.PHONY: run install install-backend install-frontend backend frontend clean

# Virtual environment path
VENV := venv
PYTHON := $(VENV)/bin/python
PIP := $(VENV)/bin/pip
UVICORN := $(VENV)/bin/uvicorn

# Start both backend and frontend concurrently
run:
	@echo "Starting SheetWorkflowAutomation..."
	@trap 'kill 0' EXIT; \
	$(MAKE) backend & \
	$(MAKE) frontend & \
	wait

# Install all dependencies
install: install-backend install-frontend

# Create virtual environment if it doesn't exist
$(VENV)/bin/activate:
	python3 -m venv $(VENV)

# Install backend dependencies
install-backend: $(VENV)/bin/activate
	@echo "Installing backend dependencies..."
	$(PIP) install -r backend/requirements.txt

# Install frontend dependencies
install-frontend:
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

# Run backend only
backend:
	@echo "Starting backend on http://localhost:8000..."
	cd backend && ../$(UVICORN) app.main:app --reload --host 0.0.0.0 --port 8000

# Run frontend only
frontend:
	@echo "Starting frontend on http://localhost:5173..."
	cd frontend && npm run dev

# Clean generated files
clean:
	@echo "Cleaning up..."
	rm -rf backend/__pycache__ backend/app/__pycache__
	rm -rf frontend/node_modules/.vite
	rm -rf data/
