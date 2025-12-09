import { Controller, Post, Body } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { CreateTelemetryDto } from './telemetry.dto';

@Controller()
export class TelemetryController {
    constructor(private telemetryService: TelemetryService) { }

    @Post('telemetry')
    async create(@Body() data: CreateTelemetryDto) {
        return this.telemetryService.create(data);
    }
}
