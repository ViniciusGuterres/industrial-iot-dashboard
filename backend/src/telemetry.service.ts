import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateTelemetryDto } from './telemetry.dto';

@Injectable()
export class TelemetryService {
    constructor(private prisma: PrismaService) { }

    async create(data: CreateTelemetryDto) {
        await this.prisma.telemetry.create({ data });

        const { value, sensorType, machineId } = data;

        if (sensorType === 'temperature' && value > 90) {
            await this.prisma.incidents.create({
                data: {
                    machineId: machineId,
                    description: `Critical temperature: ${value}°C`,
                    severity: 'CRITICAL',
                },
            });
        }

        return { success: true };
    }
}