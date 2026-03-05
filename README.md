# Serverless Attendance System – Face Recognition

Real-time attendance system using AWS Rekognition for face recognition. Captures images via webcam, matches against an employee database, and logs timestamps to DynamoDB.

## Cognito integrated (login required)

This project deploys **Cognito User Pool + API Gateway Cognito authorizer** in the same stack. All API endpoints require:

- `Authorization: Bearer <Cognito ID token>`

## Architecture

```
Web/Mobile → S3 (upload) → Lambda → Rekognition (match) → DynamoDB (log)
                ↓
         Presigned URL API
```

- **S3**: Image uploads, lifecycle rule deletes after 48 hours
- **Lambda**: Face processing, enrollment, analytics
- **Rekognition**: Face collection, SearchFacesByImage
- **DynamoDB**: Employees and attendance logs

## Prerequisites

- [AWS CLI](https://aws.amazon.com/cli/) configured
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- Python 3.12 (for local testing)

## Deployment

See [`docs/DEPLOYMENT_GUIDE.md`](docs/DEPLOYMENT_GUIDE.md) for the full step-by-step deployment guide.

### Quick start

```bash
sam build
sam deploy --guided
```

During `--guided`, accept defaults or set:
- Stack name: `attendance-system`
- AWS Region: e.g. `us-east-1`
- Confirm changes: Y
- Allow SAM CLI IAM role creation: Y
- Disable rollback: N
- Save arguments to config: Y

### 2. Get API endpoint

```bash
aws cloudformation describe-stacks \
  --stack-name attendance-system \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
  --output text
```

### 3. Get Cognito outputs

```bash
aws cloudformation describe-stacks \
  --stack-name attendance-system \
  --query "Stacks[0].Outputs[?OutputKey=='CognitoUserPoolId' || OutputKey=='CognitoUserPoolClientId'].[OutputKey,OutputValue]" \
  --output table
```

### 4. Create a Cognito user (choose one)

#### Option A: AWS Console (simplest)

- Go to **Cognito → User pools → attendance-users-<env>**
- Create a user (email + password)

#### Option B: AWS CLI (admin create user)

```bash
USER_POOL_ID="<from stack output CognitoUserPoolId>"
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "you@example.com" \
  --user-attributes Name=email,Value="you@example.com" Name=email_verified,Value=true \
  --message-action SUPPRESS

aws cognito-idp admin-set-user-password \
  --user-pool-id "$USER_POOL_ID" \
  --username "you@example.com" \
  --password "YourStrongPassword123!" \
  --permanent
```

### 5. Configure the frontend (required changes)

Edit `frontend/config.env.js` and set:

- `window.API_BASE`
- `window.AWS_REGION`
- `window.COGNITO_USER_POOL_ID`
- `window.COGNITO_USER_POOL_CLIENT_ID`

### 6. Deploy frontend to S3

```bash
BUCKET=$(aws cloudformation describe-stacks \
  --stack-name attendance-system \
  --query "Stacks[0].Outputs[?OutputKey=='ImageBucketName'].OutputValue" \
  --output text)

# Create a separate bucket for static hosting (or use the same with different prefix)
STATIC_BUCKET="attendance-frontend-$(aws sts get-caller-identity --query Account --output text)"
aws s3 mb s3://$STATIC_BUCKET --region us-east-1
aws s3 website s3://$STATIC_BUCKET --index-document index.html

# Update config with your API endpoint
API_URL=$(aws cloudformation describe-stacks --stack-name attendance-system \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text)
echo "window.API_BASE = '$API_URL';" > frontend/config.env.js

# Add Cognito values
REGION="us-east-1"
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name attendance-system \
  --query "Stacks[0].Outputs[?OutputKey=='CognitoUserPoolId'].OutputValue" --output text)
CLIENT_ID=$(aws cloudformation describe-stacks --stack-name attendance-system \
  --query "Stacks[0].Outputs[?OutputKey=='CognitoUserPoolClientId'].OutputValue" --output text)

cat >> frontend/config.env.js <<EOF
window.AWS_REGION = '$REGION';
window.COGNITO_USER_POOL_ID = '$USER_POOL_ID';
window.COGNITO_USER_POOL_CLIENT_ID = '$CLIENT_ID';
EOF

# Upload frontend (add config.env.js before app.js in index.html for API URL)
aws s3 sync frontend/ s3://$STATIC_BUCKET --acl public-read
```

### Enable CORS (if using different domain)

The S3 bucket and API Gateway are configured for CORS. For local development, use a simple HTTP server and set `API_BASE` in `config.env.js`.

## Usage

1. **Enroll employees**: Use the "Enroll New Employee" form – capture a photo, enter ID/name, submit.
2. **Check-in**: Click "Start Camera", then "Capture & Check In". The system matches the face and logs attendance.
3. **Analytics**: Daily summary is shown on the main page. Use `GET /analytics?period=weekly&startDate=YYYY-MM-DD` for weekly data.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /upload-url | Get presigned S3 upload URL |
| POST | /check-attendance | Process image and record attendance |
| POST | /enroll | Enroll new employee (index face) |
| GET | /analytics | Daily/weekly attendance summary |

## Security

- **IAM**: Lambda roles use least-privilege policies.
- **Encryption**: S3 and DynamoDB use default encryption at rest.
- **Cognito**: Integrated in `template.yaml` (User Pool + API authorizer).
- **Images**: Lifecycle rule deletes uploads after 2 days.

## Project Structure

```
├── docs/
│   ├── DEPLOYMENT_GUIDE.md
│   ├── TECHNICAL_DESIGN.md
│   └── COST_SHEET.md
├── frontend/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── auth.js
│   ├── config.js
│   └── config.env.js
├── scripts/
│   └── sam-deploy.sh
├── src/handlers/
│   ├── process_attendance.py
│   ├── get_upload_url.py
│   ├── enroll_employee.py
│   └── analytics.py
├── template.yaml
├── samconfig.toml
└── README.md
```

## Deliverables

- [x] Technical Design Document (`docs/TECHNICAL_DESIGN.md`)
- [ ] Video demonstration
- [x] GitHub repository (this project)
- [x] Cost sheet (`docs/COST_SHEET.md`)

## License

MIT
