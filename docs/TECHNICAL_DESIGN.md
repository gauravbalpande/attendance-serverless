# Technical Design Document: Serverless Attendance System Using Face Recognition

## 1. Executive Summary

This document outlines the technical design for a real-time serverless attendance system that uses AWS Rekognition for face recognition, captures images via webcam/mobile, and logs attendance to DynamoDB with analytics capabilities.

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Web/Mobile    │────▶│   S3 Bucket      │────▶│  Lambda (Trigger)    │
│   Frontend      │     │   (Image Upload)  │     │  Face Processing     │
└─────────────────┘     └──────────────────┘     └──────────┬──────────┘
        │                            │                        │
        │                            │                        ▼
        │                            │             ┌─────────────────────┐
        │                            │             │  Amazon Rekognition │
        │                            │             │  - IndexFaces        │
        │                            │             │  - SearchFacesByImage│
        │                            │             └──────────┬──────────┘
        │                            │                        │
        │                            │                        ▼
        │                            │             ┌─────────────────────┐
        │                            │             │  DynamoDB           │
        │                            │             │  - Employees         │
        │                            │             │  - Attendance Logs  │
        └────────────────────────────┴─────────────└─────────────────────┘
```

### 2.2 Component Overview

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Image Capture** | Web App (HTML5 MediaDevices) | Capture face via webcam or file upload |
| **Storage** | AWS S3 | Temporary image storage, static site hosting |
| **Auth** | AWS Cognito | User authentication & authorization |
| **Processing** | AWS Lambda | Orchestrates face detection, matching, logging |
| **Face Recognition** | AWS Rekognition | Face indexing, search, matching |
| **Database** | DynamoDB | Employee registry, attendance records |
| **API** | API Gateway | REST endpoints for frontend |
| **Frontend Host** | S3 + CloudFront | Static website (or EC2 if server-side needed) |

### 2.3 Data Flow

1. **Enrollment (One-time)**: Employee photo uploaded → S3 → Lambda indexes face in Rekognition Collection → Employee ID stored in DynamoDB
2. **Attendance Check-in**: User captures image → S3 (presigned URL) → Lambda triggered → Rekognition SearchFacesByImage → Match found → Log to DynamoDB → Return status
3. **Analytics**: Lambda queries DynamoDB → Aggregate daily/weekly attendance → Return summaries

---

## 3. Backend Workflow

### 3.1 Face Detection → Match → Record Pipeline

```
Image Upload → DetectFaces (optional validation)
            → SearchFacesByImage (match against collection)
            → If similarity > threshold (e.g., 90%)
               → Create attendance record in DynamoDB
               → Return success + timestamp
            → Else
               → Return "Face not recognized"
```

### 3.2 DynamoDB Schema

**Table: employees**
| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| employeeId | String | PK | Unique employee ID |
| faceId | String | - | Rekognition FaceId (for reference) |
| name | String | - | Employee name |
| email | String | - | Contact email |
| department | String | - | Department/team |
| createdAt | String | - | ISO timestamp |
| imageS3Key | String | - | Original enrollment image key |

**Table: attendance**
| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| employeeId | String | PK | Employee ID |
| checkInDate | String | SK | YYYY-MM-DD (partition for daily queries) |
| timestamp | String | - | ISO timestamp of check-in |
| source | String | - | "webcam" \| "mobile" |
| confidence | Number | - | Rekognition match confidence |

**GSI on attendance**: `date-timestamp-index` for querying by date range.

### 3.3 Analytics

- **Daily Summary**: Query attendance by `checkInDate`, count unique employees
- **Weekly Summary**: Aggregate over 7-day windows
- **Export**: Lambda + S3 for CSV/Excel reports (optional)

---

## 4. Frontend Development

### 4.1 Features

- **Login**: Cognito-hosted UI or custom UI with Amplify
- **Capture**: Live webcam preview, capture button, or file upload
- **Status**: Real-time display of "Recognized" / "Not Recognized" with timestamp
- **Dashboard** (optional): View personal attendance history, admin analytics

### 4.2 Hosting Options

| Option | Use Case | Pros |
|--------|----------|------|
| S3 Static + CloudFront | No server-side logic | Cost-effective, scalable |
| EC2 | Custom login, complex server logic | More control |
| Amplify Hosting | Full-stack React/Vue | Built-in CI/CD, auth |

---

## 5. Security and Authentication

### 5.1 Cognito

- User pool for employees/admins
- Identity pool for temporary AWS credentials (S3 upload, API calls)
- MFA support (optional)

### 5.2 IAM Roles & Policies

| Resource | Policy | Scope |
|----------|--------|-------|
| Lambda | `rekognition:SearchFacesByImage`, `rekognition:IndexFaces` | Specific collection |
| Lambda | `dynamodb:PutItem`, `dynamodb:Query`, `dynamodb:GetItem` | Specific tables |
| Lambda | `s3:GetObject` | Specific bucket/prefix |
| Cognito Identity | `s3:PutObject` (presigned) | Upload-only bucket prefix |

### 5.3 Data Protection

- **Encryption at rest**: S3 (SSE-S3 or SSE-KMS), DynamoDB (default encryption)
- **Encryption in transit**: TLS for all API calls
- **Temporary storage**: Images in S3 with lifecycle rule to delete after 24–48 hours
- **Logs**: CloudWatch Logs with retention; no PII in logs

---

## 6. Deployment Architecture

- **Infrastructure as Code**: AWS SAM (Serverless Application Model)
- **CI/CD**: GitHub Actions or AWS CodePipeline (optional)
- **Environments**: Dev, Staging, Prod (parameterized)

---

## 7. Assumptions & Constraints

- Employees are pre-enrolled (face indexed) before attendance checks
- One check-in per employee per day (configurable)
- Images must contain a single, clearly visible face
- Rekognition free tier: 1,000 images/month (Group 1); 1,000 face vectors stored

---

## 8. Deliverables Checklist

- [x] Technical Design Document (this document)
- [ ] Video demonstration
- [ ] GitHub repository with source code
- [ ] Cost sheet for face recognition usage

---

*Document Version: 1.0 | Last Updated: February 2025*
