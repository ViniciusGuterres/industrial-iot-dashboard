# Industrial Sentinel: IoT Monitoring PoC - Architecture Documentation

## 1. Project Overview

**Objective**: Proof of Concept (PoC) for an industrial IoT monitoring system simulating a Brazilian car manufacturing plant. The system collects telemetry from machines, detects anomalies in real-time, and visualizes data.

**Timeline**: MVP operational in 48 hours

**Key Requirement**: Demonstrate proficiency in Node-RED, Docker, Shell Scripting, Grafana, integrated with NestJS/Next.js stack, deployed on AWS.

---

## 2. High-Level Architecture

### Hybrid Architecture: Local + AWS Cloud

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EDGE LAYER (On-Premises)                            │
│  ┌────────────┐                                                              │
│  │ Node-RED   │  Simulates industrial sensors                                │
│  │ (Docker)   │  • ROBOT_ARM_01                                              │
│  │            │  • PRESSA_HIDRAULICA_02                                      │
│  └──────┬─────┘                                                              │
└─────────┼────────────────────────────────────────────────────────────────────┘
          │
          │ MQTT over TLS (Port 8883)
          │ Topic: sentinel/telemetry
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AWS CLOUD (<configured-region>)                               │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        IoT Telemetry Pipeline                         │  │
│  │                                                                       │  │
│  │  IoT Core → IoT Rule → SQS → Lambda (Go) → DynamoDB                 │  │
│  │                                                                       │  │
│  │  Business Logic:                                                      │  │
│  │  • Temperature > 90°C → CRITICAL incident                            │  │
│  │  • Vibration > 80 → WARNING incident                                 │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        Web Application Path                           │  │
│  │                                                                       │  │
│  │  Frontend (Next.js) → API Gateway → Cognito Auth →                  │  │
│  │  VPC Link → NLB → ECS Fargate (NestJS) → RDS + DynamoDB             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        Monitoring & Analytics                         │  │
│  │                                                                       │  │
│  │  CloudWatch Dashboard → Metrics from all services                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. AWS Infrastructure (CDK Stacks)

### Stack 1: VpcStack
**Purpose**: Network foundation

**Resources**:
- VPC with 2 Availability Zones
- Public subnets only (NAT Gateway removed for cost savings) // Public subnets are used strictly for PoC cost optimization and are not recommended for production environments.
- CIDR: 10.0.0.0/16

**Cost**: FREE

**File**: `infra/lib/vpc-stack.ts`

---

### Stack 2: DatabaseStack
**Purpose**: Data persistence and message queuing

**Resources**:
- **DynamoDB Table**: `SentinelTelemetry`
  - Partition Key: `machineId` (STRING)
  - Sort Key: `timestamp` (STRING)
  - Billing: On-demand (pay-per-request)
  - GSI: `SensorTypeIndex` (sensorType + timestamp)
  - Point-in-time recovery: Disabled (cost savings)

- **SQS Queue**: `sentinel-ingestion-queue`
  - Visibility timeout: 300s
  - Long polling: 20s (cost optimization)
  - Dead Letter Queue: `sentinel-ingestion-dlq` (3 retries)

- **RDS PostgreSQL 16.3**: `sentinel_metrics`
  - Instance: t3.micro (free tier eligible)
  - Storage: 20GB SSD (encrypted)
  - Single-AZ (PoC configuration)
  - Database: `sentinel_metrics`
  - Username: `<generated-admin-user>` (auto-generated password in Secrets Manager)
  - Public subnet (no NAT Gateway needed) // Public subnets are used strictly for PoC cost optimization and are not recommended for production environments.

**Cost**: ~$1-5/month (DynamoDB + SQS), RDS FREE tier

**File**: `infra/lib/database-stack.ts`

---

### Stack 3: AuthStack
**Purpose**: User authentication and authorization

**Resources**:
- **Cognito User Pool**: `sentinel-users`
  - Self-signup: Disabled (admin creates users)
  - Sign-in: Email only
  - Password policy: 12+ chars, uppercase, lowercase, numbers, symbols
  - MFA: Optional (TOTP via Google Authenticator)
  - Account recovery: Email only

- **Cognito User Pool Client**: `sentinel-nextjs-client`
  - OAuth flows: Authorization Code Grant
  - Scopes: email, openid, profile
  - Callback URLs: localhost:3000 (development)

- **Cognito Domain**: `sentinel-iot-{account-suffix}`
  - Hosted UI for login

**Cost**: FREE (up to 50k MAU)

**File**: `infra/lib/auth-stack.ts`

---

