import { Controller, Get } from '@nestjs/common';
import { IncidentsService } from './incidents.service';

@Controller('incidents')
export class IncidentsController {
  constructor(private incidentsService: IncidentsService) {}

  @Get()
  async findAll() {
    return this.incidentsService.findAll();
  }
}
