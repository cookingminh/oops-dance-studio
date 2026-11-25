"""Run the Lambda handler on your Mac against the Supabase in agent/.env.local. Not deployed.

Usage: python scripts/local_test.py "Hôm nay mình có lớp nào?"
"""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "lambda_src"))

from lambda_function import lambda_handler  # noqa: E402
from supabase_client import sign_in  # noqa: E402

token = sign_in(os.environ["DEMO_EMAIL"], os.environ["DEMO_PASSWORD"])
question = " ".join(sys.argv[1:]) or "Mình đang học những lớp nào?"
result = lambda_handler({"question": question, "access_token": token}, None)
print(json.loads(result["body"]))
