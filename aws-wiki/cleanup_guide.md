# Infrastructure Cleanup & Cost Management

## 💰 Cost Breakdown (With NAT Gateway)

### Hourly Costs
| Service | Hourly Cost | Daily Cost | Monthly Cost |
|---------|-------------|------------|--------------|
| NAT Gateway | $0.045 | $1.08 | $32.40 |
| ALB | $0.025 | $0.60 | $18.00 |
| Fargate (0.25 vCPU, 512MB) | $0.021 | $0.50 | $15.00 |
| RDS t3.micro | $0.017 | $0.41 | $12.50 |
| **Total (Hourly Services)** | **$0.108** | **$2.59** | **$77.90** |

### Usage-Based Costs (Negligible for Testing)
| Service | Cost Model | Estimated |
|---------|------------|-----------|
| IoT Core | $0.08 per 1M messages | $0.08 |
| SQS | $0.40 per 1M requests | $0.10 |
| Lambda | $0.20 per 1M invocations | $0.08 |
| DynamoDB | Pay-per-request | $1.25 |
| API Gateway | $3.50 per 1M requests | $0.50 |
| CloudWatch Logs | $0.50/GB | $1.00 |

**Total Monthly Cost**: ~$81/month
**Daily Cost**: ~$2.70/day
**Weekly Cost**: ~$19/week

---

## 🎯 Cost Management Strategy

### Testing Schedule
```
Week 1: Deploy + Initial Testing (7 days) = $19
Week 2: Integration Testing (7 days) = $19
Week 3: Demo Preparation (7 days) = $19
Week 4: Final Demo + Cleanup (3 days) = $8

Total Testing Cost: ~$65 (vs $81 for full month)
```

### Daily Cleanup Routine
If testing intermittently:
```bash
# End of day - Stop Fargate
aws ecs update-service \
  --cluster industrial-sentinel-cluster \
  --service BackendService \
  --desired-count 0

# Morning - Restart Fargate
aws ecs update-service \
  --cluster industrial-sentinel-cluster \
  --service BackendService \
  --desired-count 1

# Savings: ~$0.50/day when stopped
```

---

## 🗑️ Complete Cleanup (After Demo)

### Option 1: Destroy All Stacks (Recommended)
```bash
cd infra

# Destroy in reverse order (respects dependencies)
cdk destroy IndustrialSentinelApi
cdk destroy IndustrialSentinelProcessing
cdk destroy IndustrialSentinelIot
cdk destroy IndustrialSentinelAuth
cdk destroy IndustrialSentinelDatabase
cdk destroy IndustrialSentinelVpc

# Or destroy all at once
cdk destroy --all
```

**Time**: ~10-15 minutes
**Cost after cleanup**: $0/month

### Option 2: Selective Cleanup (Keep Some Resources)
```bash
# Keep VPC and Auth, destroy expensive services
cdk destroy IndustrialSentinelApi        # Saves $33/month (ALB + Fargate)
cdk destroy IndustrialSentinelDatabase   # Saves $45/month (RDS + NAT)
cdk destroy IndustrialSentinelProcessing # Saves $0.08/month (Lambda)
cdk destroy IndustrialSentinelIot        # Saves $0.08/month (IoT)

# Keep: VPC ($0), Auth ($0)
# Remaining cost: ~$0/month
```

---

## ⚠️ Pre-Cleanup Checklist

### 1. Backup Important Data
```bash
# Export DynamoDB data
aws dynamodb scan \
  --table-name SentinelTelemetry \
  --output json > telemetry-backup.json

# Export RDS data
aws rds create-db-snapshot \
  --db-instance-identifier sentinel-db \
  --db-snapshot-identifier sentinel-final-snapshot
```

### 2. Document Learnings
- [ ] Screenshot CloudWatch metrics
- [ ] Export CloudWatch Logs
- [ ] Document any issues encountered
- [ ] Save CDK outputs for reference

### 3. Verify No Active Connections
```bash
# Check ECS tasks
aws ecs list-tasks --cluster industrial-sentinel-cluster

# Check Lambda invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=sentinel-telemetry-processor \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum
```

---

## 🔍 Cost Monitoring During Testing

### Set Up Budget Alert (One-Time)
```bash
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget file://budget.json \
  --notifications-with-subscribers file://notifications.json
```

**budget.json**:
```json
{
  "BudgetName": "IndustrialSentinel-PoC",
  "BudgetLimit": {
    "Amount": "100",
    "Unit": "USD"
  },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
```

**notifications.json**:
```json
[
  {
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80
    },
    "Subscribers": [
      {
        "SubscriptionType": "EMAIL",
        "Address": "your-email@example.com"
      }
    ]
  }
]
```

### Daily Cost Check
```bash
# Check current month costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -u -d 'month ago' +%Y-%m-%d),End=$(date -u +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=SERVICE
```

---

## 📊 Cost Optimization Tips

### 1. Use CloudFormation Stack Tags
Already implemented in CDK - all resources tagged with stack name.

