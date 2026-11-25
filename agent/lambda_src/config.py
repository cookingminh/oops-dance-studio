"""Configuration: environment variables locally, SSM Parameter Store on Lambda."""
import os
from pathlib import Path

import boto3


def _load_env_file() -> None:
    """Local dev only: load ../.env.local. On Lambda the file does not exist."""
    for env_file in (Path(__file__).with_name(".env.local"), Path(__file__).parent.parent / ".env.local"):
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ.setdefault(key.strip(), value.strip())
            return


_load_env_file()

# Config key -> SSM parameter name
SSM_PARAMS = {
    "SUPABASE_URL": "/oops/supabase-url",
    "SUPABASE_ANON_KEY": "/oops/supabase-anon-key",
}
_cache: dict[str, str] = {}  # survives between warm invocations


def get(key: str) -> str:
    if os.environ.get(key):  # local run: value from .env.local
        return os.environ[key]
    if key not in _cache:  # Lambda: read once from SSM, then reuse
        ssm = boto3.client("ssm", region_name=os.environ.get("AWS_REGION", "ap-southeast-2"))
        _cache[key] = ssm.get_parameter(Name=SSM_PARAMS[key])["Parameter"]["Value"]
    return _cache[key]
