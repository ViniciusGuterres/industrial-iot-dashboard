# Industrial Sentinel - AWS Infrastructure

AWS CDK project for deploying the Industrial Sentinel hybrid architecture.

## Prerequisites

- AWS CLI configured
- Node.js 18+
- AWS CDK CLI: `npm install -g aws-cdk`

## Initial Setup

```bash
cd infra
npm install
npm run build
```

## Deploy

```bash
# Bootstrap CDK (first time)
cdk bootstrap

# Deploy all stacks
npm run deploy

# Deploy specific stack
cdk deploy IndustrialSentinelVpc
cdk deploy IndustrialSentinelDatabase
cdk deploy IndustrialSentinelService
```

## Architecture

### Stacks

1. **VpcStack**: VPC with public and private subnets
2. **DatabaseStack**: DynamoDB for telemetry data
3. **ServiceStack**: ECS Fargate + Application Load Balancer

### Created Resources

- VPC with 2 AZs
- DynamoDB Table: `SentinelTelemetry`
- ECS Cluster: `industrial-sentinel`
- Public Application Load Balancer
- Fargate Service for backend

## Useful Commands

```bash
npm run build     # Compile TypeScript
npm run watch     # Watch mode
cdk diff          # Compare changes
cdk synth         # Generate CloudFormation
npm run destroy   # Remove all resources
```