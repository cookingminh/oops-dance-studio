# Oops Assistant (AI agent)

A customer-support agent for Oops! Dance Studio. Customers ask in Vietnamese; the agent answers
from three sources:

| Source | Tools | Examples |
|---|---|---|
| Bedrock Knowledge Base (RAG over markdown in S3) | `search_studio_info` | what to bring, house rules, which class for beginners |
| Supabase, shared data | `list_classes`, `find_free_room_slots`, `get_cancellation_policy` | timetable, free rooms, live refund policy |
| Supabase, the customer's own data (RLS) | `get_my_bookings`, `get_my_classes` | their bookings and enrolled classes |

## Architecture

```
caller ──> Lambda oops-agent (ap-southeast-2)
             lambda_function.py   entry point: validates {question, access_token}
             agent.py             agent loop on Bedrock Converse (Claude Haiku 4.5, au inference profile)
             tools.py             tool functions + tool specs; turns raw rows into Vietnamese labels;
                                  RAG search through bedrock-agent-runtime Retrieve (top 3 passages)
             supabase_client.py   HTTP calls to Supabase with the customer's JWT, so RLS applies
             config.py            settings: .env.local locally, SSM Parameter Store on Lambda
```

Design rules:
- Code computes, the model talks: dates, weekdays and statuses are computed in `tools.py`.
- The agent calls Supabase with the customer's JWT and the publishable key only, never the
  secret key, so row-level security limits it to that customer's data.
- No JWTs or customer data in logs: only turn counts, stop reasons, token usage and tool names
  (free-text search queries are logged as their length only).
- One source of truth: anything staff can change in the app (refund policy, support hours) is read from
  Supabase by a tool, never copied into the knowledge files. See `knowledge/README.md`.

## AWS resources

| Resource | Purpose |
|---|---|
| Lambda `oops-agent` | Python, arm64, 256 MB, 60 s timeout |
| IAM role `oops-agent-role` | `AWSLambdaBasicExecutionRole` + inline policy: invoke Haiku (au profile and its two foundation-model regions), `ssm:GetParameter` on `/oops/*`, `bedrock:Retrieve` on the `oops-knowledge` Knowledge Base only |
| SSM `/oops/supabase-url`, `/oops/supabase-anon-key`, `/oops/knowledge-base-id` | Supabase cloud URL, publishable key, Knowledge Base ID |
| S3 bucket `oops-knowledge-063330696503` | Knowledge files; `sample/` holds placeholder content |
| Bedrock Knowledge Base `oops-knowledge` | Self-managed vector store KB: S3 source (`sample/`), default chunking, Titan Text Embeddings V2, S3 Vectors |

Updating knowledge: `aws s3 sync knowledge/sample s3://oops-knowledge-063330696503/sample/`, then Sync the data
source in the Bedrock console (only changed files are re-embedded).

## Local development

```bash
cd agent
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
aws login --profile oops
python scripts/local_test.py "Hôm nay mình có lớp nào?"     # uses agent/.env.local (local Supabase)
```

## Deploy and call

```bash
./scripts/deploy.sh
python scripts/invoke_cloud.py "Hôm nay mình có lớp nào?"   # uses agent/.env.cloud (TEST account only)
```

## Roadmap

1. Deploy to Lambda (done)
2. RAG: knowledge articles -> S3 -> Bedrock Knowledge Base (S3 Vectors) -> `search_studio_info` tool (done, sample content)
3. Evaluation set (20+ questions, several runs each)
4. Staff edit knowledge in the admin app; a sync Lambda updates the Knowledge Base
5. API Gateway with JWT check; replies in the existing support chat (`sender_kind = 'ai'`)
