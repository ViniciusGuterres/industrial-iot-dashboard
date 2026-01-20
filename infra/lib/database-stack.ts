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
  public readonly fargateSecurityGroup: ec2.SecurityGroup; // Export SG

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    // 1. DynamoDb (Telemetry Data)
    this.telemetryTable = new dynamodb.Table(this, 'SentinelTelemetry', {
      tableName: 'SentinelTelemetry',
      partitionKey: { name: 'machineId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING }, // Use Number if Unix Timestamp, String if ISO

      // Billing Mode: PAY_PER_REQUEST it is great for a PoC (no scales).
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,

      removalPolicy: cdk.RemovalPolicy.DESTROY, // It Cleans everything on destroy stack
      pointInTimeRecovery: false // Economy, keep it false to prevent backup and additional billing
    });

    // GSI
    this.telemetryTable.addGlobalSecondaryIndex({
      indexName: 'SensorTypeIndex',
      partitionKey: { name: 'sensorType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING }
    });

    // 2. SQS (Ingestion Buffer)
    const deadLetterQueue = new sqs.Queue(this, 'IngestionDLQ', {
      queueName: 'sentinel-ingestion-dlq',
      retentionPeriod: cdk.Duration.days(14)
    });

    this.ingestionQueue = new sqs.Queue(this, 'IngestionQueue', {
      queueName: 'sentinel-ingestion-queue',
      visibilityTimeout: cdk.Duration.seconds(300), // It guarantees the lambda process < 5 min
      retentionPeriod: cdk.Duration.days(4),
      receiveMessageWaitTime: cdk.Duration.seconds(20), // Economy: Long Polling activated
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3
      }
    });

    // 3. RDS (PostgreSQL for Incidents)
    this.rdsInstance = new rds.DatabaseInstance(this, 'SentinelDB', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_3 // Use a lts version
      }),
      // Economy: t3.micro or t4g.micro are cheap
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),

      vpc: props.vpc,
      // Security: It keeps the database private. Only Lambda/ECS at the same VPC can access.
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },

      databaseName: 'sentinel_metrics',

      // It generates password in the Secrets Manager (~$0.40/mês). 
      credentials: rds.Credentials.fromGeneratedSecret('admin'),

      allocatedStorage: 20, // Free tier exact limit
      maxAllocatedStorage: 20, // Security: Prevents auto-scaling (not recommended for production env)

      multiAz: false, // Economy: Guarantees Single-AZ (not recommended for production env)
      publiclyAccessible: false, // Security: Only VPC can access
      storageEncrypted: true, // Security: Encryption at rest (free tier eligible)

      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,

      // Optional: Disable automated backups (saves ~$0.10/GB/month)
      // WARNING: No automated recovery possible
      // backupRetention: cdk.Duration.days(0),

    });

    // Create Fargate Security Group here to avoid circular dependency
    this.fargateSecurityGroup = new ec2.SecurityGroup(this, 'FargateSG', {
      vpc: props.vpc,
      description: 'Security group for Fargate tasks',
      allowAllOutbound: true
    });

    // Allow Fargate to connect to RDS
    this.rdsInstance.connections.allowFrom(this.fargateSecurityGroup, ec2.Port.tcp(5432), 'Fargate to RDS');

    // Security: RDS connections are managed by security groups in api-stack.ts
    // No need to explicitly allow connections here

    // OUTPUTS
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

    // Util for you to get the secret later via AWS CLI
    new cdk.CfnOutput(this, 'RDSSecretName', {
      value: this.rdsInstance.secret?.secretName || '',
      exportName: 'IndustrialSentinel-RDSSecretName'
    });
  }
}