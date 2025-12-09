import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateTelemetryDto } from './telemetry.dto';

@Injectable()
export class TelemetryService {
    constructor(private prisma: PrismaService) { }

    async create(data: CreateTelemetryDto) {
        const { value, sensorType, machineId } = data;

        try {
            return await this.prisma.$transaction(async (tx) => {
                const telemetry = await tx.telemetry.create({ data });

                if (sensorType === 'temperature' && value > 90) {
                    await tx.incidents.create({
                        data: {
                            machineId,
                            description: `Critical temperature: ${value}°C`,
                            severity: 'CRITICAL',
                        },
                    });
                }

                if (sensorType === 'vibration' && value > 80) {
                    await tx.incidents.create({
                        data: {
                            machineId,
                            description: `High vibration detected: ${value}`,
                            severity: 'WARNING',
                        },
                    });
                }

                return telemetry;
            });
        } catch (error) {
            throw new BadRequestException('Failed to create telemetry');
        }
    }
}