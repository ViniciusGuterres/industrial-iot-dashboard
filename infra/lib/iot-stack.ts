import * as cdk from 'aws-cdk-lib';
import * as iot from 'aws-cdk-lib/aws-iot';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources'; // necessary for getting the real endpoint
import { Construct } from 'constructs';

interface IotStackProps extends cdk.StackProps {
  queue: sqs.Queue;
}

export class IotStack extends cdk.Stack {
  public readonly thingName: string;
  public readonly iotEndpoint: string;

  constructor(scope: Construct, id: string, props: IotStackProps) {
    super(scope, id, props);

    this.thingName = 'Sentinel-Edge-Gateway-01';

    // 1. IoT Thing (The logical device)
    const thing = new iot.CfnThing(this, 'SentinelGateway', {
      thingName: this.thingName
    });

    // 2. IoT Policy (Perms)
    const policy = new iot.CfnPolicy(this, 'SentinelPolicy', {
      policyName: 'Sentinel-Policy-CDK', // Different name from manual to avoid overwrite conflicts
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

    // 3. IAM Role (Perms to enable the IOT Core talks to the sqs)
    const iotRuleRole = new iam.Role(this, 'IotRuleRole', {
      assumedBy: new iam.ServicePrincipal('iot.amazonaws.com')
    });
    props.queue.grantSendMessages(iotRuleRole);

    // 4. IoT Rule (MQTT -> SQS)
    const topicRule = new iot.CfnTopicRule(this, 'TelemetryRule', {
      ruleName: 'Sentinel_Telemetry_Rule', // Optional
      topicRulePayload: {
        sql: "SELECT * FROM 'sentinel/telemetry'",
        actions: [
          {
            sqs: {
              queueUrl: props.queue.queueUrl,
              roleArn: iotRuleRole.roleArn,
              useBase64: false // Important: False to prevent json with base64
            }
          }
        ],
        ruleDisabled: false
      }
    });

    const getIoTEndpoint = new cr.AwsCustomResource(this, 'GetIoTEndpoint', {
      onCreate: {
        service: 'Iot',
        action: 'describeEndpoint',
        parameters: { endpointType: 'iot:Data-ATS' },
        physicalResourceId: cr.PhysicalResourceId.of('IoTEndpoint'),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({ resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE }),
    });

    this.iotEndpoint = getIoTEndpoint.getResponseField('endpointAddress');

    // Outputs
    new cdk.CfnOutput(this, 'OutputIotEndpoint', {
      value: this.iotEndpoint,
      description: 'Use this endpoint on NODE-RED (Port 8883)',
      exportName: 'Sentinel-IotEndpoint'
    });

    new cdk.CfnOutput(this, 'OutputThingName', {
      value: this.thingName,
      exportName: 'Sentinel-ThingName'
    });
  }
}