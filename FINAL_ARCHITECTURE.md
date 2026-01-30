# Industrial Sentinel - Final Architecture

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    IoT Path (MQTT)                          │
└─────────────────────────────────────────────────────────────┘

Node-RED (MQTT Client)
    ↓ TLS 8883
    ↓ Topic: sentinel/telemetry
AWS IoT Core (Thing: Sentinel-Edge-Gateway-01)
    ↓ IoT Rule
SQS Queue (sentinel-ingestion-queue + DLQ)
    ↓ Trigger (batch 10)
Lambda (Go - ARM64 - 128MB)
    ↓ Write
DynamoDB (SentinelTelemetry)


┌─────────────────────────────────────────────────────────────┐
│                    Web Path (HTTPS)                         │
└─────────────────────────────────────────────────────────────┘

Next.js Frontend
    ↓ Cognito Auth
    ↓ HTTPS
API Gateway (sentinel-web-api)
    ↓ VPC Link
Internal ALB (private)
    ↓ HTTP
ECS Fargate (NestJS - 0.25 vCPU - 512MB)
    ↓ Read/Write
    ├─→ DynamoDB (telemetry history)
    └─→ RDS PostgreSQL (incidents)
```

## 📦 CDK Stacks (6 Total)

### 1. VpcStack
- VPC with 2 AZs
- Public + Private subnets
- 1 NAT Gateway

### 2. DatabaseStack
- **DynamoDB**: SentinelTelemetry (PK: machineId, SK: timestamp)
  - Pay-per-request billing
  - GSI: SensorTypeIndex
  - PITR disabled (cost savings)
- **SQS**: sentinel-ingestion-queue
  - Long polling (20s)
  - DLQ with 3 retries
  - 4-day retention
- **RDS PostgreSQL 16.3**: sentinel_metrics
  - t3.micro (free tier)
  - Single-AZ (cost savings)
  - 20GB storage (no autoscaling)
  - Private subnet only
  - Storage encrypted

### 3. AuthStack
- **Cognito User Pool**: sentinel-users
- Email sign-in
- User Pool Client for Next.js

### 4. IotStack
- **IoT Thing**: Sentinel-Edge-Gateway-01
- **IoT Policy**: Sentinel-Policy-CDK
  - Connect permission
  - Publish to sentinel/telemetry
  - Subscribe to sentinel/*
- **IoT Rule**: Sentinel_Telemetry_Rule
  - SQL: SELECT * FROM 'sentinel/telemetry'
  - Action: Send to SQS
- **Custom Resource**: Gets real IoT endpoint

### 5. ProcessingStack
- **Lambda Function**: sentinel-telemetry-processor
  - Runtime: Go (PROVIDED_AL2023)
  - Architecture: ARM64 (20% cheaper)
  - Memory: 128MB (cost optimized)
  - Timeout: 10s (fail fast)
  - Log retention: 1 day (cost savings)
  - Batch item failures: enabled (resilience)
- **SQS Trigger**: Batch size 10, 5s batching window

### 6. ApiStack
- **API Gateway**: sentinel-web-api (for web only)
- **VPC Link**: Connects API Gateway to internal ALB
- **Internal ALB**: Private load balancer
- **ECS Cluster**: industrial-sentinel
- **Fargate Service**: NestJS backend
  - 0.25 vCPU, 512MB RAM
  - Private subnet
  - Health check: /health

## 🔐 Security Features

| Layer | Security Mechanism |
|-------|-------------------|
| IoT | X.509 certificates + mutual TLS |
| IoT Policy | Least privilege (specific topics) |
| RDS | Private subnet + VPC security groups |
| RDS Data | Storage encryption at rest |
| ECS | Private subnet, no public IP |
| API Gateway | VPC Link (no direct internet to ECS) |
| Cognito | JWT tokens for authentication |
| Secrets | AWS Secrets Manager for RDS password |

## 💰 Monthly Cost Estimate

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| IoT Core | 1M messages | $0.08 |
| SQS | 1M messages, long polling | $0.10 |
| Lambda | ARM64, 128MB, 1M invocations | $0.08 |
| CloudWatch Logs | 1-day retention | $0.10 |
| DynamoDB | Pay-per-request, no PITR | $1.25 |
| RDS t3.micro | Single-AZ, 20GB | **FREE** (12 months) |
| ECS Fargate | 0.25 vCPU, 512MB | $15.00 |
| API Gateway | 1M requests | $3.50 |
| NAT Gateway | 1 gateway | $32.00 |
| **Total** | | **~$52/month** |

After free tier expires: ~$67/month

## 🚀 Deployment Order

```bash
# 1. Install dependencies
cd infra
npm install

# 2. Build Lambda
cd ../ingestion-lambda-go
chmod +x build.sh
./build.sh

# 3. Deploy infrastructure
cd ../infra
cdk bootstrap
cdk deploy --all

# 4. Get outputs
cdk deploy --all --outputs-file outputs.json
```

## 📝 Post-Deployment Steps

### 1. Create IoT Certificates (Manual)
```bash
# AWS Console: IoT Core → Security → Certificates → Create
# Download 3 files:
# - Device certificate
# - Private key
# - Amazon Root CA 1
```

### 2. Attach Certificate to Thing
```bash
# AWS Console: IoT Core → Things → Sentinel-Edge-Gateway-01
# → Certificates → Attach certificate
```

### 3. Attach Policy to Certificate
```bash
# AWS Console: IoT Core → Security → Certificates
# → Policies → Attach → Select "Sentinel-Policy-CDK"
```

### 4. Get RDS Password
```bash
aws secretsmanager get-secret-value \
  --secret-id <RDSSecretName from output> \
  --query SecretString \
  --output text | jq -r .password
```

### 5. Configure Node-RED
- Broker: `<IoT Endpoint from output>`
- Port: 8883
- Topic: sentinel/telemetry
- TLS: Upload 3 certificate files
- Client ID: Sentinel-Edge-Gateway-01

## 📊 Key Metrics to Monitor

- **IoT Core**: Connection status, message rate
- **SQS**: Queue depth, DLQ messages
- **Lambda**: Invocations, errors, duration
- **DynamoDB**: Read/write capacity, throttles
- **RDS**: CPU, connections, storage
- **ECS**: CPU, memory, task count

## ✅ Architecture Benefits

1. **Scalability**: IoT Core handles millions of devices
2. **Cost-Optimized**: ARM64, minimal memory, short timeouts
3. **Resilient**: DLQ, batch failures, health checks
4. **Secure**: Private subnets, VPC Link, encryption
5. **Observable**: CloudWatch Logs (1-day retention)
6. **Maintainable**: Clean stack separation

## 🎯 Next Steps

1. Deploy infrastructure
2. Create IoT certificates
3. Configure Node-RED with MQTT
4. Refactor NestJS backend (remove POST /telemetry)
5. Add Cognito to Next.js frontend
6. Test end-to-end flow
