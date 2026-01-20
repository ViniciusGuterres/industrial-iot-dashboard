#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { DatabaseStack } from '../lib/database-stack';
import { AuthStack } from '../lib/auth-stack';
import { IotStack } from '../lib/iot-stack';
import { ProcessingStack } from '../lib/processing-stack';
import { ApiStack } from '../lib/api-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// VPC Stack - Base networking
const vpcStack = new VpcStack(app, 'IndustrialSentinelVpc', { env });

// Database Stack - DynamoDB + SQS + RDS
const databaseStack = new DatabaseStack(app, 'IndustrialSentinelDatabase', {
  env,
  vpc: vpcStack.vpc
});

// Auth Stack - Cognito
const authStack = new AuthStack(app, 'IndustrialSentinelAuth', { env });

// IoT Stack - IoT Core + Thing + Rule
const iotStack = new IotStack(app, 'IndustrialSentinelIot', {
  env,
  queue: databaseStack.ingestionQueue
});

// Processing Stack - Lambda (Go) triggered by SQS
const processingStack = new ProcessingStack(app, 'IndustrialSentinelProcessing', {
  env,
  telemetryTable: databaseStack.telemetryTable,
  queue: databaseStack.ingestionQueue
});

// API Stack - API Gateway + ECS Fargate (NestJS)
const apiStack = new ApiStack(app, 'IndustrialSentinelApi', {
  env,
  vpc: vpcStack.vpc,
  telemetryTable: databaseStack.telemetryTable,
  database: databaseStack.rdsInstance,
  userPool: authStack.userPool,
  fargateSecurityGroup: databaseStack.fargateSecurityGroup // Pass SG from DatabaseStack
});