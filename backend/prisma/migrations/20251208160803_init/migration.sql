/*
  Warnings:

  - You are about to drop the `Incident` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Machine` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Telemetry` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Incident";

-- DropTable
DROP TABLE "Machine";

-- DropTable
DROP TABLE "Telemetry";

-- CreateTable
CREATE TABLE "machines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telemetry" (
    "id" SERIAL NOT NULL,
    "machineId" TEXT NOT NULL,
    "sensorType" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telemetry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" SERIAL NOT NULL,
    "machineId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "telemetry_machineId_createdAt_idx" ON "telemetry"("machineId", "createdAt");

-- CreateIndex
CREATE INDEX "incidents_severity_createdAt_idx" ON "incidents"("severity", "createdAt");
