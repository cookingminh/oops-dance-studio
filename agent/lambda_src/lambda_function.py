"""Lambda entry point.

Session 3: invoked directly with {"question": ..., "access_token": ...}.
Session 4: API Gateway will pass the token in the Authorization header instead.
Never print the event: it contains the customer's JWT.
"""
import json

from agent import ask

MAX_QUESTION_CHARS = 1000


def _response(status: int, body: dict) -> dict:
    return {"statusCode": status, "body": json.dumps(body, ensure_ascii=False)}


def lambda_handler(event, context):
    question = (event.get("question") or "").strip()
    jwt = event.get("access_token")
    if not question or not jwt:
        return _response(400, {"error": "question and access_token are required"})
    if len(question) > MAX_QUESTION_CHARS:
        return _response(400, {"error": "question is too long"})
    return _response(200, {"answer": ask(question, jwt)})