### Stack 4: IotStack
**Purpose**: MQTT message ingestion from edge devices

**Resources**:
- **IoT Thing**: `Sentinel-Edge-Gateway-01`
- **IoT Policy**: `Sentinel-Policy-CDK`
  - Connect permission
  - Publish to `sentinel/telemetry`
  - Subscribe to `sentinel/*`

- **IoT Rule**: `Sentinel_Telemetry_Rule`
  - SQL: `SELECT * FROM 'sentinel/telemetry'`
  - Action: Forward to SQS queue

- **Custom Resource**: Fetches real IoT endpoint
  - Returns: `<account-specific-iot-endpoint>`

**Cost**: ~$1-3/month ($1 per 1M messages)

**File**: `infra/lib/iot-stack.ts`

---

### Stack 5: ProcessingStack
**Purpose**: Process telemetry and detect incidents

**Resources**:
- **Lambda Function**: `sentinel-telemetry-processor`
  - Runtime: Go (custom runtime AL2023)
  - Architecture: ARM64 (20% cheaper than x86)
  - Memory: 128MB
  - Timeout: 10s
  - Log retention: 1 day (cost savings)
  - Trigger: SQS (batch size: 10, batching window: 5s)

**Business Logic**:
```go
if temperature > 90°C → severity = "CRITICAL"
if vibration > 80 → severity = "WARNING"
```

**Cost**: <$1/month

**File**: `infra/lib/processing-stack.ts`

**Source**: `ingestion-lambda-go/main.go`

---

### Stack 6: ApiStack
**Purpose**: Web API and backend services

**Resources**:
- **ECS Cluster**: `industrial-sentinel-cluster`
  - Container Insights: Enabled

- **ECS Fargate Service**: `BackendService`
  - Task: NestJS backend
  - CPU: 256 (0.25 vCPU)
  - Memory: 512MB
  - Desired count: 1
  - Subnet: Public (with public IP, no NAT Gateway) // Public subnets are used strictly for PoC cost optimization and are not recommended for production environments.
  - Image: Built from `backend/Dockerfile`

- **Network Load Balancer**: `InternalNLB`
  - Type: Internal (private)
  - Port: 80 → Fargate:3000
  - Health check: TCP (no /health endpoint needed)

- **API Gateway**: `sentinel-web-api`
  - Type: REST API
  - Stage: prod
  - Throttling: 10 req/s (cost protection)
  - Authorizer: Cognito User Pool

- **VPC Link**: Connects API Gateway to private NLB

**Cost**: ~$18 (NLB) + ~$15 (Fargate) = ~$33/month

**File**: `infra/lib/api-stack.ts`

---

### Stack 7: MonitoringStack
**Purpose**: Real-time monitoring and alerting

**Resources**:
- **CloudWatch Dashboard**: `Industrial-Sentinel-IoT-Dashboard`
  - Row 1: System health overview (for stakeholders)
    - Messages processed (last hour)
    - Critical incidents detected
    - System uptime
    - API requests

  - Row 2: IoT telemetry pipeline
    - Message flow (SQS → Lambda)
    - Lambda performance (invocations, errors, duration)

  - Row 3: Database performance
    - DynamoDB operations (read/write capacity)
    - RDS connections and CPU

  - Row 4: API & Fargate
    - API Gateway traffic (requests, errors, latency)
    - ECS CPU and memory utilization

  - Row 5: Error tracking
    - System-wide error overview

- **CloudWatch Alarms**:
  - Lambda high error rate (>10 errors in 5 min)
  - SQS queue backlog (>100 messages)

**Cost**: ~$3/month (dashboard) + FREE (alarms, first 10 free)

**File**: `infra/lib/monitoring-stack.ts`

---

## 4. Cost Breakdown

### Monthly Costs (Always-On)

| Service | Configuration | Monthly Cost |
|---------|---------------|--------------|
| **NAT Gateway** | ~~1 gateway~~ REMOVED | ~~$32.00~~ **$0.00** | // Public subnets are used strictly for PoC cost optimization and are not recommended for production environments.
| **Network Load Balancer** | Private NLB | $18.00 |
| **ECS Fargate** | 0.25 vCPU, 512MB, 24/7 | $15.00 |
| **RDS PostgreSQL** | t3.micro, 20GB, Single-AZ | **FREE** (12 months) |
| **DynamoDB** | On-demand | $1-5 |
| **Lambda** | ARM64, 128MB | <$1 |
| **SQS** | Standard queue | <$1 |
| **IoT Core** | MQTT messages | $1-3 |
| **Cognito** | User pool | **FREE** (50k MAU) |
| **API Gateway** | REST API, 10 req/s throttle | $3-5 |
| **CloudWatch** | Dashboard + Logs | $3-4 |
| **Secrets Manager** | 1 secret (RDS password) | $0.40 |
| **VPC** | 2 AZs | **FREE** |
| | **TOTAL** | **~$52/month** |

