"""Sign in to the CLOUD Supabase with a TEST account, then invoke the deployed Lambda. Not deployed.

Reads agent/.env.cloud. Usage: python scripts/invoke_cloud.py "Hôm nay mình có lớp nào?"
"""
import json
import sys
import urllib.request
from pathlib import Path

import boto3

env = {}
for line in (Path(__file__).resolve().parent.parent / ".env.cloud").read_text().splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

req = urllib.request.Request(
    env["CLOUD_SUPABASE_URL"] + "/auth/v1/token?grant_type=password",
    data=json.dumps({"email": env["CLOUD_TEST_EMAIL"], "password": env["CLOUD_TEST_PASSWORD"]}).encode(),
    headers={"apikey": env["CLOUD_SUPABASE_ANON_KEY"], "Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req, timeout=10) as resp:
    token = json.loads(resp.read())["access_token"]

question = " ".join(sys.argv[1:]) or "Mình đang học những lớp nào?"
lam = boto3.Session(profile_name="oops", region_name="ap-southeast-2").client("lambda")
resp = lam.invoke(FunctionName="oops-agent", Payload=json.dumps({"question": question, "access_token": token}).encode())
result = json.loads(resp["Payload"].read())
if resp.get("FunctionError"):
    print("LAMBDA ERROR:", json.dumps(result, ensure_ascii=False, indent=2))
else:
    print(json.loads(result["body"]))
