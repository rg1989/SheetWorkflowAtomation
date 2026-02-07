"""
Token encryption utilities using Fernet symmetric encryption.
"""
import os
import base64
import logging
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

logger = logging.getLogger("uvicorn.error")

# Module-level cache for Fernet instance
_fernet = None


def _get_fernet_key():
    """
    Get or create a Fernet instance for token encryption.

    Uses TOKEN_ENCRYPTION_KEY from environment if available, otherwise falls back
    to SESSION_SECRET_KEY. Derives a 32-byte encryption key using PBKDF2HMAC.

    Returns:
        Fernet: Configured Fernet instance for encryption/decryption
    """
    global _fernet

    if _fernet is not None:
        return _fernet

    # Check for dedicated token encryption key first
    encryption_key = os.environ.get("TOKEN_ENCRYPTION_KEY")

    if not encryption_key:
        # Fall back to SESSION_SECRET_KEY
        from app.auth.config import SESSION_SECRET_KEY
        encryption_key = SESSION_SECRET_KEY
        logger.warning(
            "TOKEN_ENCRYPTION_KEY not set, falling back to SESSION_SECRET_KEY for token encryption. "
            "Consider setting a dedicated TOKEN_ENCRYPTION_KEY for better security isolation."
        )

    # Derive a 32-byte key using PBKDF2HMAC
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"sheet-workflow-token-encryption",
        iterations=480000,
    )
    derived_key = kdf.derive(encryption_key.encode())

    # Fernet requires URL-safe base64 encoded key
    fernet_key = base64.urlsafe_b64encode(derived_key)
    _fernet = Fernet(fernet_key)

    return _fernet


def encrypt_token(plaintext: str) -> str:
    """
    Encrypt a token string using Fernet symmetric encryption.

    Args:
        plaintext: The plaintext token to encrypt

    Returns:
        str: Base64-encoded encrypted token, or None if input is None
    """
    if plaintext is None:
        return None

    fernet = _get_fernet_key()
    encrypted = fernet.encrypt(plaintext.encode())
    return encrypted.decode()


def decrypt_token(ciphertext: str) -> str:
    """
    Decrypt a token string using Fernet symmetric encryption.

    Args:
        ciphertext: The base64-encoded encrypted token

    Returns:
        str: Decrypted plaintext token, or None if input is None

    Raises:
        ValueError: If decryption fails (e.g., encryption key changed)
    """
    if ciphertext is None:
        return None

    fernet = _get_fernet_key()

    try:
        decrypted = fernet.decrypt(ciphertext.encode())
        return decrypted.decode()
    except InvalidToken:
        raise ValueError(
            "Token decryption failed — encryption key may have changed"
        )
