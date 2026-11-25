#!/usr/bin/env bash
# Package agent/lambda_src and upload it to the oops-agent Lambda.
# Only the five runtime files are zipped: no tests, no scripts, no .env files.
set -euo pipefail

FUNCTION=oops-agent
REGION=ap-southeast-2
PROFILE=${AWS_PROFILE:-oops}

cd "$(dirname "$0")/../lambda_src"
ZIP="$(mktemp -d)/$FUNCTION.zip"
zip -q "$ZIP" lambda_function.py agent.py tools.py supabase_client.py config.py
unzip -l "$ZIP"

aws lambda update-function-code --profile "$PROFILE" --region "$REGION" \
  --function-name "$FUNCTION" --zip-file "fileb://$ZIP" --no-cli-pager \
  --query "{Size:CodeSize,Update:LastUpdateStatus}"
aws lambda wait function-updated --profile "$PROFILE" --region "$REGION" --function-name "$FUNCTION"
echo "Deployed $FUNCTION"
