-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Telemetry" (
    "id" SERIAL NOT NULL,
    "machineId" TEXT NOT NULL,
    "sensorType" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Telemetry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" SERIAL NOT NULL,
    "machineId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Telemetry_machineId_createdAt_idx" ON "Telemetry"("machineId", "createdAt");

-- CreateIndex
CREATE INDEX "Incident_severity_createdAt_idx" ON "Incident"("severity", "createdAt");
