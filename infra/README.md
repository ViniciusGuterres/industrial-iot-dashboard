# Industrial Sentinel - AWS Infrastructure (CDK)

AWS CDK infrastructure for Industrial IoT monitoring system with hybrid MQTT-based architecture.

## 🏗️ Architecture Overview

```
IoT Path (MQTT):
Node-RED → IoT Core → IoT Rule → SQS → Lambda (Go) → DynamoDB

Web Path (HTTPS):
Frontend → API Gateway → Cognito → VPC Link → ALB → ECS (NestJS) → RDS + DynamoDB
```

## 📦 Stack Components

### 1. VpcStack
- VPC with 2 Availability Zones
- Public subnets (ALB)
- Private subnets (Fargate, RDS, Lambda)
- 1 NAT Gateway (~$32/month)

### 2. DatabaseStack
- **DynamoDB**: SentinelTelemetry (PK: machineId, SK: timestamp)
  - Pay-per-request billing
  - GSI: SensorTypeIndex
  - PITR disabled (cost savings)
- **SQS**: sentinel-ingestion-queue
  - Long polling (20s)
  - DLQ with 3 retries
- **RDS PostgreSQL 16.3**: sentinel_metrics
  - t3.micro (free tier eligible)
  - Single-AZ (PoC configuration)
  - 20GB storage (no auto-scaling)
  - Storage encrypted
  - Private subnet only

### 3. AuthStack
- **Cognito User Pool**: sentinel-users
- Self-signup disabled (admin-only)
- Email verification (free)
- Strong password policy (12+ chars)
- Hosted UI domain

### 4. IotStack
- **IoT Thing**: Sentinel-Edge-Gateway-01
- **IoT Policy**: Connect, Publish, Subscribe permissions
- **IoT Rule**: Routes MQTT → SQS
- **Custom Resource**: Fetches real IoT endpoint

### 5. ProcessingStack
- **Lambda (Go)**: sentinel-telemetry-processor
  - ARM64 architecture (20% cheaper)
  - 128MB memory
  - 10s timeout
  - 1-day log retention
  - Batch item failures enabled

### 6. ApiStack
- **API Gateway**: sentinel-web-api (Cognito protected)
- **VPC Link**: Secure tunnel to private ALB
- **Internal ALB**: Private load balancer
- **ECS Fargate**: NestJS backend (0.25 vCPU, 512MB)
- **Container Insights**: Enabled

## 💰 Cost Estimate

| Service | Monthly Cost |
|---------|-------------|
| NAT Gateway | $32.00 |
| ALB | $18.00 |
| ECS Fargate | $15.00 |
| RDS t3.micro | FREE (12 months) |
| API Gateway | $3.50 |
| DynamoDB | $1.25 |
| CloudWatch Logs | $1.00 |
| Lambda + IoT + SQS | $0.25 |
| **Total** | **~$81/month** |

**Daily cost**: ~$2.70
**After free tier**: ~$93/month

## 🚀 Prerequisites

- AWS CLI configured
- Node.js 18+
- Go 1.21+ (for Lambda)
- AWS CDK CLI: `npm install -g aws-cdk`
- Docker (for ECS builds)

## 📋 Deployment

### 1. Build Lambda Function
```bash
cd ../ingestion-lambda-go
go mod download
chmod +x build.sh
./build.sh
# Verify: ls -lh dist/bootstrap
```

### 2. Install Dependencies
```bash
cd ../infra
npm install
npm run build
```

### 3. Bootstrap CDK (First Time)
```bash
cdk bootstrap
```

### 4. Review Changes
```bash
cdk diff
```

### 5. Deploy All Stacks
```bash
cdk deploy --all --outputs-file outputs.json
```

**Deployment time**: 20-30 minutes

### 6. Save Outputs
```bash
cat outputs.json
# Contains all endpoints, IDs, and configuration values
```

## 🔐 Post-Deployment Setup

### IoT Certificates (Manual)
1. AWS Console → IoT Core → Security → Certificates → Create
2. Download 3 files (certificate, private key, Root CA)
3. Activate certificate
4. Attach to Thing: Sentinel-Edge-Gateway-01
5. Attach Policy: Sentinel-Policy-CDK

### Cognito Configuration
```bash
# Get client secret
USER_POOL_ID=$(jq -r '.IndustrialSentinelAuth.UserPoolId' outputs.json)
CLIENT_ID=$(jq -r '.IndustrialSentinelAuth.UserPoolClientId' outputs.json)

aws cognito-idp describe-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-id $CLIENT_ID \
  --query 'UserPoolClient.ClientSecret' \
  --output text

# Create admin user
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username admin@example.com \
  --user-attributes Name=email,Value=admin@example.com Name=email_verified,Value=true \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username admin@example.com \
  --password "YourSecurePassword123!" \
  --permanent
```

