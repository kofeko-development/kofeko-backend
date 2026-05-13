const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    const jobs = await p.job.findMany({
        where: { tenantId: 'd2bd5703-b71b-4523-ba59-e0caf536b01d' }
    });
    console.log(`Total jobs for tenant: ${jobs.length}`);
    jobs.forEach(j => console.log(`- ${j.title} (${j.id}) [${j.status}]`));
}

main().finally(() => p.$disconnect());
