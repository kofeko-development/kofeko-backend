const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    const jobId = 'ad0370a2-3e52-464f-847c-80c10bf78856';
    const job = await p.job.findUnique({
        where: { id: jobId }
    });
    
    console.log('Job Skill Weights:', JSON.stringify(job.skillWeights, null, 2));
    
    const pipelines = await p.pipeline.findMany({
        where: { jobId },
        include: { candidate: true }
    });
    
    console.log('Candidates in Pipeline:');
    pipelines.forEach(pipe => {
        console.log(`- ${pipe.candidate.firstName} ${pipe.candidate.lastName} (${pipe.candidateId})`);
        console.log(`  Resume: ${pipe.candidate.resumeUrl || 'NONE'}`);
    });
}

main().finally(() => p.$disconnect());
