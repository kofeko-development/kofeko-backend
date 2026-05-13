const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    const tenantId = 'd2bd5703-b71b-4523-ba59-e0caf536b01d';
    const userId = 'd9d37132-3ce7-4975-a841-fe3b9ad04432';
    
    const role = await p.role.findFirst({
        where: { tenantId, name: 'company_admin' }
    });
    
    if (!role) {
        console.log('Role company_admin not found');
        return;
    }
    
    await p.userRole.upsert({
        where: {
            tenantId_userId_roleId: {
                tenantId,
                userId,
                roleId: role.id
            }
        },
        update: {},
        create: {
            tenantId,
            userId,
            roleId: role.id
        }
    });
    console.log('User assigned company_admin role');
}

main().finally(() => p.$disconnect());
