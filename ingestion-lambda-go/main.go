package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbattribute"
)

type TelemetryData struct {
	MachineID  string  `json:"machineId"`
	SensorType string  `json:"sensorType"`
	Value      float64 `json:"value"`
}

type TelemetryRecord struct {
	MachineID  string  `json:"machineId" dynamodbav:"machineId"`
	Timestamp  string  `json:"timestamp" dynamodbav:"timestamp"`
	SensorType string  `json:"sensorType" dynamodbav:"sensorType"`
	Value      float64 `json:"value" dynamodbav:"value"`
	IsIncident bool    `json:"is_incident" dynamodbav:"is_incident"`
	Severity   string  `json:"severity,omitempty" dynamodbav:"severity,omitempty"`
}

var (
	dynamoClient *dynamodb.DynamoDB
	tableName    string
)

func init() {
	sess := session.Must(session.NewSession())
	dynamoClient = dynamodb.New(sess)
	tableName = os.Getenv("DYNAMODB_TABLE")
}

func handler(ctx context.Context, sqsEvent events.SQSEvent) error {
	for _, record := range sqsEvent.Records {
		if err := processMessage(record.Body); err != nil {
			fmt.Printf("Error processing message %s: %v\n", record.MessageId, err)
			// Return error to retry the entire batch
			return err
		}
	}
	return nil
}

func processMessage(body string) error {
	var telemetry TelemetryData
	if err := json.Unmarshal([]byte(body), &telemetry); err != nil {
		return fmt.Errorf("failed to unmarshal: %w", err)
	}

	// Business logic: Check for incidents
	isIncident := false
	severity := ""
	if telemetry.SensorType == "temperature" && telemetry.Value > 90 {
		isIncident = true
		severity = "CRITICAL"
	}
	if telemetry.SensorType == "vibration" && telemetry.Value > 80 {
		isIncident = true
		severity = "WARNING"
	}

	// Create record
	telemetryRecord := TelemetryRecord{
		MachineID:  telemetry.MachineID,
		Timestamp:  time.Now().UTC().Format(time.RFC3339),
		SensorType: telemetry.SensorType,
		Value:      telemetry.Value,
		IsIncident: isIncident,
		Severity:   severity,
	}

	// Save to DynamoDB
	av, err := dynamodbattribute.MarshalMap(telemetryRecord)
	if err != nil {
		return fmt.Errorf("failed to marshal: %w", err)
	}

	input := &dynamodb.PutItemInput{
		TableName: aws.String(tableName),
		Item:      av,
	}

	_, err = dynamoClient.PutItem(input)
	if err != nil {
		return fmt.Errorf("failed to put item: %w", err)
	}

	fmt.Printf("Processed: %s - %s: %.2f (incident: %v)\n",
		telemetry.MachineID, telemetry.SensorType, telemetry.Value, isIncident)

	return nil
}

func main() {
	lambda.Start(handler)
}