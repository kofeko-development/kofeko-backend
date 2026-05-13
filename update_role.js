const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    await p.user.update({
        where: { id: 'd9d37132-3ce7-4975-a841-fe3b9ad04432' },
        data: { companyRole: 'HR Admin' }
    });
    console.log('Role updated to HR Admin');
}

main().finally(() => p.$disconnect());
