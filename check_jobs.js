const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
db.job.findMany({ select: { id: true, title: true, status: true, tenantId: true } })
  .then(r => console.log(JSON.stringify(r, null, 2)))
  .catch(console.error)
  .finally(() => db.$disconnect());
