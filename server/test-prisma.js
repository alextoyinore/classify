import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const user = await prisma.user.findFirst();
        if (user) {
            console.log('✅ Found at least one user:', user.email);
        } else {
            console.log('⚠️ No users found in database.');
        }

        const messages = await prisma.message.count();
        console.log(`✅ Message table exists. Count: ${messages}`);

    } catch (e) {
        console.error('❌ Error testing Prisma:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
