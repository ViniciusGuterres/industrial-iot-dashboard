# Deployment Checklist - Industrial Sentinel IoT

## ✅ PRE-DEPLOYMENT

### 1. Prerequisites
- [ ] AWS CLI installed and configured
- [ ] AWS account with admin permissions
- [ ] Node.js 18+ installed
- [ ] Go 1.21+ installed
- [ ] Docker installed (for local testing)
- [ ] Git repository up to date

### 2. Cost Management
- [ ] Set AWS Budget alert ($100)
- [ ] Enable Cost Explorer
- [ ] Note deployment date for cleanup reminder
- [ ] Estimated cost: $2.70/day, $81/month

### 3. Build Lambda Function
```bash
cd ingestion-lambda-go
go mod download
chmod +x build.sh
./build.sh
# Verify: ls -lh dist/bootstrap
```

### 4. Install CDK Dependencies
```bash
cd ../infra
npm install
npm run build
```

---

## 🚀 DEPLOYMENT

### 1. Bootstrap CDK (First Time Only)
```bash
cdk bootstrap
```

### 2. Review Changes
```bash
cdk diff
```

### 3. Deploy All Stacks
```bash
cdk deploy --all --outputs-file outputs.json
```

**Expected time**: 20-30 minutes

### 4. Save Outputs
```bash
cat outputs.json
# Save this file - contains all endpoints and IDs
```

---

## 🔐 POST-DEPLOYMENT (IoT Certificates)

### 1. Create IoT Certificate (AWS Console)
1. Go to: AWS IoT Core → Security → Certificates
2. Click "Create certificate"
3. Download 3 files:
   - Device certificate (xxx-certificate.pem.crt)
   - Private key (xxx-private.pem.key)
   - Amazon Root CA 1 (AmazonRootCA1.pem)
4. Click "Activate"

### 2. Attach Certificate to Thing
1. Go to: AWS IoT Core → Manage → Things
2. Click "Sentinel-Edge-Gateway-01"
3. Security → Certificates → Attach certificate
4. Select the certificate you just created

### 3. Attach Policy to Certificate
1. Go to: AWS IoT Core → Security → Certificates
2. Click your certificate
3. Policies → Attach policies
4. Select "Sentinel-Policy-CDK"

---

## 🔑 POST-DEPLOYMENT (Cognito)

### 1. Get Client Secret
```bash
USER_POOL_ID=$(cat outputs.json | jq -r '.IndustrialSentinelAuth.UserPoolId')
CLIENT_ID=$(cat outputs.json | jq -r '.IndustrialSentinelAuth.UserPoolClientId')

aws cognito-idp describe-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-id $CLIENT_ID \
  --query 'UserPoolClient.ClientSecret' \
  --output text
```

### 2. Create Admin User
```bash
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username admin@example.com \
  --user-attributes Name=email,Value=admin@example.com Name=email_verified,Value=true \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS
```

### 3. Set Permanent Password
```bash
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username admin@example.com \
  --password "YourSecurePassword123!" \
  --permanent
```

---

## 🔧 POST-DEPLOYMENT (Node-RED)

### 1. Get IoT Endpoint
```bash
IOT_ENDPOINT=$(cat outputs.json | jq -r '.IndustrialSentinelIot.OutputIotEndpoint')
echo "IoT Endpoint: $IOT_ENDPOINT"
```

### 2. Configure MQTT Node
1. Open Node-RED: http://localhost:1880
2. Add "mqtt out" node
3. Configure:
   - **Server**: `$IOT_ENDPOINT`
   - **Port**: 8883
   - **Client ID**: Sentinel-Edge-Gateway-01
   - **Topic**: sentinel/telemetry
   - **TLS**: Upload 3 certificate files
4. Deploy flow

### 3. Test MQTT Connection
- Check Node-RED debug panel
- Verify messages in AWS IoT Core → Test → Subscribe to sentinel/telemetry

---

## 🗄️ POST-DEPLOYMENT (Database)

### 1. Get RDS Password
```bash
SECRET_NAME=$(cat outputs.json | jq -r '.IndustrialSentinelDatabase.RDSSecretName')

aws secretsmanager get-secret-value \
  --secret-id $SECRET_NAME \
  --query SecretString \
  --output text | jq -r .password
```

### 2. Run Prisma Migrations (Backend)
```bash
cd ../backend

# Update .env with RDS endpoint and password
RDS_ENDPOINT=$(cat ../infra/outputs.json | jq -r '.IndustrialSentinelDatabase.RDSEndpoint')
RDS_PASSWORD="<from previous step>"

echo "DATABASE_URL=postgresql://admin:$RDS_PASSWORD@$RDS_ENDPOINT:5432/sentinel_metrics" > .env

# Run migrations
npx prisma migrate deploy
npx prisma generate
```

---

## 🧪 TESTING

### 1. Test IoT Flow
```bash
# Check SQS queue
aws sqs get-queue-attributes \
  --queue-url $(cat outputs.json | jq -r '.IndustrialSentinelDatabase.QueueUrl') \
  --attribute-names ApproximateNumberOfMessages
```

