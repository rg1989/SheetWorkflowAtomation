"""Auth configuration from environment."""
import os

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")

# Base URL for redirect_uri (e.g. https://your-app.up.railway.app).
# Auto-detect from RAILWAY_PUBLIC_DOMAIN if OAUTH_REDIRECT_BASE is not explicitly set.
OAUTH_REDIRECT_BASE = os.environ.get("OAUTH_REDIRECT_BASE", "")
if not OAUTH_REDIRECT_BASE and os.environ.get("RAILWAY_PUBLIC_DOMAIN"):
    OAUTH_REDIRECT_BASE = f"https://{os.environ['RAILWAY_PUBLIC_DOMAIN']}"

SESSION_SECRET_KEY = os.environ.get("SESSION_SECRET_KEY", "dev-secret-change-in-production")
