import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

interface DatabaseStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
}

export class DatabaseStack extends cdk.Stack {
  public readonly telemetryTable: dynamodb.Table;
  public readonly rdsInstance: rds.DatabaseInstance;
  public readonly ingestionQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    // DynamoDB for telemetry data
    this.telemetryTable = new dynamodb.Table(this, 'SentinelTelemetry', {
      tableName: 'SentinelTelemetry',
      partitionKey: { name: 'machineId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true
    });

    this.telemetryTable.addGlobalSecondaryIndex({
      indexName: 'SensorTypeIndex',
      partitionKey: { name: 'sensorType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING }
    });

    // SQS Queue for ingestion with DLQ
    const deadLetterQueue = new sqs.Queue(this, 'IngestionDLQ', {
      queueName: 'sentinel-ingestion-dlq',
      retentionPeriod: cdk.Duration.days(14)
    });

    this.ingestionQueue = new sqs.Queue(this, 'IngestionQueue', {
      queueName: 'sentinel-ingestion-queue',
      visibilityTimeout: cdk.Duration.seconds(300),
      retentionPeriod: cdk.Duration.days(4),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3
      }
    });

    // RDS PostgreSQL for incidents
    this.rdsInstance = new rds.DatabaseInstance(this, 'SentinelDB', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      databaseName: 'sentinel_metrics',
      credentials: rds.Credentials.fromGeneratedSecret('admin'),
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false
    });

    new cdk.CfnOutput(this, 'TelemetryTableName', {
      value: this.telemetryTable.tableName,
      exportName: 'IndustrialSentinel-TelemetryTable'
    });

    new cdk.CfnOutput(this, 'QueueUrl', {
      value: this.ingestionQueue.queueUrl,
      exportName: 'IndustrialSentinel-QueueUrl'
    });

    new cdk.CfnOutput(this, 'RDSEndpoint', {
      value: this.rdsInstance.dbInstanceEndpointAddress,
      exportName: 'IndustrialSentinel-RDSEndpoint'
    });
  }
}