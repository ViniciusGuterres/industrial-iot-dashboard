import { IsString, IsNumber } from 'class-validator';

export class CreateTelemetryDto {
    @IsString()
    machineId: string;

    @IsString()
    sensorType: string;

    @IsNumber()
    value: number;
}