import { Controller, Post, Body } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller()
export class TelemetryController {
    constructor(private prisma: PrismaService) { }

    @Post('telemetry')
    async create(@Body() data: { machineId: string; sensorType: string; value: number }) {
        await this.prisma.telemetry.create({ data });

        if (data.sensorType === 'temperature' && data.value > 90) {
            await this.prisma.incidents.create({
                data: {
                    machineId: data.machineId,
                    description: `Critical temperature: ${data.value}°C`,
                    severity: 'CRITICAL',
                },
            });
        }

        return { success: true };
    }
}