**Daily cost**: ~$1.73/day

**After free tier expires**: ~$64/month

---

## 5. Service Definitions

### A. Edge Layer (Node-RED)
**Container**: `sentinel-edge` (Docker)

**Port**: 1880

**Function**: Simulate industrial sensors

**Logic**:
- Generate data every 10 seconds
- Machines: `ROBOT_ARM_01`, `PRESSA_HIDRAULICA_02`
- Temperature: 80-100°C (random)
- Vibration: 60-100 (random)
- Protocol: MQTT over TLS (port 8883)
- Topic: `sentinel/telemetry`
- Payload:
```json
{
  "machineId": "ROBOT_ARM_01",
  "sensorType": "temperature",
  "value": 95.5,
  "timestamp": "2025-01-09T21:00:00Z"
}
```

**Files**:
- `edge/flows-aws.json` - Template (committed)
- `edge/flows-aws.local.json` - Local config with real endpoint (gitignored)
- `edge/flows.json` - HTTP backup for local testing

---

### B. Backend Layer (NestJS)
**Container**: `sentinel-api` (ECS Fargate)

**Port**: 3000 (internal), exposed via NLB

**Endpoints**:
- `POST /telemetry` - Receive sensor data (legacy, not used in AWS)
- `GET /incidents` - Return list of alerts
- `GET /health` - Health check

**Business Logic**:
- Temperature > 90°C → Create incident with severity `CRITICAL`
- Vibration > 80 → Create incident with severity `WARNING`

**ORM**: Prisma

**Architecture**:
- Service/Controller/DTO pattern
- `CreateTelemetryDto` with validation (class-validator)
- Transactional operations
- Global ValidationPipe enabled

**Files**: `backend/src/`

---

### C. Data Layer

#### DynamoDB
**Table**: `SentinelTelemetry`

**Schema**:
```
PK: machineId (STRING)
SK: timestamp (STRING, ISO 8601)
Attributes:
  - sensorType (STRING): "temperature" | "vibration"
  - value (NUMBER)
  - is_incident (BOOLEAN)
  - severity (STRING): "CRITICAL" | "WARNING" | ""
```

**GSI**: `SensorTypeIndex` (sensorType + timestamp)

#### RDS PostgreSQL
**Database**: `sentinel_metrics`

**Tables** (Prisma schema):
- `machines` - Machine registry
- `telemetry` - Time-series data (legacy, not used in AWS)
- `incidents` - Alert logs

---

### D. Frontend Layer (Next.js)
**Container**: `sentinel-dash` (Docker, local only)

**Port**: 3000

**Function**: Operator dashboard

**Features**:
- Server Components for incident listing
- Client Components for real-time updates (polling every 5s)
- Tailwind CSS styling
- Color-coded alerts (red=CRITICAL, yellow=WARNING)

**Files**: `frontend/src/app/`

---

### E. Analytics Layer (Grafana)
**Status**: Planned (not yet implemented)

**Container**: `sentinel-grafana`

**Port**: 3002

**Function**: Complex dashboards

**Setup**: Datasource provisioned via YAML pointing to PostgreSQL

---

### F. DevOps & Automation

#### CDK Deployment
**Tool**: AWS CDK (TypeScript)

**Commands**:
```bash
# Build Lambda
cd ingestion-lambda-go && ./build.bat

# Deploy all stacks
cd infra
npx cdk bootstrap
npx cdk deploy --all

# Deploy specific stack
npx cdk deploy IndustrialSentinelIot

# Destroy everything
npx cdk destroy --all
```

#### Scripts
- `ingestion-lambda-go/build.bat` - Build Go Lambda for ARM64
- `backend/.dockerignore` - Optimize Docker builds
- `edge/.gitignore` - Protect secrets and certificates

---

## 6. Directory Structure

