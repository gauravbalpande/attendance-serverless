# Video Demonstration Checklist

Use this checklist when recording your demo video.

## 1. Architecture Overview (1–2 min)
- [ ] Show system architecture diagram (from TECHNICAL_DESIGN.md)
- [ ] Briefly explain: S3 → Lambda → Rekognition → DynamoDB
- [ ] Mention Cognito for optional auth

## 2. Deployment (1–2 min)
- [ ] Run `sam build` and `sam deploy`
- [ ] Show CloudFormation stack creation
- [ ] Display outputs: ApiEndpoint, ImageBucketName

## 3. Enroll Employee (1 min)
- [ ] Open frontend
- [ ] Enter employee ID, name, department
- [ ] Capture photo via webcam
- [ ] Click Enroll
- [ ] Show success message

## 4. Check-in Flow (1–2 min)
- [ ] Start camera
- [ ] Capture face
- [ ] Show "Check-in Successful" with timestamp
- [ ] (Optional) Try with unenrolled face → show "Not Recognized"

## 5. Analytics (30 sec)
- [ ] Show today's summary (unique employees, total check-ins)
- [ ] (Optional) Call GET /analytics?period=weekly

## 6. AWS Console Walkthrough (1 min)
- [ ] DynamoDB: employees and attendance tables
- [ ] Rekognition: face collection
- [ ] S3: lifecycle rule for image cleanup

## Suggested Tools
- **Screen recording**: OBS, Loom, QuickTime
- **Duration**: 5–7 minutes
- **Format**: MP4, 1080p
