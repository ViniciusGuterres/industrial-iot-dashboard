import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    await prisma.machine.createMany({
        data: [
            { id: 'ROBOT_ARM_01', name: 'Robot Arm 01', type: 'ROBOT_ARM', location: 'Assembly Line A' },
            { id: 'PRESSA_HIDRAULICA_02', name: 'Hydraulic Press 02', type: 'HYDRAULIC_PRESS', location: 'Stamping Area' },
        ],
    });
}

main()
    .catch((e) => console.error(e))
    .finally(async () => { await prisma.$disconnect(); });