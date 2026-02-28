import { prisma } from './src/lib/prisma.js';
async function main() {
    const users = await prisma.user.findMany({
        include: {
            student: { include: { department: true } },
            instructor: { include: { department: true } },
            admin: true
        }
    });
    console.log(JSON.stringify(users.map(u => ({
        id: u.id,
        email: u.email,
        role: u.role,
        student: u.student ? {
            id: u.student.id,
            name: u.student.firstName + ' ' + u.student.lastName,
            deptId: u.student.departmentId,
            deptName: u.student.department?.name
        } : null
    })), null, 2));
    await prisma.$disconnect();
}
main().catch(console.error);
