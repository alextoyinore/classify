import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database with test data...');

    // 1. Clear existing data (order matters for FKs)
    await prisma.cbtAnswer.deleteMany({});
    await prisma.cbtAttempt.deleteMany({});
    await prisma.cbtExamQuestion.deleteMany({});
    await prisma.cbtExam.deleteMany({});
    await prisma.cbtQuestion.deleteMany({});
    await prisma.score.deleteMany({});
    await prisma.attendance.deleteMany({});
    await prisma.enrollment.deleteMany({});
    await prisma.courseInstructor.deleteMany({});
    await prisma.course.deleteMany({});
    await prisma.semester_.deleteMany({});
    await prisma.academicSession.deleteMany({});
    await prisma.admin.deleteMany({});
    await prisma.student.deleteMany({});
    await prisma.instructor.deleteMany({});
    await prisma.user.deleteMany({});

    // 2. Create Admin User
    const adminPassword = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
        data: {
            email: 'admin@classify.com',
            password: adminPassword,
            role: 'ADMIN',
            admin: { create: { fullName: 'System Administrator' } }
        }
    });

    // 3. Create Session & Semester
    const session = await prisma.academicSession.create({
        data: {
            title: '2024/2025',
            isCurrent: true,
            semesters: {
                create: [
                    { name: 'FIRST', isCurrent: true },
                    { name: 'SECOND', isCurrent: false },
                ]
            }
        },
        include: { semesters: true }
    });
    const firstSemester = session.semesters.find(s => s.name === 'FIRST');

    // 4. Create a Course
    const course = await prisma.course.create({
        data: {
            code: 'CSC101',
            title: 'Introduction to Computer Science',
            department: 'Computer Science',
            level: 100,
            creditUnits: 3
        }
    });

    // 5. Create a Student User
    const studentMatric = 'STUDENT001';
    const studentPassword = await bcrypt.hash(studentMatric, 10);
    const studentUser = await prisma.user.create({
        data: {
            email: 'student@classify.com',
            password: studentPassword,
            role: 'STUDENT',
            student: {
                create: {
                    matricNumber: studentMatric,
                    firstName: 'John',
                    lastName: 'Doe',
                    gender: 'MALE',
                    department: 'Computer Science',
                    level: 100,
                    entryYear: '2024'
                }
            }
        },
        include: { student: true }
    });

    // 6. Enroll Student in Course
    await prisma.enrollment.create({
        data: {
            studentId: studentUser.student.id,
            courseId: course.id,
            session: '2024/2025',
            semester: 'FIRST'
        }
    });

    console.log('✅ Seeded successfully!');
    console.log('---------------------------');
    console.log('ADMIN:   admin@classify.com / admin123');
    console.log('STUDENT: student@classify.com / STUDENT001');
    console.log('---------------------------');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
