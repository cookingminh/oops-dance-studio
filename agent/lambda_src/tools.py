"""Tool functions (what really runs) and tool specs (what the model sees)."""
from datetime import date, datetime
from zoneinfo import ZoneInfo

import boto3
from botocore.exceptions import BotoCoreError, ClientError

import config
from supabase_client import rpc, select

kb_client = boto3.client("bedrock-agent-runtime", region_name="ap-southeast-2")  # created once, reused while warm
KB_RESULTS = 3  # passages per search: enough context, little noise

STUDIO_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]  # ISO 1..7
VI_DAY_NAMES = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]
VI_STATUS = {"pending": "Chờ xác nhận", "approved": "Đã xác nhận", "rejected": "Bị từ chối",
             "cancelled": "Đã hủy", "completed": "Hoàn thành"}


def studio_today() -> date:
    return datetime.now(STUDIO_TZ).date()


def _hhmm(value) -> str:
    return (value or "")[:5]


# ---------------- Tool functions ----------------

def list_classes(day: str | None = None) -> list:
    rows = rpc("list_public_classes", {})
    wanted = DAY_NAMES.index(day) + 1 if day else None
    result = []
    for c in rows:
        schedules = c.get("schedules") or []
        if wanted:
            schedules = [s for s in schedules if s.get("day_of_week") == wanted]
            if not schedules:
                continue
        result.append({
            "name": c["name"],
            "level": c.get("level"),
            "price_vnd": c["price"],
            "instructor": c.get("instructor_name"),
            "room": c.get("room_name"),
            "address": c.get("venue_address"),
            "schedule": [
                {"weekday_vi": VI_DAY_NAMES[s["day_of_week"] - 1],
                 "start": _hhmm(s.get("start_time")), "end": _hhmm(s.get("end_time"))}
                for s in schedules
            ],
        })
    return result


def find_free_room_slots(day_iso: str, jwt: str) -> dict:
    d = date.fromisoformat(day_iso)  # raises ValueError on a bad format
    if d < studio_today():
        return {"error": "That date is in the past."}
    rows = rpc("get_available_slots", {"p_date": day_iso}, jwt)
    rooms: dict[str, list] = {}
    for r in sorted(rows, key=lambda r: (r["room_name"], r["start_time"])):
        ranges = rooms.setdefault(r["room_name"], [])
        if ranges and ranges[-1][1] == r["start_time"]:
            ranges[-1][1] = r["end_time"]  # merge back-to-back slots
        else:
            ranges.append([r["start_time"], r["end_time"]])
    return {
        "date_vi": d.strftime("%d/%m/%Y"),
        "weekday_vi": VI_DAY_NAMES[d.weekday()],
        "rooms": [{"room": name, "free": [f"{_hhmm(s)}-{_hhmm(e)}" for s, e in ranges]}
                  for name, ranges in rooms.items()],
    }


def get_my_bookings(jwt: str) -> dict:
    # RLS returns only this customer's own bookings
    rows = select("bookings", "select=id,date,start_time,end_time,status,rooms(name)&order=date.desc&limit=10", jwt)
    today = studio_today()
    upcoming, past_or_cancelled = [], []
    for b in rows:
        d = date.fromisoformat(b["date"])
        item = {
            "id": b["id"],
            "room": (b.get("rooms") or {}).get("name"),
            "date_vi": d.strftime("%d/%m/%Y"),
            "weekday_vi": VI_DAY_NAMES[d.weekday()],  # computed by code, never by the model
            "start": _hhmm(b["start_time"]),
            "end": _hhmm(b["end_time"]),
            "status_vi": VI_STATUS.get(b["status"], b["status"]),
            "_sort": (b["date"], b["start_time"]),
        }
        if d >= today and b["status"] in ("pending", "approved"):
            upcoming.append(item)
        else:
            past_or_cancelled.append(item)
    upcoming.sort(key=lambda x: x["_sort"])
    past_or_cancelled.sort(key=lambda x: x["_sort"], reverse=True)
    for item in upcoming + past_or_cancelled:
        item.pop("_sort")
    return {"upcoming": upcoming, "past_or_cancelled": past_or_cancelled}


def get_my_classes(jwt: str) -> dict:
    # RLS on class_students: a student only sees their own enrolments
    rows = select("class_students",
                  "select=joined_at,classes(name,price,class_schedules(day_of_week,start_time,end_time))", jwt)
    today_iso = studio_today().isoweekday()  # 1 = Monday ... 7 = Sunday, same as day_of_week
    classes = []
    for row in rows:
        c = row["classes"]
        sessions = [
            {"weekday_vi": VI_DAY_NAMES[s["day_of_week"] - 1],
             "start": _hhmm(s["start_time"]), "end": _hhmm(s["end_time"]),
             "is_today": s["day_of_week"] == today_iso}
            for s in sorted(c.get("class_schedules") or [], key=lambda s: (s["day_of_week"], s["start_time"]))
        ]
        classes.append({"name": c["name"], "price_vnd": c["price"], "sessions": sessions})
    return {"classes": classes}


