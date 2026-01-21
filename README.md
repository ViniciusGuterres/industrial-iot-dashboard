# Industrial Sentinel IoT Dashboard

A proof-of-concept industrial IoT monitoring system simulating real-time telemetry collection, anomaly detection, and visualization for a car manufacturing plant.

## Architecture

<img width="1294" height="667" alt="image" src="https://github.com/user-attachments/assets/f55ce2c6-e544-46dc-8264-ccaeabe259f9" />


This system uses a containerized microservices architecture with the following components:

- **Edge Layer**: Node-RED simulates industrial sensors (temperature, vibration)
- **Backend API**: NestJS handles data ingestion, validation, and business logic
- **Database**: PostgreSQL stores time-series telemetry and incident logs
- **Frontend**: Next.js dashboard for real-time incident monitoring
- **Analytics**: Grafana for time-series visualization (planned)

## Tech Stack

- **Backend**: NestJS, Prisma ORM, TypeScript
- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS
- **Edge**: Node-RED
- **Database**: PostgreSQL 15
- **DevOps**: Docker, Docker Compose

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- npm or yarn

## Quick Start

### 1. Clone the repository

```bash
git clone <repository-url>
cd industrial-iot-dashboard
```

### 2. Start all services

```bash
docker-compose up -d
```

This will start:
- PostgreSQL database (port 5433)
- NestJS backend API (port 3001)
- Node-RED edge simulator (port 1880)
- Next.js frontend dashboard (port 3000)

### 3. Run database migrations

```bash
cd backend
npx prisma migrate dev
```

## Business Logic

The system monitors two machines:
- `ROBOT_ARM_01`
- `PRESSA_HIDRAULICA_02`

### Alert Rules

- **CRITICAL**: Temperature > 90°C
- **WARNING**: Vibration > 80

Alerts are automatically generated and displayed on the dashboard in real-time.

## Docker Commands

### Start all services
```bash
docker-compose up -d
```

### Start individual services
```bash
docker-compose up -d sentinel-db
docker-compose up -d sentinel-api
docker-compose up -d sentinel-edge
docker-compose up -d sentinel-dash
```

### Restart a service (without dependencies)
```bash
docker-compose up -d --no-deps sentinel-api
```

### View logs
```bash
docker logs -f sentinel-api
docker logs -f sentinel-edge
docker logs -f sentinel-dash
```

### Stop all services
```bash
docker-compose down
```

### Stop and remove volumes
```bash
docker-compose down -v
```

## Development

### Backend Development

```bash
cd backend
npm install
npm run start:dev
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

### Database Management

```bash
cd backend

# Run migrations
npx prisma migrate dev

# Open Prisma Studio
npx prisma studio

# Generate Prisma Client
npx prisma generate
```

## AWS CloudWatch

https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=Industrial-Sentinel-IoT-Dashboard



## Project Structure

```
industrial-iot-dashboard/
├── backend/              # NestJS API
│   ├── src/
│   │   ├── telemetry/   # Telemetry module
│   │   ├── incidents/   # Incidents module
│   │   └── prisma/      # Prisma service
│   ├── prisma/
│   │   └── schema.prisma
│   └── Dockerfile
├── frontend/            # Next.js Dashboard
│   ├── src/
│   │   └── app/
│   └── Dockerfile
├── edge/                # Node-RED
│   └── data/
│       └── flows.json
├── docker-compose.yml
└── architecture.md
```

## API Endpoints

### POST /telemetry
Receive sensor data from edge devices.

**Request Body:**
```json
{
  "machineId": "ROBOT_ARM_01",
  "sensorType": "temperature",
  "value": 95.5
}
```

**Response:**
```json
{
  "id": 1,
  "machineId": "ROBOT_ARM_01",
  "sensorType": "temperature",
  "value": 95.5,
  "createdAt": "2025-12-09T21:00:00.000Z"
}
```

### GET /incidents
Retrieve all incidents ordered by creation date.

**Response:**
```json
[
  {
    "id": 1,
    "machineId": "ROBOT_ARM_01",
    "description": "High temperature detected: 95.5°C",
    "severity": "CRITICAL",
    "createdAt": "2025-12-09T21:00:00.000Z"
  }
]
```

## Troubleshooting

### Backend not responding
```bash
# Check if container is running
docker ps | grep sentinel-api

# View logs
docker logs sentinel-api

# Restart service
docker-compose restart sentinel-api
```

### Node-RED connection issues
```bash
# Check network connectivity
docker exec sentinel-edge wget -O- http://sentinel-api:3000/

# Verify flows are deployed
docker logs sentinel-edge
```

### Database connection errors
```bash
# Check if database is running
docker ps | grep sentinel-db

# Test connection
docker exec sentinel-db psql -U admin -d sentinel_metrics -c "SELECT 1;"
```

## License

MIT

## Contributing

This is a proof-of-concept project. Contributions are welcome via pull requests.
