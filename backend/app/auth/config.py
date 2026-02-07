"""Auth configuration from environment."""
import os

# SESSION_SECRET_KEY is needed at startup for middleware init – read once.
SESSION_SECRET_KEY = os.environ.get("SESSION_SECRET_KEY", "dev-secret-change-in-production")

# OAuth credentials are now read at request time via router._get_credentials()
# to avoid import-time vs runtime ordering issues on Railway.
