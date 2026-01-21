# Count all resources
echo "Stacks: $(aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query 'StackSummaries[?contains(StackName, `IndustrialSentinel`)]' | jq length)"
echo "NAT Gateways: $(aws ec2 describe-nat-gateways --filter Name=state,Values=available --query 'NatGateways' | jq length)"
echo "RDS Instances: $(aws rds describe-db-instances --query 'DBInstances' | jq length)"
echo "ECS Services: $(aws ecs list-services --cluster industrial-sentinel-cluster --query 'serviceArns' | jq length)"
echo "Load Balancers: $(aws elbv2 describe-load-balancers --query 'LoadBalancers' | jq length)"




# Single command to see all your CDK stacks
aws cloudformation describe-stacks \
  --query "Stacks[?contains(StackName, 'IndustrialSentinel')].{Name:StackName,Status:StackStatus,Created:CreationTime}" \
  --output table




# See today's costs (Windows compatible)
aws ce get-cost-and-usage \
  --time-period Start=2025-01-09,End=2025-01-10 \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --output table

# Alternative: Simple cost check without grouping
aws ce get-cost-and-usage \
  --time-period Start=2025-01-09,End=2025-01-10 \
  --granularity DAILY \
  --metrics BlendedCost


# Cost by service (corrected syntax)
aws ce get-cost-and-usage \
  --time-period Start=2025-01-09,End=2026-01-20 \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --output table


# Check ECS task status
aws ecs list-tasks --cluster industrial-sentinel-cluster

# Check task details
aws ecs describe-tasks --cluster industrial-sentinel-cluster --tasks <task-arn-from-above>

# Check CloudFormation events (live updates)
aws cloudformation describe-stack-events \
  --stack-name IndustrialSentinelApi \
  --max-items 10 \
  --query "StackEvents[].{Time:Timestamp,Status:ResourceStatus,Type:ResourceType,Reason:ResourceStatusReason}" \
  --output table

# Deploy specific infra services
cd infra
npx cdk deploy IndustrialSentinelIot

AWS Infra list: IndustrialSentinelAuth, IndustrialSentinelProcessing, IndustrialSentinelApi, IndustrialSentinelIot, IndustrialSentinelDatabase, IndustrialSentinelVpc