# Knowledge for the Oops Assistant (RAG source)

Each `.md` file is one topic. Each has a `<file>.metadata.json` sidecar in the Bedrock Knowledge Bases format,
so retrieval can filter by `category` and we can tell sample content from real content (`is_sample`).

`sample/` is **invented placeholder content** for building and testing the pipeline. It must be replaced by
content confirmed by the studio before any real customer talks to the agent. Every sample file says so in its
first line, so the agent can tell testers it is not confirmed.

## What goes here and what does not

| Kind of information | Where it lives | Why |
|---|---|---|
| How things work, rules, advice (how to book, what to bring, which class for beginners) | here (RAG) | changes rarely, written in words |
| Prices, schedules, free rooms, a customer's bookings and classes | Supabase, through tools | changes every day |
| Refund policy numbers, support hours | Supabase settings (`booking_settings`, `site_settings`), through tools | admins change them in the app; a copy here would go stale |

Rule: if staff can change it in the app, the agent reads it from the app, never from these files.

## Writing rules
- One topic per file, short factual sentences, Vietnamese.
- No numbers that also live in the database (prices, hours, refund percentages).
- Flows marked "real" below come from the app's code; everything else in `sample/` is invented.

| File | Based on |
|---|---|
| `thue-phong-tap.md` | real booking flow (half-hour grid, pending until approved, 50% deposit, refund shown before cancelling) + invented details |
| `dang-ky-lop-hoc.md` | real join-request flow (now or next course, staff approve, max 3 waiting) + invented trial and absence rules |
| `chon-lop-cho-nguoi-moi.md`, `chuan-bi-khi-di-tap.md`, `noi-quy-studio.md` | invented |
| `lien-he-va-gui-xe.md` | real support chat behaviour + invented parking |
