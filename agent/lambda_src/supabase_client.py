"""Every call to Supabase goes through here. Always pass the customer's JWT so RLS applies."""
import json
import urllib.error
import urllib.request

import config


def _request(method: str, path: str, jwt: str | None = None, body=None):
    headers = {"apikey": config.get("SUPABASE_ANON_KEY"), "Content-Type": "application/json"}
    if jwt:
        headers["Authorization"] = f"Bearer {jwt}"  # who is calling -> RLS applies to this user
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(config.get("SUPABASE_URL") + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Supabase {e.code}: {e.read().decode()}") from None


def sign_in(email: str, password: str) -> str:
    """Local testing only. On Lambda the JWT comes from the customer's request."""
    data = _request("POST", "/auth/v1/token?grant_type=password", body={"email": email, "password": password})
    return data["access_token"]


def rpc(name: str, params: dict, jwt: str | None = None):
    return _request("POST", f"/rest/v1/rpc/{name}", jwt=jwt, body=params)


def select(table: str, query: str, jwt: str | None = None):
    return _request("GET", f"/rest/v1/{table}?{query}", jwt=jwt)
