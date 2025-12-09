import { IsString, IsNumber, IsIn } from 'class-validator';

export class CreateTelemetryDto {
    @IsString()
    machineId: string;

    @IsIn(['temperature', 'vibration'])
    sensorType: string;

    @IsNumber()
    value: number;
}