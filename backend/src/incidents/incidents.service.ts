import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class IncidentsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.incidents.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
