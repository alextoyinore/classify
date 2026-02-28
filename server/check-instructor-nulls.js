import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    const result = await prisma.$queryRaw`
        SELECT column_name, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'Instructor'
        AND column_name IN ('staffId', 'departmentId', 'facultyId', 'phone', 'qualification', 'avatarUrl')
        ORDER BY column_name;
    `;
    for (const row of result) {
        console.log(`${row.column_name}: is_nullable=${row.is_nullable}`);
    }
    await prisma.$disconnect();
}
check().catch(e => { console.error(e); process.exit(1); });
