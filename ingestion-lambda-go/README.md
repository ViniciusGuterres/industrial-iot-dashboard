# Telemetry Ingestion Lambda (Go)

Go Lambda function that processes telemetry data from SQS and stores in DynamoDB.

## Business Logic

- Receives telemetry from SQS queue
- Checks for incidents:
  - Temperature > 90°C → incident
  - Vibration > 80 → incident
- Stores data in DynamoDB with `is_incident` flag

## Build

```bash
# Install dependencies
go mod download

# Build for Lambda
chmod +x build.sh
./build.sh
```

This creates `bootstrap.zip` ready for Lambda deployment.

## Local Testing

```bash
go run main.go
```

## Environment Variables

- `DYNAMODB_TABLE`: DynamoDB table name (set by CDK)
- `AWS_REGION`: AWS region (set by Lambda runtime)
