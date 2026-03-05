# Cost Sheet: Face Recognition Attendance System

## AWS Rekognition Pricing (2025)

### Image Analysis – Group 1 APIs
*IndexFaces, SearchFacesByImage, CompareFaces*

| Volume (images/month) | Price per Image |
|----------------------|------------------|
| First 1 million      | $0.0010          |
| 1M – 5M              | $0.0008          |
| 5M – 30M             | $0.0006          |
| 30M – 67M            | $0.0004          |

### Image Analysis – Group 2 APIs
*DetectFaces (if used for validation)*

| Volume (images/month) | Price per Image |
|----------------------|------------------|
| First 1 million      | $0.0010         |
| 1M – 5M              | $0.0008         |

### Face Metadata Storage
*Per face vector per month*

| Volume             | Price           |
|--------------------|-----------------|
| Per face vector    | $0.00001/month  |

---

## Estimated Monthly Costs

### Scenario 1: Small Team (50 employees)

| Service      | Usage                      | Estimated Cost |
|-------------|----------------------------|----------------|
| Rekognition | 50 enrollments (IndexFaces) + 1,000 check-ins (SearchFacesByImage) | ~$1.05* |
| DynamoDB    | Low read/write             | ~$1–5          |
| S3          | Minimal storage, 1,000 images | ~$0.50      |
| Lambda      | ~1,100 invocations        | Free tier      |
| API Gateway | ~1,100 requests           | Free tier      |
| **Total**   |                            | **~$3–7/month** |

*Free tier: 1,000 images Group 1 + 1,000 face vectors free for 12 months → **$0** for first year

### Scenario 2: Medium Team (500 employees)

| Service      | Usage                        | Estimated Cost |
|-------------|------------------------------|----------------|
| Rekognition | 500 enrollments + 10,000 check-ins/month | ~$10.50 |
| DynamoDB    | Medium traffic               | ~$5–15         |
| S3          | ~10,000 images (auto-deleted) | ~$1          |
| Lambda      | ~11,000 invocations          | ~$0.50         |
| API Gateway | ~11,000 requests             | ~$0.10         |
| **Total**   |                              | **~$18–27/month** |

### Scenario 3: Large (2,000 employees, 40,000 check-ins/month)

| Service      | Usage                          | Estimated Cost |
|-------------|--------------------------------|----------------|
| Rekognition | 2,000 faces + 40,000 searches  | ~$42           |
| Face storage| 2,000 vectors × $0.00001       | ~$0.02         |
| DynamoDB    | Higher traffic                 | ~$15–30        |
| S3          | Transient uploads              | ~$4            |
| Lambda      | ~42,000 invocations            | ~$2            |
| API Gateway | ~42,000 requests               | ~$0.40         |
| **Total**   |                                | **~$64–79/month** |

---

## AWS Free Tier (First 12 Months)

- **Rekognition Image (Group 1 & 2)**: 1,000 images/month free
- **Face metadata storage**: 1,000 face vectors free
- **Lambda**: 1M requests/month free
- **DynamoDB**: 25 GB storage, 25 read/write capacity units
- **API Gateway**: 1M API calls/month free (first 12 months)
- **S3**: 5 GB, 20,000 GET, 2,000 PUT requests

---

## Cost Optimization Tips

1. Use **lifecycle rules** on S3 to delete uploaded images after 24–48 hours.
2. **Batch enrollment** to reduce IndexFaces calls.
3. **One check-in per day** per employee to cap SearchFacesByImage usage.
4. **Reserved capacity** for DynamoDB if usage is steady and predictable.
5. **CloudWatch retention** for logs set to 7–14 days if not required long-term.

---

*Prices as of February 2025. Verify at [AWS Rekognition Pricing](https://aws.amazon.com/rekognition/pricing/).*