### 2. Test Lambda Processing
```bash
# Check Lambda logs
aws logs tail /aws/lambda/sentinel-telemetry-processor --follow
```

### 3. Test DynamoDB
```bash
# Scan table
aws dynamodb scan \
  --table-name SentinelTelemetry \
  --limit 5
```

### 4. Test API Gateway
```bash
API_URL=$(cat outputs.json | jq -r '.IndustrialSentinelApi.ApiUrl')
echo "API URL: $API_URL"

# Test health endpoint (should fail without auth)
curl $API_URL/health
```

### 5. Test Frontend Login
1. Get Cognito domain from outputs.json
2. Open browser to Cognito Hosted UI
3. Login with admin credentials
4. Verify redirect to callback URL

---

## 📊 MONITORING

### 1. CloudWatch Dashboards
- Go to: CloudWatch → Dashboards
- Create custom dashboard with:
  - Lambda invocations
  - ECS CPU/Memory
  - API Gateway requests
  - DynamoDB read/write units

### 2. Set Up Alarms (Optional)
```bash
# Lambda errors
aws cloudwatch put-metric-alarm \
  --alarm-name sentinel-lambda-errors \
  --alarm-description "Alert on Lambda errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1
```

### 3. Cost Monitoring
```bash
# Daily cost check
aws ce get-cost-and-usage \
  --time-period Start=$(date -u -d '1 day ago' +%Y-%m-%d),End=$(date -u +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost
```

---

## ✅ VERIFICATION CHECKLIST

### Infrastructure
- [ ] All 6 stacks deployed successfully
- [ ] VPC created with public/private subnets
- [ ] NAT Gateway operational
- [ ] RDS instance running
- [ ] DynamoDB table created
- [ ] SQS queue created
- [ ] Lambda function deployed
- [ ] ECS cluster running
- [ ] ALB healthy
- [ ] API Gateway deployed

### IoT
- [ ] IoT Thing created
- [ ] IoT Policy attached
- [ ] Certificate created and activated
- [ ] Certificate attached to Thing
- [ ] Policy attached to Certificate
- [ ] Node-RED connected via MQTT
- [ ] Messages flowing to SQS

### Authentication
- [ ] Cognito User Pool created
- [ ] User Pool Client configured
- [ ] Admin user created
- [ ] Can login via Hosted UI

### Data Flow
- [ ] Node-RED → IoT Core ✅
- [ ] IoT Core → SQS ✅
- [ ] SQS → Lambda ✅
- [ ] Lambda → DynamoDB ✅
- [ ] API Gateway → ECS ✅
- [ ] ECS → RDS ✅

---

## 🎯 SUCCESS CRITERIA

### Functional
- [ ] Telemetry data flowing end-to-end
- [ ] Incidents detected (temp > 90, vib > 80)
- [ ] Data visible in DynamoDB
- [ ] API returns data with authentication
- [ ] Frontend displays real-time data

### Performance
- [ ] Lambda execution < 1s
- [ ] API response time < 500ms
- [ ] No throttling errors
- [ ] No DLQ messages

### Cost
- [ ] Daily cost < $3
- [ ] Budget alert configured
- [ ] No unexpected charges

---

## 📝 DOCUMENTATION

### Save These Files
- [ ] outputs.json (all endpoints)
- [ ] IoT certificates (3 files)
- [ ] RDS password (from Secrets Manager)
- [ ] Cognito client secret
- [ ] CloudWatch dashboard screenshots

### Update Documentation
- [ ] Add actual endpoints to README
- [ ] Document any issues encountered
- [ ] Note actual deployment time
- [ ] Record actual costs

---

## 🚨 TROUBLESHOOTING

### Lambda Not Triggering
```bash
# Check SQS queue
aws sqs get-queue-attributes --queue-url <QUEUE_URL> --attribute-names All

# Check Lambda event source mapping
aws lambda list-event-source-mappings --function-name sentinel-telemetry-processor
```

### ECS Task Not Starting
```bash
# Check task status
aws ecs describe-tasks \
  --cluster industrial-sentinel-cluster \
  --tasks $(aws ecs list-tasks --cluster industrial-sentinel-cluster --query 'taskArns[0]' --output text)

# Check logs
aws logs tail /aws/ecs/sentinel-backend --follow
```

### RDS Connection Failed
```bash
# Check security groups
aws ec2 describe-security-groups \
  --filters "Name=tag:aws:cloudformation:stack-name,Values=IndustrialSentinelDatabase"

# Test connection from ECS task
aws ecs execute-command \
  --cluster industrial-sentinel-cluster \
  --task <TASK_ID> \
  --command "nc -zv <RDS_ENDPOINT> 5432" \
  --interactive
```

---

## 🎉 DEPLOYMENT COMPLETE!

**Estimated Total Time**: 1-2 hours

**Next Steps**:
1. Test all functionality
2. Prepare demo
3. Schedule cleanup (after demo)
4. Set calendar reminder to destroy stacks

**Cleanup Command** (after demo):
```bash
cdk destroy --all
```

**Questions?** Check:
- PRODUCTION_READINESS.md
- CLEANUP_GUIDE.md
- ARCHITECTURE_REVIEW.md
