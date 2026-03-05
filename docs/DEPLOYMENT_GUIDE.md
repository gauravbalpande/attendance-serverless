# Deployment Guide — Serverless Attendance System

> Single-stack deployment. Cognito User Pool, API Gateway authorizer, Lambda functions, DynamoDB tables, S3 bucket, and Rekognition are all in **one** `template.yaml`.

---

## Prerequisites

| Tool | Install |
|------|---------|
| AWS CLI v2 | [Install guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) |
| AWS SAM CLI | [Install guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) |
| Python 3.12 | Required by Lambda runtime |

Verify prerequisites:

```bash
aws --version          # aws-cli/2.x
sam --version          # SAM CLI, 1.x
python3 --version      # Python 3.12+
aws sts get-caller-identity  # Must return your account info
```

---

## Step 1 — Build & Deploy the Stack

```bash
# From the project root
sam build
sam deploy --guided
```

**Recommended responses during `--guided`:**

| Prompt | Value |
|--------|-------|
| Stack name | `attendance-system` |
| AWS Region | `us-east-1` (or your preferred region) |
| Parameter `Environment` | `dev` |
| Confirm changes before deploy | `Y` |
| Allow SAM CLI IAM role creation | `Y` |
| Disable rollback | `N` |
| Save arguments to `samconfig.toml` | `Y` |
| `ProcessAttendanceFunction` has no auth, OK? | `Y` (S3 trigger events bypass API auth) |

> **Subsequent deploys**: Just run `sam build && sam deploy`. The config is saved in `samconfig.toml`.

---

## Step 2 — Collect Stack Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name attendance-system \
  --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" \
  --output table
```

You will get these values (save them for the next steps):

| Output Key | Description |
|---|---|
| `ApiEndpoint` | API Gateway base URL |
| `ImageBucketName` | S3 bucket for face images |
| `CollectionId` | Rekognition collection name |
| `CognitoUserPoolId` | Cognito User Pool ID |
| `CognitoUserPoolClientId` | Cognito App Client ID |

---

## Step 3 — Create a Cognito User

### Option A — AWS Console (simplest)

1. Go to **Amazon Cognito → User pools → `attendance-users-dev`**
2. Click **Create user**
3. Enter an email address and a password (min 8 chars, uppercase, lowercase, number)

### Option B — AWS CLI

```bash
USER_POOL_ID="<CognitoUserPoolId from Step 2>"

# Create user
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "you@example.com" \
  --user-attributes Name=email,Value="you@example.com" Name=email_verified,Value=true \
  --message-action SUPPRESS

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id "$USER_POOL_ID" \
  --username "you@example.com" \
  --password "YourStrongPassword123!" \
  --permanent
```

---

## Step 4 — Configure the Frontend

Edit `frontend/config.env.js` and **uncomment + fill** the values from Step 2:

```js
window.API_BASE = 'https://<apiId>.execute-api.<region>.amazonaws.com/Prod';
window.AWS_REGION = '<region>';
window.COGNITO_USER_POOL_ID = '<CognitoUserPoolId>';
window.COGNITO_USER_POOL_CLIENT_ID = '<CognitoUserPoolClientId>';
```

Or auto-generate it:

```bash
STACK="attendance-system"
REGION="us-east-1"

API_URL=$(aws cloudformation describe-stacks --stack-name $STACK \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text)
POOL_ID=$(aws cloudformation describe-stacks --stack-name $STACK \
  --query "Stacks[0].Outputs[?OutputKey=='CognitoUserPoolId'].OutputValue" --output text)
CLIENT_ID=$(aws cloudformation describe-stacks --stack-name $STACK \
  --query "Stacks[0].Outputs[?OutputKey=='CognitoUserPoolClientId'].OutputValue" --output text)

cat > frontend/config.env.js <<EOF
window.API_BASE = '$API_URL';
window.AWS_REGION = '$REGION';
window.COGNITO_USER_POOL_ID = '$POOL_ID';
window.COGNITO_USER_POOL_CLIENT_ID = '$CLIENT_ID';
EOF
```

---

## Step 5 — Run the Frontend Locally

```bash
cd frontend
python3 -m http.server 5173
```

Open **http://localhost:5173** in your browser.

---

## Step 6 — Deploy Frontend to S3 (Optional)

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION="us-east-1"
STATIC_BUCKET="attendance-frontend-$ACCOUNT_ID"

# Create hosting bucket
aws s3 mb "s3://$STATIC_BUCKET" --region "$REGION"
aws s3 website "s3://$STATIC_BUCKET" --index-document index.html

# Upload files
aws s3 sync frontend/ "s3://$STATIC_BUCKET" --acl public-read

echo "Frontend URL: http://$STATIC_BUCKET.s3-website-$REGION.amazonaws.com"
```

---

## Step 7 — Verify Everything Works

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Open the frontend and **log in** with the Cognito user from Step 3 | Status shows "Logged in" |
| 2 | **Start Camera** and click **Capture & Check In** (before enrolling) | "No matching face found" message |
| 3 | Fill in the **Enroll New Employee** form, capture photo, submit | "Employee enrolled successfully" |
| 4 | Click **Capture & Check In** again | "Check-in Successful" with timestamp |
| 5 | Check **Today's Summary** section | Shows 1 employee checked in |

---

## Teardown

To delete all resources:

```bash
# Empty the S3 bucket first (required before stack deletion)
BUCKET=$(aws cloudformation describe-stacks --stack-name attendance-system \
  --query "Stacks[0].Outputs[?OutputKey=='ImageBucketName'].OutputValue" --output text)
aws s3 rm "s3://$BUCKET" --recursive

# Delete the stack
sam delete --stack-name attendance-system --no-prompts

# Delete frontend bucket if created
# aws s3 rb "s3://attendance-frontend-<account-id>" --force
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `sam deploy` fails with S3 bucket error | Run `sam deploy --guided` or ensure `resolve_s3 = true` in `samconfig.toml` |
| API returns `401 Unauthorized` | Ensure you're passing `Authorization: Bearer <id_token>` header. Log in via the UI first |
| "No matching face found" | Enroll the employee first via the Enroll form |
| Rekognition `InvalidParameterException` | Image must contain a clearly visible face with good lighting |
| Frontend shows "Cognito not configured" | Fill in `frontend/config.env.js` with the stack output values |
| `sam build` fails | Ensure Python 3.12 is installed and on your PATH |

---

## Configuration Reference

| Setting | File | Description |
|---------|------|-------------|
| API URL & Cognito IDs | `frontend/config.env.js` | **Required** – set after deploy |
| Environment (dev/staging/prod) | `samconfig.toml` → `parameter_overrides` | Controls resource naming |
| Face match threshold | `src/handlers/process_attendance.py` → `SIMILARITY_THRESHOLD` | Default: 90% |
| Image retention | `template.yaml` → `ExpirationInDays` | Default: 2 days |
| CORS origins | `template.yaml` → `AllowOrigin` | Default: `*` (tighten for production) |
