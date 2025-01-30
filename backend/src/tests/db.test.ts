import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDatabaseConnection() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Successfully connected to the database');

    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        password: 'hashedpassword',
        name: 'Test User',
        phone: '1234567890'
      }
    });
    console.log('✅ Successfully created test user:', testUser.id);

    // Create a test patient
    const testPatient = await prisma.patient.create({
      data: {
        name: 'Test Patient',
        phoneNumber: '0987654321',
        caretakerId: testUser.id
      }
    });
    console.log('✅ Successfully created test patient:', testPatient.id);

    // Create a test call log
    const callLog = await prisma.callLog.create({
      data: {
        patientId: testPatient.id,
        startTime: new Date(),
        isWebRTC: true,
        status: 'INITIATED'
      }
    });
    console.log('✅ Successfully created test call log:', callLog.id);

    // Clean up test data
    await prisma.callLog.delete({ where: { id: callLog.id } });
    await prisma.patient.delete({ where: { id: testPatient.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    console.log('✅ Successfully cleaned up test data');

  } catch (error) {
    console.error('❌ Database test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
console.log('🔍 Starting database test...');
testDatabaseConnection()
  .then(() => console.log('✨ Database test completed'))
  .catch(console.error); 