```
industrial-iot-dashboard/
├── backend/                    # NestJS API
│   ├── src/
│   │   ├── telemetry/         # Telemetry module
│   │   ├── incidents/         # Incidents module
│   │   └── prisma/            # Prisma service
│   ├── prisma/
│   │   └── schema.prisma      # Database schema
│   ├── Dockerfile
│   └── .dockerignore
│
├── frontend/                   # Next.js Dashboard
│   ├── src/
│   │   └── app/
│   ├── Dockerfile
│   └── .env.local
│
├── edge/                       # Node-RED
│   ├── data/
│   │   ├── flows.json         # HTTP backup flow
│   │   └── certs/             # IoT certificates (gitignored)
│   ├── flows-aws.json         # AWS IoT template (committed)
│   ├── flows-aws.local.json   # Local config (gitignored)
│   ├── README.md
│   └── .gitignore
│
├── infra/                      # AWS CDK Infrastructure
│   ├── bin/
│   │   ├── infra.ts           # Main CDK app
│   │   └── infra-iot-only.ts  # IoT-only deployment
│   ├── lib/
│   │   ├── vpc-stack.ts       # VPC (no NAT Gateway. Not recommended in production!)
│   │   ├── database-stack.ts  # DynamoDB + SQS + RDS
│   │   ├── auth-stack.ts      # Cognito
│   │   ├── iot-stack.ts       # IoT Core
│   │   ├── processing-stack.ts # Lambda (Go)
│   │   ├── api-stack.ts       # API Gateway + Fargate
│   │   └── monitoring-stack.ts # CloudWatch Dashboard
│   ├── README.md
│   └── PRODUCTION_READINESS.md
│
├── ingestion-lambda-go/        # Go Lambda Function
│   ├── main.go                # Lambda handler
│   ├── go.mod
│   ├── build.bat              # Windows build script
│   └── dist/
│       └── bootstrap          # Compiled binary (ARM64)
│
├── docker-compose.yml          # Local development
├── architecture.md             # This file
└── README.md                   # Project overview
```

---

## 7. Data Flow

### IoT Telemetry Flow
```
1. Node-RED generates sensor data
   ↓
2. Publishes MQTT message to IoT Core
   Topic: sentinel/telemetry
   Payload: {machineId, sensorType, value, timestamp}
   ↓
3. IoT Rule forwards to SQS
   ↓
4. Lambda polls SQS (batch of 10 messages)
   ↓
5. Lambda applies business logic
   - Parse JSON
   - Check: temp > 90°C → CRITICAL
   - Check: vibration > 80 → WARNING
   - Add incident flag
   ↓
6. Lambda writes to DynamoDB
   Item: {machineId, timestamp, sensorType, value, is_incident, severity}
   ↓
7. Data available for:
   - API queries (via Fargate)
   - CloudWatch Dashboard
   - Future: Grafana
```

### Web Dashboard Flow
```
1. User opens browser → Next.js frontend
   ↓
2. User clicks login → Cognito Hosted UI
   ↓
3. User enters credentials → Cognito validates
   ↓
4. Cognito returns JWT token
   ↓
5. Frontend makes API request with JWT
   GET /incidents
   Authorization: Bearer <token>
   ↓
6. API Gateway validates JWT with Cognito
   ↓
7. API Gateway forwards via VPC Link to NLB
   ↓
8. NLB routes to Fargate (NestJS)
   ↓
9. Fargate queries:
   - DynamoDB (telemetry data)
   - RDS (incident logs)
   ↓
10. Fargate returns JSON response
   ↓
11. Frontend renders dashboard
    - Color-coded alerts
    - Real-time updates (polling every 5s)
```

---

## 8. Security Architecture

### Network Security
- ✅ Fargate in public subnet (no NAT Gateway, cost savings)
- ✅ RDS in public subnet with security groups
- ✅ Security groups with least privilege
- ✅ VPC Link (API Gateway → NLB, no public ECS exposure)

OBS.: Public subnets are used strictly for PoC cost optimization and are not recommended for production environments.

### Authentication & Authorization
- ✅ Cognito User Pool for user management
- ✅ JWT tokens for API authentication
- ✅ API Gateway Cognito Authorizer
- ✅ Self-signup disabled (admin creates users)

### Data Security
- ✅ RDS storage encryption (AES-256)
- ✅ Secrets Manager for database credentials
- ✅ IoT Core with X.509 certificates
- ✅ MQTT over TLS (port 8883)

### Secrets Management
- ✅ RDS password in Secrets Manager
- ✅ IoT certificates in local files (gitignored)
- ✅ Cognito client secret (fetch via AWS CLI)
- ✅ Environment variables for configuration

---

## 9. Deployment Checklist

### Prerequisites
- [x] AWS CLI configured
- [x] Node.js 18+ installed
- [x] Go 1.21+ installed
- [x] Docker Desktop running
- [x] AWS CDK CLI installed

### Build Steps
- [x] Build Go Lambda: `cd ingestion-lambda-go && build.bat`
- [x] Install CDK dependencies: `cd infra && npm install`
- [x] Bootstrap CDK: `npx cdk bootstrap`

