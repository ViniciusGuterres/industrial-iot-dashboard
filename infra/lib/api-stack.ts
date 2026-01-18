import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import * as path from 'path';

interface ApiStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  telemetryTable: dynamodb.Table;
  database: rds.DatabaseInstance;
  userPool: cognito.UserPool;
}

export class ApiStack extends cdk.Stack {
  public readonly apiGateway: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // ============================================================
    // 1. ECS CLUSTER
    // ============================================================
    const cluster = new ecs.Cluster(this, 'IndustrialCluster', {
      vpc: props.vpc,
      clusterName: 'industrial-sentinel-cluster',
      containerInsights: true // Metrics monitoring (negligible cost for PoC)
    });

    // ============================================================
    // 2. FARGATE SERVICE (NestJS Backend)
    // ============================================================

    // IAM Role: Allows container to read Secrets and Database
    // CDK creates basic roles, but we reinforce here

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'BackendTask', {
      memoryLimitMiB: 512, // Minimum possible (Economy)
      cpu: 256,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64, // NestJS runs well here
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      }
    });

    // Permissions
    props.telemetryTable.grantReadData(taskDefinition.taskRole);
    props.database.secret?.grantRead(taskDefinition.taskRole); // Read database password

    // Note: Database connection will be configured after security groups are created

    // Container (Building from local code)
    const container = taskDefinition.addContainer('backend', {
      // IMPORTANT: This looks for Dockerfile in ../backend folder and builds automatically!
      image: ecs.ContainerImage.fromAsset(path.join(__dirname, '../../backend')),

      environment: {
        NODE_ENV: 'production',
        DYNAMODB_TABLE_NAME: props.telemetryTable.tableName,
        AWS_REGION: this.region,
        COGNITO_USER_POOL_ID: props.userPool.userPoolId,
        COGNITO_CLIENT_ID: 'FETCH_FROM_SECRETS_IF_NEEDED', // Optional in backend
      },

      // SENIOR SECURITY: Secret Injection (Not hardcoded)
      secrets: {
        // NestJS should build connection URL using these variables
        DB_SECRET: ecs.Secret.fromSecretsManager(props.database.secret!)
      },

      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'sentinel-backend' })
    });

    container.addPortMappings({ containerPort: 3000 });

    // Fargate Security Group
    const fargateSG = new ec2.SecurityGroup(this, 'FargateSG', { vpc: props.vpc });

    const service = new ecs.FargateService(this, 'BackendService', {
      cluster,
      taskDefinition,
      desiredCount: 1,

      // SECURITY: Fargate in private subnet with NAT Gateway
      // NAT Gateway cost: ~$32/month (acceptable for testing, destroy after demo)
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      assignPublicIp: false,
      securityGroups: [fargateSG]
    });


    // ============================================================
    // 3. INTERNAL LOAD BALANCER (ALB)
    // ============================================================
    // Costs ~$18/month. Destroy stack when not in use!

    // ALB Security Group
    const albSG = new ec2.SecurityGroup(this, 'AlbSG', {
      vpc: props.vpc,
      description: 'Security group for internal ALB',
      allowAllOutbound: true
    });

    const lb = new elbv2.ApplicationLoadBalancer(this, 'InternalALB', {
      vpc: props.vpc,
      internetFacing: false, // Private! Only API Gateway accesses.
      securityGroup: albSG
    });

    const listener = lb.addListener('HttpListener', { port: 80 });

    listener.addTargets('FargateTarget', {
      port: 80,
      targets: [service],
      healthCheck: { path: '/health', interval: cdk.Duration.seconds(60) } // NestJS health check
    });

    // SECURITY: Fargate only accepts traffic from Load Balancer
    fargateSG.addIngressRule(albSG, ec2.Port.tcp(3000), 'Allow ALB to Fargate');

    // ALB can reach Fargate
    albSG.addEgressRule(fargateSG, ec2.Port.tcp(3000), 'ALB to Fargate');

    // Allow Fargate to connect to RDS
    props.database.connections.allowFrom(fargateSG, ec2.Port.tcp(5432), 'Fargate to RDS');

    // ============================================================
    // 4. API GATEWAY + COGNITO + VPC LINK
    // ============================================================

    this.apiGateway = new apigateway.RestApi(this, 'WebApi', {
      restApiName: 'sentinel-web-api',
      deployOptions: {
        stageName: 'prod',
        throttlingRateLimit: 10, // Protection against costs
        throttlingBurstLimit: 20
      }
    });

    // VPC Link (The Tunnel between API Gateway and Private ALB)
    const vpcLink = new apigateway.VpcLink(this, 'VpcLink', { targets: [lb] });

    // Cognito Authorizer (The Gatekeeper)
    const auth = new apigateway.CognitoUserPoolsAuthorizer(this, 'SentinelAuth', {
      cognitoUserPools: [props.userPool]
    });

    // Protected Proxy Integration
    this.apiGateway.root.addProxy({
      defaultIntegration: new apigateway.Integration({
        type: apigateway.IntegrationType.HTTP_PROXY,
        integrationHttpMethod: 'ANY',
        // URI needs to be dynamic based on ALB DNS
        uri: `http://${lb.loadBalancerDnsName}/{proxy}`,
        options: {
          connectionType: apigateway.ConnectionType.VPC_LINK,
          vpcLink: vpcLink,
        }
      }),
      defaultMethodOptions: {
        authorizer: auth, // <--- HERE IS THE PROTECTION
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', { value: this.apiGateway.url });
  }
}