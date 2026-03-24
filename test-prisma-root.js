import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
    console.log('Environment DATABASE_URL:', process.env.DATABASE_URL ? 'FOUND' : 'NOT FOUND');
    try {
        console.log('Attempting to query database...');
        const userCount = await prisma.user.count();
        console.log('✅ Connection successful! User count:', userCount);
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