### 2. Schedule Fargate Downtime
```bash
# Create EventBridge rule to stop Fargate at night
aws events put-rule \
  --name stop-fargate-night \
  --schedule-expression "cron(0 22 * * ? *)" \
  --state ENABLED

# Create EventBridge rule to start Fargate in morning
aws events put-rule \
  --name start-fargate-morning \
  --schedule-expression "cron(0 8 * * ? *)" \
  --state ENABLED
```

### 3. Use AWS Cost Explorer
- Go to AWS Console → Cost Explorer
- Filter by tag: `aws:cloudformation:stack-name = IndustrialSentinel*`
- View daily breakdown

---

## 🚨 Emergency Cleanup (If Costs Spike)

### Immediate Actions
```bash
# 1. Stop Fargate (saves $0.50/day)
aws ecs update-service \
  --cluster industrial-sentinel-cluster \
  --service BackendService \
  --desired-count 0

# 2. Delete NAT Gateway (saves $1.08/day)
# Get NAT Gateway ID
NAT_ID=$(aws ec2 describe-nat-gateways \
  --filter "Name=tag:aws:cloudformation:stack-name,Values=IndustrialSentinelVpc" \
  --query 'NatGateways[0].NatGatewayId' \
  --output text)

# Delete it
aws ec2 delete-nat-gateway --nat-gateway-id $NAT_ID

# 3. Stop RDS (saves $0.41/day)
aws rds stop-db-instance --db-instance-identifier sentinel-db
```

**Immediate savings**: ~$2/day

---

## ✅ Post-Cleanup Verification

### Verify All Resources Deleted
```bash
# Check CloudFormation stacks
aws cloudformation list-stacks \
  --stack-status-filter DELETE_COMPLETE \
  --query 'StackSummaries[?contains(StackName, `IndustrialSentinel`)].StackName'

# Check for orphaned resources
aws ec2 describe-vpcs --filters "Name=tag:Name,Values=*Industrial*"
aws rds describe-db-instances --query 'DBInstances[?contains(DBInstanceIdentifier, `sentinel`)]'
aws dynamodb list-tables --query 'TableNames[?contains(@, `Sentinel`)]'
```

### Check Final Bill
```bash
# Wait 24 hours after cleanup, then check
aws ce get-cost-and-usage \
  --time-period Start=$(date -u -d '2 days ago' +%Y-%m-%d),End=$(date -u +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost
```

---

## 📝 Cleanup Checklist

### Before Cleanup
- [ ] Export all important data
- [ ] Take screenshots of dashboards
- [ ] Document lessons learned
- [ ] Save CDK outputs
- [ ] Verify no active users

### During Cleanup
- [ ] Run `cdk destroy --all`
- [ ] Verify stacks deleted in CloudFormation
- [ ] Check for orphaned resources
- [ ] Delete S3 buckets (if any)
- [ ] Delete CloudWatch Log Groups (optional)

### After Cleanup
- [ ] Verify $0 daily cost after 24 hours
- [ ] Remove budget alerts (optional)
- [ ] Archive project documentation
- [ ] Update cost tracking spreadsheet

---

## 💡 Pro Tips

1. **Set Calendar Reminder**: Schedule cleanup 1 day after demo
2. **Use AWS Cost Anomaly Detection**: Automatically alerts on unusual spending
3. **Tag Everything**: Already done via CDK stack tags
4. **Keep CDK Code**: Easy to redeploy if needed
5. **Document Costs**: Track actual vs estimated for future projects

---

## 🎯 Expected Timeline & Costs

| Phase | Duration | Cost |
|-------|----------|------|
| Initial Deploy | 30 min | $0.05 |
| Week 1 Testing | 7 days | $19.00 |
| Week 2 Integration | 7 days | $19.00 |
| Week 3 Demo Prep | 7 days | $19.00 |
| Demo Day | 1 day | $2.70 |
| Cleanup | 15 min | $0.02 |
| **Total** | **22 days** | **~$60** |

**Budget Recommendation**: $100 (includes buffer)

---

## 🚀 Quick Commands Reference

```bash
# Deploy
cdk deploy --all

# Check costs
aws ce get-cost-and-usage --time-period Start=$(date -u -d '7 days ago' +%Y-%m-%d),End=$(date -u +%Y-%m-%d) --granularity DAILY --metrics BlendedCost

# Stop Fargate (save money overnight)
aws ecs update-service --cluster industrial-sentinel-cluster --service BackendService --desired-count 0

# Start Fargate (resume testing)
aws ecs update-service --cluster industrial-sentinel-cluster --service BackendService --desired-count 1

# Destroy everything
cdk destroy --all

# Verify cleanup
aws cloudformation list-stacks --stack-status-filter DELETE_COMPLETE
```

---

## ✅ Final Notes

- **NAT Gateway is the right choice** for proper security architecture
- **$81/month is reasonable** for a professional PoC
- **Cleanup is easy** with `cdk destroy --all`
- **Budget alerts** will prevent surprises
- **Daily cost is only $2.70** - very affordable for testing

**Your approach is correct!** Deploy, test, demo, destroy. 🎯
