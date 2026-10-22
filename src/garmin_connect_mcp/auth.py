"""Authentication and configuration for Garmin Connect API."""

import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_ENV_FILE = Path.home() / ".garminconnect.env"
LOCAL_ENV_FILE = Path(".env")


class GarminConfig(BaseSettings):
    """Garmin Connect API configuration from environment variables."""

    garmin_email: str = ""
    garmin_password: str = ""
    garmintokens: str = str(Path.home() / ".garminconnect")
    garmintokens_base64: str = str(Path.home() / ".garminconnect_base64")

    model_config = SettingsConfigDict(env_file_encoding="utf-8", case_sensitive=False)


def get_env_file_path() -> Path:
    """Get the path where interactive setup should write credentials."""
    local_env = Path.cwd() / LOCAL_ENV_FILE
    if local_env.exists():
        return local_env
    return DEFAULT_ENV_FILE


def load_config() -> GarminConfig:
    """Load configuration from environment variables and env files."""
    settings_kwargs = {"_env_file": (str(DEFAULT_ENV_FILE), str(LOCAL_ENV_FILE))}
    return GarminConfig(**settings_kwargs)


def validate_credentials(config: GarminConfig) -> bool:
    """Check if email/password credentials are properly configured."""
    if not config.garmin_email or config.garmin_email == "your_email@example.com":
        return False
    if not config.garmin_password or config.garmin_password == "your_password":
        return False
    return True


def has_saved_tokens(config: GarminConfig) -> bool:
    """Check whether OAuth tokens from a previous login exist on disk."""
    token_dir = Path(config.garmintokens).expanduser()
    return token_dir.is_dir() and any(token_dir.iterdir())


def can_authenticate(config: GarminConfig) -> bool:
    """Saved tokens are enough to run; the password is only needed to mint new ones."""
    return has_saved_tokens(config) or validate_credentials(config)


def write_private_file(path: Path, content: str) -> None:
    """Write a file readable only by the current user (0600), even under a loose umask."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        fh.write(content)
    os.chmod(path, 0o600)


def get_token_store() -> str:
    """Get the token storage directory path."""
    config = load_config()
    token_dir = Path(config.garmintokens)
    token_dir.mkdir(parents=True, exist_ok=True)
    return str(token_dir)


def get_token_base64_path() -> str:
    """Get the base64 token file path."""
    config = load_config()
    return config.garmintokens_base64
