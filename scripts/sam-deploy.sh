#!/usr/bin/env bash
# Full deployment script for the Attendance System.
# Builds, deploys the SAM stack, and optionally configures the frontend.
#
# Usage:
#   ./scripts/sam-deploy.sh                  # Build & deploy
#   ./scripts/sam-deploy.sh --configure      # Also write frontend/config.env.js
#   ./scripts/sam-deploy.sh --guided         # Pass --guided to sam deploy

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="${STACK_NAME:-attendance-system}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIGURE_FRONTEND=false
SAM_EXTRA_ARGS=()

for arg in "$@"; do
  case "$arg" in
    --configure) CONFIGURE_FRONTEND=true ;;
    *) SAM_EXTRA_ARGS+=("$arg") ;;
  esac
done

echo "=== Attendance System Deployment ==="
echo "Region:     $REGION"
echo "Stack:      $STACK_NAME"
echo ""

# ---------- Build ----------
echo "▶ Building SAM application..."
sam build --template-file "$PROJECT_ROOT/template.yaml"

# ---------- Deploy ----------
echo "▶ Deploying stack..."
sam deploy \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  "${SAM_EXTRA_ARGS[@]}"

# ---------- Show outputs ----------
echo ""
echo "▶ Stack outputs:"
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" \
  --output table \
  --region "$REGION"

# ---------- Configure frontend (optional) ----------
if [ "$CONFIGURE_FRONTEND" = true ]; then
  echo ""
  echo "▶ Writing frontend/config.env.js..."

  API_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text)
  POOL_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='CognitoUserPoolId'].OutputValue" --output text)
  CLIENT_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='CognitoUserPoolClientId'].OutputValue" --output text)

  cat > "$PROJECT_ROOT/frontend/config.env.js" <<EOF
window.API_BASE = '$API_URL';
window.AWS_REGION = '$REGION';
window.COGNITO_USER_POOL_ID = '$POOL_ID';
window.COGNITO_USER_POOL_CLIENT_ID = '$CLIENT_ID';
EOF

  echo "   Written to: $PROJECT_ROOT/frontend/config.env.js"
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "  1. Create a Cognito user (see docs/DEPLOYMENT_GUIDE.md, Step 3)"
echo "  2. Configure frontend: run  ./scripts/sam-deploy.sh --configure"
echo "     or edit frontend/config.env.js manually"
echo "  3. Start frontend:  cd frontend && python3 -m http.server 5173"
