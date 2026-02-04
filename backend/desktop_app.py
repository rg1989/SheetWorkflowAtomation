"""
Desktop App Entry Point for PyInstaller Bundle

This script serves as the entry point for the bundled desktop application.
It starts the FastAPI server and opens the browser automatically.
"""
import os
import sys
import webbrowser
import threading
import time
import uvicorn
from pathlib import Path

# Determine if we're running as a bundled executable
if getattr(sys, 'frozen', False):
    # Running as bundled executable
    BASE_DIR = Path(sys._MEIPASS)
    # Data directory next to the executable
    DATA_DIR = Path(sys.executable).parent / "data"
else:
    # Running in development
    BASE_DIR = Path(__file__).parent
    DATA_DIR = BASE_DIR.parent / "data"

# Set environment variable for the app to find data directory
os.environ["SHEET_WORKFLOW_DATA_DIR"] = str(DATA_DIR)

# Ensure data directories exist
UPLOADS_DIR = DATA_DIR / "uploads"
OUTPUTS_DIR = DATA_DIR / "outputs"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)


def open_browser(port: int, delay: float = 1.5):
    """Open the browser after a short delay to let the server start."""
    time.sleep(delay)
    webbrowser.open(f"http://localhost:{port}")


def main():
    port = 8000
    host = "127.0.0.1"
    
    print(f"""
╔══════════════════════════════════════════════════════════════╗
║           Sheet Workflow Automation                          ║
║                                                              ║
║   The app is starting...                                     ║
║   Opening browser at http://localhost:{port}                   ║
║                                                              ║
║   Keep this window open while using the app.                 ║
║   Close this window to stop the app.                         ║
╚══════════════════════════════════════════════════════════════╝
""")
    
    # Open browser in a separate thread
    browser_thread = threading.Thread(target=open_browser, args=(port,))
    browser_thread.daemon = True
    browser_thread.start()
    
    # Start the server
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        log_level="warning",
        reload=False,
    )


if __name__ == "__main__":
    main()
