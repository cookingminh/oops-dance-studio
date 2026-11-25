"""The agent loop: model asks for tools, code runs them, model answers."""
import json
from datetime import datetime

import config  # noqa: F401  (loads .env.local for local runs, before boto3 creates clients)
import boto3

from tools import STUDIO_TZ, TOOL_CONFIG, VI_DAY_NAMES, run_tool

client = boto3.client("bedrock-runtime", region_name="ap-southeast-2")  # created once, reused while warm
MODEL_ID = "au.anthropic.claude-haiku-4-5-20251001-v1:0"
MAX_TURNS = 5  # guardrail: never loop forever


def system_prompt() -> str:
    now = datetime.now(STUDIO_TZ)
    return (
        "You are the assistant of Oops! Dance Studio in Hanoi. "
        f"Today is {VI_DAY_NAMES[now.weekday()]}, {now:%Y-%m-%d} ({now:%A}), studio time {now:%H:%M}. "
        "Prices are in VND. "
        "Use the tools for public classes, free rehearsal rooms, the customer's room bookings and the customer's "
        "enrolled classes. Never guess. "
        "Room bookings (renting a room by the hour) and classes (courses the customer is enrolled in) are different "
        "things. Never answer with data from an unrelated tool. "
        "For how things work, studio rules and advice (booking steps, deposits, joining classes, beginners, what to "
        "bring, house rules, parking, support chat), call search_studio_info and answer only from the passages it "
        "returns. If the passages do not answer the question, say you are not sure and suggest asking the studio. "
        "Passages marked 'Nội dung mẫu' are sample content: mention that the information is not confirmed yet. "
        "For refund rules always call get_cancellation_policy; never take refund numbers from passages. "
        "Only offer what your tools can do. For actions you cannot do (booking a room, joining a class, cancelling), "
        "tell the customer how to do it on the Oops website or suggest the support chat. "
        "If no tool can answer, say so honestly and suggest contacting the studio. "
        "If the customer refers to something not in this conversation, ask them to clarify. "
        "Copy weekday_vi, date_vi and status_vi exactly; never compute dates or weekdays yourself. "
        "Reply in the customer's language (usually Vietnamese), short and clear. "
        "Tone: cheerful and young like a Gen Z staff member. Always call yourself 'mình' and the customer 'bạn', "
        "even if the customer is rude. Never use 'tao', 'mày' or 'anh/chị'."
    )


def _text(message: dict) -> str:
    return "".join(b["text"] for b in message["content"] if "text" in b)


def ask(question: str, jwt: str) -> str:
    messages = [{"role": "user", "content": [{"text": question}]}]
    for turn in range(1, MAX_TURNS + 1):
        resp = client.converse(
            modelId=MODEL_ID,
            system=[{"text": system_prompt()}],
            messages=messages,
            toolConfig=TOOL_CONFIG,
            inferenceConfig={"maxTokens": 700},
        )
        message = resp["output"]["message"]
        messages.append(message)
        stop = resp["stopReason"]
        usage = resp["usage"]
        # Log what happened, never the customer's data or token
        print(json.dumps({"turn": turn, "stop": stop, "in": usage["inputTokens"], "out": usage["outputTokens"]}))

        if stop == "end_turn":
            return _text(message)
        if stop == "max_tokens":
            return "Xin lỗi, câu trả lời dài quá. Bạn hỏi cụ thể hơn một chút nhé!"
        if stop != "tool_use":
            return "Xin lỗi, mình không giúp được yêu cầu này."

        results = []
        for block in message["content"]:
            if "toolUse" in block:
                call = block["toolUse"]
                # Free-text queries may hold personal details: log their length, not their words
                safe_input = {k: (f"<{len(v)} chars>" if k == "query" else v) for k, v in call["input"].items()}
                print(json.dumps({"tool": call["name"], "input": safe_input}, ensure_ascii=False))
                result = run_tool(call["name"], call["input"], jwt)
                results.append({"toolResult": {"toolUseId": call["toolUseId"],
                                               "content": [{"json": {"result": result}}]}})
        messages.append({"role": "user", "content": results})
    return "Xin lỗi, mình chưa xử lý xong yêu cầu này. Bạn thử hỏi lại nhé!"
