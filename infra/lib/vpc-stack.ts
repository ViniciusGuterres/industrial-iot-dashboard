import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class VpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, 'IndustrialVpc', {
      maxAzs: 2,
      natGateways: 1, // Cost: ~$32/month - Consider 0 if using public subnets for Fargate
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }
      ]
    });

    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      exportName: 'IndustrialSentinel-VpcId'
    });
  }
}