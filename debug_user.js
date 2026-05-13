const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    const users = await p.user.findMany({ where: { email: 'himanshuvaghela019@gmail.com' } });
    console.log('Users:', JSON.stringify(users, null, 2));
    
    for (const u of users) {
        const t = await p.tenant.findFirst({ where: { id: u.tenantId } });
        console.log(`Tenant for ${u.tenantId}:`, JSON.stringify(t, null, 2));
    }
}

main().finally(() => p.$disconnect());
