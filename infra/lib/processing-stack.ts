import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as logs from 'aws-cdk-lib/aws-logs'; // Important for controlling log costs
import { Construct } from 'constructs';

interface ProcessingStackProps extends cdk.StackProps {
  telemetryTable: dynamodb.Table;
  queue: sqs.Queue;
}

export class ProcessingStack extends cdk.Stack {
  public readonly processorLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: ProcessingStackProps) {
    super(scope, id, props);

    this.processorLambda = new lambda.Function(this, 'TelemetryProcessor', {
      functionName: 'sentinel-telemetry-processor',

      // Cost Optimization: Graviton (ARM64) is ~20% cheaper than x86
      architecture: lambda.Architecture.ARM_64,

      // Custom runtime for Go
      runtime: lambda.Runtime.PROVIDED_AL2023, // Use the latest Amazon Linux version
      handler: 'bootstrap', // Standard for Go

      // Ensure the binary was compiled for ARM64
      // Build command: GOOS=linux GOARCH=arm64 go build -o dist/bootstrap main.go
      code: lambda.Code.fromAsset('../ingestion-lambda-go/dist'),

      // If it takes more than 10s to save to DynamoDB, something is wrong. Let it Crashes (Not recommended for production envs)
      // Don't pay for 30s timeout unnecessarily.
      timeout: cdk.Duration.seconds(10),

      // Go is efficient. 128MB is more than enough for the Poc
      memorySize: 128,

      // Economy: Logs deleted after 1 day. (Not recommended for production envs)
      logRetention: logs.RetentionDays.ONE_DAY,

      environment: {
        DYNAMODB_TABLE: props.telemetryTable.tableName
        // AWS_REGION is automatically set by Lambda runtime
      }
    });

    // Permissions- Least Privilege
    props.telemetryTable.grantWriteData(this.processorLambda);
    props.queue.grantConsumeMessages(this.processorLambda);

    // SQS Trigger
    this.processorLambda.addEventSource(
      new lambdaEventSources.SqsEventSource(props.queue, {
        batchSize: 10,
        // Batching window to group messages (reduces cold starts)
        maxBatchingWindow: cdk.Duration.seconds(5)
      })
    );

    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: this.processorLambda.functionName,
      exportName: 'IndustrialSentinel-ProcessorLambda'
    });
  }
}