### RDS Password
```bash
SECRET_NAME=$(jq -r '.IndustrialSentinelDatabase.RDSSecretName' outputs.json)

aws secretsmanager get-secret-value \
  --secret-id $SECRET_NAME \
  --query SecretString \
  --output text | jq -r .password
```

## 🧪 Testing

### Verify IoT Flow
```bash
# Check SQS messages
QUEUE_URL=$(jq -r '.IndustrialSentinelDatabase.QueueUrl' outputs.json)
aws sqs get-queue-attributes \
  --queue-url $QUEUE_URL \
  --attribute-names ApproximateNumberOfMessages

# Check Lambda logs
aws logs tail /aws/lambda/sentinel-telemetry-processor --follow

# Check DynamoDB
aws dynamodb scan --table-name SentinelTelemetry --limit 5
```

### Verify API
```bash
API_URL=$(jq -r '.IndustrialSentinelApi.ApiUrl' outputs.json)
curl $API_URL/health
# Should return 401 (requires Cognito auth)
```

## 🗑️ Cleanup

### Destroy All Resources
```bash
cdk destroy --all
```

**Time**: 10-15 minutes
**Cost after cleanup**: $0/month

### Verify Cleanup
```bash
aws cloudformation list-stacks \
  --stack-status-filter DELETE_COMPLETE \
  --query 'StackSummaries[?contains(StackName, `IndustrialSentinel`)].StackName'
```

## 📊 Useful Commands

```bash
npm run build          # Compile TypeScript
npm run watch          # Watch mode
cdk diff               # Compare changes
cdk synth              # Generate CloudFormation
cdk deploy <stack>     # Deploy specific stack
cdk destroy --all      # Remove all resources
```

## 🔍 Monitoring

### CloudWatch Logs
- Lambda: `/aws/lambda/sentinel-telemetry-processor`
- ECS: `/aws/ecs/sentinel-backend`

### Metrics
- Lambda invocations, errors, duration
- ECS CPU, memory utilization
- API Gateway requests, latency
- DynamoDB read/write capacity

### Cost Tracking
```bash
aws ce get-cost-and-usage \
  --time-period Start=$(date -u -d '7 days ago' +%Y-%m-%d),End=$(date -u +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost
```

## 🔐 Security Features

- ✅ Fargate in private subnets
- ✅ RDS in private subnets with encryption
- ✅ Cognito authentication on all API routes
- ✅ Secrets Manager for database credentials
- ✅ IoT Core with X.509 certificates
- ✅ Security groups with least privilege
- ✅ VPC Link (no public ECS exposure)

## 📚 Additional Documentation

- [DEPLOYMENT_CHECKLIST.md](../DEPLOYMENT_CHECKLIST.md) - Step-by-step deployment guide
- [CLEANUP_GUIDE.md](CLEANUP_GUIDE.md) - Cost management and cleanup
- [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) - Production hardening checklist
- [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md) - Comprehensive architecture review
- [COGNITO_SETUP.md](../COGNITO_SETUP.md) - Cognito integration guide

## ⚠️ Important Notes

### For PoC/Demo
- ✅ Cost-optimized configuration
- ✅ Single-AZ (acceptable for testing)
- ✅ Minimal resources (sufficient for demo)
- ✅ Easy cleanup with `cdk destroy --all`

### For Production
- ❌ Enable Multi-AZ RDS
- ❌ Enable DynamoDB PITR
- ❌ Add CloudWatch Alarms
- ❌ Increase Fargate to 2+ tasks
- ❌ Enable RDS automated backups
- ❌ Add auto-scaling

## 🎯 Architecture Decisions

### NAT Gateway
**Decision**: Use NAT Gateway (~$32/month)
**Rationale**: Proper security (Fargate in private subnet)
**Alternative**: Public subnet (saves $32/month but less secure)
**Cleanup**: Destroy stack after demo to avoid ongoing costs

### Single-AZ RDS
**Decision**: Single-AZ (saves ~$15/month)
**Rationale**: Acceptable for PoC/testing
**Production**: Enable Multi-AZ for high availability

### ARM64 Lambda
**Decision**: ARM64 architecture
**Rationale**: 20% cheaper, better performance for Go
**Build**: `GOOS=linux GOARCH=arm64 go build`

## 🏆 Best Practices Implemented

- ✅ Infrastructure as Code (CDK)
- ✅ Separation of concerns (6 stacks)
- ✅ Explicit stack dependencies
- ✅ Comprehensive outputs
- ✅ Secrets Manager integration
- ✅ Automatic Docker builds
- ✅ Cost optimization
- ✅ Security hardening
- ✅ Comprehensive documentation

## 📞 Support

For issues or questions:
1. Check documentation in `/infra` folder
2. Review CloudWatch Logs
3. Verify security groups and IAM permissions
4. Check AWS Service Health Dashboard

## 📄 License

MIT