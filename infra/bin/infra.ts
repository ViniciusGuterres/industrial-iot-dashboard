#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { DatabaseStack } from '../lib/database-stack';
import { AuthStack } from '../lib/auth-stack';
import { IotStack } from '../lib/iot-stack';
import { ProcessingStack } from '../lib/processing-stack';
import { ApiStack } from '../lib/api-stack';
import { MonitoringStack } from '../lib/monitoring-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

console.log('CDK Environment::::');
console.log('   Account:', env.account || 'NOT SET');
console.log('   Region:', env.region);

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

// Monitoring Stack - CloudWatch Dashboard
const monitoringStack = new MonitoringStack(app, 'IndustrialSentinelMonitoring', {
  env,
  ingestionQueue: databaseStack.ingestionQueue,
  processorLambda: processingStack.processorLambda,
  telemetryTable: databaseStack.telemetryTable,
  apiGateway: apiStack.apiGateway,
  ecsClusterName: 'industrial-sentinel-cluster',
  ecsServiceName: 'BackendService',
  rdsInstance: databaseStack.rdsInstance,
});

console.log('\n📊 Monitoring Dashboard will be created at:');
console.log('   https://console.aws.amazon.com/cloudwatch/home?region=' + env.region + '#dashboards:name=Industrial-Sentinel-IoT-Dashboard');