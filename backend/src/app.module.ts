import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TelemetryModule } from './telemetry/telemetry.module';
import { IncidentsModule } from './incidents/incidents.module';

@Module({
  imports: [TelemetryModule, IncidentsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
