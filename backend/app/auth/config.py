"""Auth configuration from environment."""
import os

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
# Base URL for redirect_uri (e.g. https://your-app.up.railway.app). If unset, use request.base_url.
OAUTH_REDIRECT_BASE = os.environ.get("OAUTH_REDIRECT_BASE", "")
SESSION_SECRET_KEY = os.environ.get("SESSION_SECRET_KEY", "dev-secret-change-in-production")
