import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain; // Required for Hosted UI

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. USER POOL (The User Directory)
    this.userPool = new cognito.UserPool(this, 'SentinelUsers', {
      userPoolName: 'sentinel-users',

      // SECURITY: Blocks public signup. Only admin creates users.
      selfSignUpEnabled: false,

      signInAliases: { email: true }, // Login via Email

      // FREE TIER GUARDRAIL: Only uses Email (Free). 
      // If you enable phone/SMS, you pay for SMS delivery.
      autoVerify: { email: true },

      // OPTIONAL: Enable MFA with TOTP (free - Google Authenticator)
      // mfa: cognito.Mfa.OPTIONAL,
      // mfaSecondFactor: { sms: false, otp: true },

      // OPTIONAL: Advanced security (free for 50k MAUs)
      // advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,

      passwordPolicy: {
        minLength: 12, // Strong password (Enterprise Standard)
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(3),
      },

      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY // Ok for PoC
    });

    // 2. APP CLIENT (The Next.js Integration)
    this.userPoolClient = this.userPool.addClient('NextJsClient', {
      userPoolClientName: 'sentinel-nextjs-client',
      generateSecret: true, // Required for NextAuth.js (Server side)

      authFlows: {
        userPassword: true,
        userSrp: true,
      },

      oAuth: {
        flows: {
          authorizationCodeGrant: true, // OIDC/OAuth2 Standard
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE
        ],
        // IMPORTANT: Allowed URLs. 
        // Added localhost for development.
        callbackUrls: [
          'http://localhost:3000/api/auth/callback/cognito',
          'http://localhost:3000'
        ],
        logoutUrls: [
          'http://localhost:3000'
        ]
      }
    });

    // 3. DOMAIN (AWS Login Screen)
    // To use Hosted UI (ready-made login screen), we need a domain prefix.
    // Use a simple static prefix to avoid account ID issues
    const timestamp = Date.now().toString().substring(0, 8);
    this.userPoolDomain = this.userPool.addDomain('SentinelDomain', {
      cognitoDomain: {
        // Must be globally unique, lowercase alphanumeric and hyphens only
        domainPrefix: `sentinel-dash-${timestamp}`
      }
    });

    // OUTPUTS
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: 'IndustrialSentinel-UserPoolId'
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      exportName: 'IndustrialSentinel-UserPoolClientId'
    });

    new cdk.CfnOutput(this, 'UserPoolClientSecret', {
      // Note: Secret is not exported by default for security, 
      // but for PoC it's easier to get from Console.
      value: 'Check AWS Console or use AWS CLI',
    });

    new cdk.CfnOutput(this, 'UserPoolIssuer', {
      value: `https://cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}`,
      exportName: 'IndustrialSentinel-IssuerUrl'
    });

    new cdk.CfnOutput(this, 'CognitoDomain', {
      value: this.userPoolDomain.baseUrl(),
      exportName: 'IndustrialSentinel-CognitoDomain'
    });
  }
}