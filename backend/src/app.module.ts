import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { TelemetryController } from './telemetry.controller';

@Module({
  imports: [],
  controllers: [AppController, TelemetryController],
  providers: [AppService, PrismaService],
})
export class AppModule {}