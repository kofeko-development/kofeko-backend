#!/usr/bin/env bash
# Run a command against the PRODUCTION database through an SSM tunnel (RDS stays private).
#   bash deploy/aws/with-prod-db.sh npx prisma studio
#   bash deploy/aws/with-prod-db.sh npx prisma migrate status
#   bash deploy/aws/with-prod-db.sh npx ts-node --transpile-only src/scripts/setSuperAdmin.ts
#   bash deploy/aws/with-prod-db.sh            # just hold the tunnel open (GUI tools -> localhost:5433)
# Needs: AWS CLI logged in, and the Session Manager plugin (brew install --cask session-manager-plugin).
set -euo pipefail
cd "$(dirname "$0")/../.."

REGION=ap-south-1
LOCAL_PORT=${LOCAL_PORT:-5433}

command -v session-manager-plugin >/dev/null || {
  echo "Install the Session Manager plugin first: brew install --cask session-manager-plugin"; exit 1; }

output() {
  aws cloudformation describe-stacks --region $REGION --stack-name kofeko \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
INSTANCE_ID=$(output HostInstanceId)
DB_HOST=$(output DbEndpoint)
DB_PASSWORD=$(aws secretsmanager get-secret-value --region $REGION --secret-id kofeko/prod/backend \
  --query SecretString --output text | python3 -c "import json,sys;print(json.load(sys.stdin)['DB_PASSWORD'])")

aws ssm start-session --region $REGION --target "$INSTANCE_ID" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "host=$DB_HOST,portNumber=5432,localPortNumber=$LOCAL_PORT" >/dev/null &
TUNNEL_PID=$!
trap 'kill $TUNNEL_PID 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do nc -z localhost "$LOCAL_PORT" 2>/dev/null && break; sleep 1; done
nc -z localhost "$LOCAL_PORT" || { echo "Tunnel did not open"; exit 1; }

export DATABASE_URL="postgresql://kofeko:${DB_PASSWORD}@localhost:${LOCAL_PORT}/kofeko?sslmode=require"
export DIRECT_URL="$DATABASE_URL"
echo ">>> Connected to PRODUCTION database ($DB_HOST) via localhost:$LOCAL_PORT"

if [ $# -gt 0 ]; then
  "$@"
else
  echo "Tunnel open. Host localhost, port $LOCAL_PORT, database kofeko, user kofeko, SSL required."
  echo "Password: aws secretsmanager get-secret-value --region $REGION --secret-id kofeko/prod/backend --query SecretString --output text | python3 -c \"import json,sys;print(json.load(sys.stdin)['DB_PASSWORD'])\""
  echo "Press Ctrl+C to close."
  wait $TUNNEL_PID
fi
