import * as cdk from 'aws-cdk-lib';
import * as iot from 'aws-cdk-lib/aws-iot';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface IotStackProps extends cdk.StackProps {
  queue: sqs.Queue;
}

export class IotStack extends cdk.Stack {
  public readonly thingName: string;

  constructor(scope: Construct, id: string, props: IotStackProps) {
    super(scope, id, props);

    // The device identity
    this.thingName = 'Sentinel-Gateway';

    // IoT Thing
    const thing = new iot.CfnThing(this, 'SentinelGateway', {
      thingName: this.thingName
    });

    // IoT Policy
    const policy = new iot.CfnPolicy(this, 'SentinelPolicy', {
      policyName: 'sentinel-gateway-policy',
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['iot:Connect'],
            Resource: `arn:aws:iot:${this.region}:${this.account}:client/${this.thingName}`
          },
          {
            Effect: 'Allow',
            Action: ['iot:Publish'],
            Resource: `arn:aws:iot:${this.region}:${this.account}:topic/sentinel/telemetry`
          },
          {
            Effect: 'Allow',
            Action: ['iot:Subscribe', 'iot:Receive'],
            Resource: `arn:aws:iot:${this.region}:${this.account}:topicfilter/sentinel/*`
          }
        ]
      }
    });

    // IAM Role for IoT Rule to send to SQS
    const iotRuleRole = new iam.Role(this, 'IotRuleRole', {
      assumedBy: new iam.ServicePrincipal('iot.amazonaws.com')
    });
    props.queue.grantSendMessages(iotRuleRole);

    // IoT Rule: Route messages to SQS
    const topicRule = new iot.CfnTopicRule(this, 'TelemetryRule', {
      topicRulePayload: {
        sql: "SELECT * FROM 'sentinel/telemetry'",
        actions: [
          {
            sqs: {
              queueUrl: props.queue.queueUrl,
              roleArn: iotRuleRole.roleArn,
              useBase64: false
            }
          }
        ],
        ruleDisabled: false
      }
    });

    new cdk.CfnOutput(this, 'IotEndpoint', {
      value: `${this.account}.iot.${this.region}.amazonaws.com`,
      description: 'AWS IoT Core endpoint for MQTT connection',
      exportName: 'IndustrialSentinel-IotEndpoint'
    });

    new cdk.CfnOutput(this, 'ThingName', {
      value: this.thingName,
      exportName: 'IndustrialSentinel-ThingName'
    });

    new cdk.CfnOutput(this, 'MqttTopic', {
      value: 'sentinel/telemetry',
      description: 'MQTT topic for publishing telemetry',
      exportName: 'IndustrialSentinel-MqttTopic'
    });
  }
}
