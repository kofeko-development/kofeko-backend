const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();

async function main() {
    const hash = await bcrypt.hash('Password@123', 10);
    await p.user.update({
        where: { id: 'd9d37132-3ce7-4975-a841-fe3b9ad04432' },
        data: { passwordHash: hash }
    });
    console.log('Password reset for recruiter');
}

main().finally(() => p.$disconnect());
