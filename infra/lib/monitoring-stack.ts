import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';

interface MonitoringStackProps extends cdk.StackProps {
  // IoT Pipeline
  ingestionQueue: sqs.Queue;
  processorLambda: lambda.Function;
  telemetryTable: dynamodb.Table;
  
  // API Layer
  apiGateway: apigateway.RestApi;
  ecsClusterName: string;
  ecsServiceName: string;
  
  // Database
  rdsInstance: rds.DatabaseInstance;
}

export class MonitoringStack extends cdk.Stack {
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // ============================================================
    // CLOUDWATCH DASHBOARD
    // ============================================================
    this.dashboard = new cloudwatch.Dashboard(this, 'SentinelDashboard', {
      dashboardName: 'Industrial-Sentinel-IoT-Dashboard',
      periodOverride: cloudwatch.PeriodOverride.AUTO,
    });

    // ============================================================
    // ROW 1: SYSTEM HEALTH OVERVIEW (For Stakeholders)
    // ============================================================
    this.dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: '📊 Messages Processed (Last Hour)',
        width: 6,
        height: 4,
        metrics: [
          props.processorLambda.metricInvocations({
            statistic: 'Sum',
            period: cdk.Duration.hours(1),
          }),
        ],
      }),
      new cloudwatch.SingleValueWidget({
        title: '⚠️ Critical Incidents Detected',
        width: 6,
        height: 4,
        metrics: [
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedWriteCapacityUnits',
            dimensionsMap: {
              TableName: props.telemetryTable.tableName,
            },
            statistic: 'Sum',
            period: cdk.Duration.hours(1),
          }),
        ],
      }),
      new cloudwatch.SingleValueWidget({
        title: '✅ System Uptime',
        width: 6,
        height: 4,
        metrics: [
          props.processorLambda.metricErrors({
            statistic: 'Sum',
            period: cdk.Duration.hours(1),
          }),
        ],
      }),
      new cloudwatch.SingleValueWidget({
        title: '🚀 API Requests (Last Hour)',
        width: 6,
        height: 4,
        metrics: [
          props.apiGateway.metricCount({
            statistic: 'Sum',
            period: cdk.Duration.hours(1),
          }),
        ],
      })
    );

    // ============================================================
    // ROW 2: IOT TELEMETRY PIPELINE
    // ============================================================
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: '📡 IoT Message Flow (Real-time)',
        width: 12,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/SQS',
            metricName: 'NumberOfMessagesSent',
            dimensionsMap: {
              QueueName: props.ingestionQueue.queueName,
            },
            statistic: 'Sum',
            label: 'Messages from IoT Core',
            color: cloudwatch.Color.BLUE,
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/SQS',
            metricName: 'NumberOfMessagesReceived',
            dimensionsMap: {
              QueueName: props.ingestionQueue.queueName,
            },
            statistic: 'Sum',
            label: 'Messages Consumed by Lambda',
            color: cloudwatch.Color.GREEN,
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: 'AWS/SQS',
            metricName: 'ApproximateNumberOfMessagesVisible',
            dimensionsMap: {
              QueueName: props.ingestionQueue.queueName,
            },
            statistic: 'Average',
            label: 'Queue Backlog',
            color: cloudwatch.Color.ORANGE,
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: '⚡ Lambda Processing Performance',
        width: 12,
        height: 6,
        left: [
          props.processorLambda.metricInvocations({
            statistic: 'Sum',
            label: 'Invocations',
            color: cloudwatch.Color.BLUE,
          }),
          props.processorLambda.metricErrors({
            statistic: 'Sum',
            label: 'Errors',
            color: cloudwatch.Color.RED,
          }),
        ],
        right: [
          props.processorLambda.metricDuration({
            statistic: 'Average',
            label: 'Avg Duration (ms)',
            color: cloudwatch.Color.PURPLE,
          }),
        ],
      })
    );

    // ============================================================
    // ROW 3: DATABASE PERFORMANCE
    // ============================================================
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: '💾 DynamoDB Operations',
        width: 12,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedWriteCapacityUnits',
            dimensionsMap: {
              TableName: props.telemetryTable.tableName,
            },
            statistic: 'Sum',
            label: 'Write Operations',
            color: cloudwatch.Color.GREEN,
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedReadCapacityUnits',
            dimensionsMap: {
              TableName: props.telemetryTable.tableName,
            },
            statistic: 'Sum',
            label: 'Read Operations',
            color: cloudwatch.Color.BLUE,
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'UserErrors',
            dimensionsMap: {
              TableName: props.telemetryTable.tableName,
            },
            statistic: 'Sum',
            label: 'Errors',
            color: cloudwatch.Color.RED,
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: '🗄️ RDS PostgreSQL Performance',
        width: 12,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/RDS',
            metricName: 'DatabaseConnections',
            dimensionsMap: {
              DBInstanceIdentifier: props.rdsInstance.instanceIdentifier,
            },
            statistic: 'Average',
            label: 'Active Connections',
            color: cloudwatch.Color.BLUE,
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: 'AWS/RDS',
            metricName: 'CPUUtilization',
            dimensionsMap: {
              DBInstanceIdentifier: props.rdsInstance.instanceIdentifier,
            },
            statistic: 'Average',
            label: 'CPU %',
            color: cloudwatch.Color.ORANGE,
          }),
        ],
      })
    );

    // ============================================================
    // ROW 4: API & FARGATE PERFORMANCE
    // ============================================================
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: '🌐 API Gateway Traffic',
        width: 12,
        height: 6,
        left: [
          props.apiGateway.metricCount({
            statistic: 'Sum',
            label: 'Total Requests',
            color: cloudwatch.Color.BLUE,
          }),
          props.apiGateway.metric4xxError({
            statistic: 'Sum',
            label: '4xx Errors',
            color: cloudwatch.Color.ORANGE,
          }),
          props.apiGateway.metric5xxError({
            statistic: 'Sum',
            label: '5xx Errors',
            color: cloudwatch.Color.RED,
          }),
        ],
        right: [
          props.apiGateway.metricLatency({
            statistic: 'Average',
            label: 'Latency (ms)',
            color: cloudwatch.Color.PURPLE,
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: '🐳 ECS Fargate Resources',
        width: 12,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ECS',
            metricName: 'CPUUtilization',
            dimensionsMap: {
              ServiceName: props.ecsServiceName,
              ClusterName: props.ecsClusterName,
            },
            statistic: 'Average',
            label: 'CPU %',
            color: cloudwatch.Color.ORANGE,
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ECS',
            metricName: 'MemoryUtilization',
            dimensionsMap: {
              ServiceName: props.ecsServiceName,
              ClusterName: props.ecsClusterName,
            },
            statistic: 'Average',
            label: 'Memory %',
            color: cloudwatch.Color.PURPLE,
          }),
        ],
      })
    );

    // ============================================================
    // ROW 5: ERROR TRACKING & ALARMS
    // ============================================================
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: '🚨 System Errors Overview',
        width: 24,
        height: 6,
        left: [
          props.processorLambda.metricErrors({
            statistic: 'Sum',
            label: 'Lambda Errors',
            color: cloudwatch.Color.RED,
          }),
          props.apiGateway.metric5xxError({
            statistic: 'Sum',
            label: 'API 5xx Errors',
            color: cloudwatch.Color.ORANGE,
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'UserErrors',
            dimensionsMap: {
              TableName: props.telemetryTable.tableName,
            },
            statistic: 'Sum',
            label: 'DynamoDB Errors',
            color: cloudwatch.Color.PURPLE,
          }),
        ],
      })
    );

    // ============================================================
    // ALARMS (Optional - for production)
    // ============================================================
    
    // High error rate alarm
    const lambdaErrorAlarm = new cloudwatch.Alarm(this, 'LambdaHighErrorRate', {
      alarmName: 'Sentinel-Lambda-High-Errors',
      metric: props.processorLambda.metricErrors({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Lambda function has high error rate',
    });

    // Queue backlog alarm
    const queueBacklogAlarm = new cloudwatch.Alarm(this, 'QueueBacklog', {
      alarmName: 'Sentinel-Queue-Backlog',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/SQS',
        metricName: 'ApproximateNumberOfMessagesVisible',
        dimensionsMap: {
          QueueName: props.ingestionQueue.queueName,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 100,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'SQS queue has high backlog',
    });

    // Outputs
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
      exportName: 'IndustrialSentinel-DashboardUrl',
    });

    new cdk.CfnOutput(this, 'DashboardName', {
      value: this.dashboard.dashboardName,
      exportName: 'IndustrialSentinel-DashboardName',
    });
  }
}