def search_studio_info(query: str) -> dict:
    """RAG: find the most relevant passages in the studio's knowledge base (Bedrock Knowledge Base)."""
    resp = kb_client.retrieve(
        knowledgeBaseId=config.get("KNOWLEDGE_BASE_ID"),
        retrievalQuery={"text": query},
        retrievalConfiguration={"vectorSearchConfiguration": {"numberOfResults": KB_RESULTS}},
    )
    passages = []
    for r in resp["retrievalResults"]:
        uri = ((r.get("location") or {}).get("s3Location") or {}).get("uri", "")
        passages.append({
            "source": uri.rsplit("/", 1)[-1],  # file name, e.g. thue-phong-tap.md
            "score": round(r.get("score", 0.0), 3),
            "text": r["content"]["text"],
        })
    return {"passages": passages}


def get_cancellation_policy(jwt: str) -> dict:
    """Live refund policy from booking_settings: admins change it in the app, so it never lives in the docs."""
    rows = select("booking_settings",
                  "select=refund_full_hours,refund_partial_hours,refund_partial_percent", jwt)
    s = rows[0]
    full, partial, percent = s["refund_full_hours"], s["refund_partial_hours"], s["refund_partial_percent"]
    rules = [
        "Booking chưa được studio duyệt: hủy được hoàn 100% số tiền đã trả.",
        "Studio hủy hoặc từ chối booking: hoàn 100% số tiền đã trả.",
    ]
    if full:
        rules.append(f"Hủy trước giờ bắt đầu từ {full} giờ trở lên: hoàn 100% số tiền đã trả.")
        rules.append(f"Hủy trước từ {partial} đến dưới {full} giờ: hoàn {percent}% số tiền đã trả.")
    else:
        rules.append(f"Hủy trước giờ bắt đầu từ {partial} giờ trở lên: hoàn {percent}% số tiền đã trả.")
    rules.append(f"Hủy khi còn dưới {partial} giờ: không hoàn tiền.")
    return {
        "rules_vi": rules,
        "how_to_cancel_vi": "Khách tự hủy trong mục Booking của tôi; app hiện số tiền hoàn cụ thể trước khi xác nhận.",
    }


# ---------------- Tool specs ----------------

def _spec(name: str, description: str, properties: dict | None = None, required: list | None = None) -> dict:
    return {"toolSpec": {"name": name, "description": description, "inputSchema": {"json": {
        "type": "object", "properties": properties or {}, "required": required or []}}}}


TOOL_CONFIG = {"tools": [
    _spec("list_classes",
          "List the studio's dance classes open to everyone, with level, price (VND), instructor, room and weekly "
          "schedule. Pass a day to only get classes on that day of the week.",
          {"day": {"type": "string", "enum": DAY_NAMES, "description": "Optional. Omit to get the whole week."}}),
    _spec("find_free_room_slots",
          "Find free time ranges of the studio's rehearsal rooms on one date, for renting a room by the hour. "
          "Turn words like 'tomorrow' or 'this Saturday' into a date using today's date from the system prompt.",
          {"date": {"type": "string", "description": "Date in YYYY-MM-DD format, today or later."}},
          ["date"]),
    _spec("get_my_bookings",
          "Get the signed-in customer's own ROOM bookings (renting a room by the hour, latest 10), split into "
          "upcoming and past_or_cancelled. These are NOT classes."),
    _spec("get_my_classes",
          "Get the dance classes (courses) the signed-in customer is enrolled in, with weekly sessions. "
          "This is NOT room bookings. Use is_today to answer questions about today's classes."),
    _spec("search_studio_info",
          "Search the studio's knowledge base for how things work and rules: how to book a room, deposits, "
          "how to join a class, trial sessions, which class suits a beginner, dance styles, what to bring, house "
          "rules, parking, support chat. Returns the most relevant passages with their source file. "
          "Not for prices, schedules, free rooms, refund percentages or the customer's own data.",
          {"query": {"type": "string",
                     "description": "The customer's question rewritten as a short search query in Vietnamese."}},
          ["query"]),
    _spec("get_cancellation_policy",
          "Get the studio's current refund policy for cancelling a room booking (how many hours before the start "
          "gives a full or partial refund). Always use this for refund numbers; never take them from other sources."),
]}


def run_tool(name: str, tool_input: dict, jwt: str):
    try:
        if name == "list_classes":
            return list_classes(tool_input.get("day"))
        if name == "find_free_room_slots":
            return find_free_room_slots(tool_input["date"], jwt)
        if name == "get_my_bookings":
            return get_my_bookings(jwt)
        if name == "get_my_classes":
            return get_my_classes(jwt)
        if name == "search_studio_info":
            return search_studio_info(tool_input["query"])
        if name == "get_cancellation_policy":
            return get_cancellation_policy(jwt)
        return {"error": f"Unknown tool: {name}"}
    except (RuntimeError, KeyError, ValueError, IndexError, TypeError, ClientError, BotoCoreError) as e:
        print(f"TOOL_ERROR {name}: {type(e).__name__}: {e}")
        return {"error": "The tool failed. Tell the customer you could not check this right now."}
