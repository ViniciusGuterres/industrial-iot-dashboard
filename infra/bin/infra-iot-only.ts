#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { DatabaseStack } from '../lib/database-stack';
import { IotStack } from '../lib/iot-stack';
import { ProcessingStack } from '../lib/processing-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

console.log('🚀 Deploying IoT Pipeline Only (No Docker Required)');
console.log('   Account:', env.account || 'NOT SET');
console.log('   Region:', env.region);

// VPC Stack
const vpcStack = new VpcStack(app, 'IndustrialSentinelVpc', { env });

// Database Stack (DynamoDB + SQS only, no RDS)
const databaseStack = new DatabaseStack(app, 'IndustrialSentinelDatabase', {
  env,
  vpc: vpcStack.vpc
});

// IoT Stack
const iotStack = new IotStack(app, 'IndustrialSentinelIot', {
  env,
  queue: databaseStack.ingestionQueue
});

// Processing Stack (Lambda)
const processingStack = new ProcessingStack(app, 'IndustrialSentinelProcessing', {
  env,
  telemetryTable: databaseStack.telemetryTable,
  queue: databaseStack.ingestionQueue
});

console.log('✅ IoT pipeline stacks configured (Node-RED → IoT Core → SQS → Lambda → DynamoDB)');