### Deploy Steps
- [x] Deploy all stacks: `npx cdk deploy --all`
- [ ] Generate IoT certificates (manual)
- [ ] Create Cognito admin user
- [ ] Configure Node-RED with IoT endpoint
- [ ] Test end-to-end flow

### Post-Deployment
- [ ] Monitor CloudWatch Dashboard
- [ ] Check Lambda logs
- [ ] Verify DynamoDB data
- [ ] Test API endpoints
- [ ] Configure frontend with API Gateway URL

---

## 10. Cost Optimization Strategies

### Implemented
- ✅ Removed NAT Gateway (saves $32/month) // Public subnets are used strictly for PoC cost optimization and are not recommended for production environments.
- ✅ ARM64 Lambda (20% cheaper)
- ✅ DynamoDB on-demand (no idle costs)
- ✅ Single-AZ RDS (saves ~$15/month)
- ✅ 1-day log retention (minimal storage)
- ✅ API Gateway throttling (cost protection)
- ✅ Minimal Fargate resources (0.25 vCPU, 512MB)

### Recommendations
- 💡 Stop Fargate when not testing (saves $15/month)
- 💡 Use RDS snapshots between deploys
- 💡 Monitor costs daily with AWS Cost Explorer
- 💡 Set up billing alerts at $40, $60, $80

---

## 11. Production Readiness

### PoC Grade: A (90/100)
- ✅ Functional architecture
- ✅ Cost-optimized
- ✅ Well-documented
- ✅ Security basics covered

### Production Grade: C+ (75/100)

**Missing for Production**:
- ❌ Multi-AZ RDS (high availability)
- ❌ DynamoDB Point-in-Time Recovery
- ❌ RDS automated backups
- ❌ Auto-scaling (Fargate, Lambda)
- ❌ CloudWatch Alarms with SNS notifications
- ❌ WAF on API Gateway
- ❌ VPC Flow Logs
- ❌ AWS Config for compliance
- ❌ Disaster recovery plan
- ❌ Load testing

---

## 12. Monitoring & Observability

**Metrics**:
- Messages processed (last hour)
- Critical incidents detected
- System uptime
- API requests
- Lambda invocations, errors, duration
- DynamoDB read/write capacity
- RDS connections, CPU
- ECS CPU, memory utilization
- API Gateway traffic, latency

### Logs
- Lambda: `/aws/lambda/sentinel-telemetry-processor`
- ECS: `/aws/ecs/sentinel-backend`

### Alarms
- Lambda high error rate (>10 errors in 5 min)
- SQS queue backlog (>100 messages)

---

## 13. Next Steps

### Immediate (PoC Completion)
- [ ] Generate IoT certificates
- [ ] Configure Node-RED with real endpoint
- [ ] Test MQTT → IoT Core → Lambda → DynamoDB flow
- [ ] Create Cognito test user
- [ ] Test API authentication
- [ ] Verify CloudWatch Dashboard

### Short-term (Demo Preparation)
- [ ] Add Grafana for time-series visualization
- [ ] Create presentation slides
- [ ] Record demo video
- [ ] Document lessons learned

### Long-term (Production)
- [ ] Enable Multi-AZ RDS
- [ ] Add auto-scaling
- [ ] Implement CI/CD pipeline
- [ ] Add comprehensive monitoring
- [ ] Perform load testing
- [ ] Security audit

---

## 14. Troubleshooting

### Common Issues

**Lambda not processing messages**:
- Check SQS queue has messages
- Check Lambda logs for errors
- Verify Lambda has DynamoDB write permissions

**API Gateway returns 401**:
- Verify Cognito token is valid
- Check Cognito Authorizer configuration
- Ensure user exists in User Pool

**Fargate not starting**:
- Check ECS logs
- Verify Docker image built successfully
- Check security group allows NLB traffic

**Node-RED can't connect to IoT Core**:
- Verify certificates are correct
- Check IoT endpoint is correct
- Ensure certificates are attached to Thing

---

## 15. References

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS IoT Core Developer Guide](https://docs.aws.amazon.com/iot/)
- [Amazon Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [AWS Lambda Go Documentation](https://docs.aws.amazon.com/lambda/latest/dg/golang-handler.html)
- [Node-RED Documentation](https://nodered.org/docs/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Next.js Documentation](https://nextjs.org/docs)

---

## 16. License

MIT

---

**Last Updated**: 2025-01-09

**Status**: ✅ Infrastructure deployed, ready for testing

**Budget**: $52/month (within $90 limit)
