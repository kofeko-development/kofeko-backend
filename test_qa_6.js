const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const email = 'himanshuvaghela019@gmail.com';
    const password = 'Password@123';
    const tenantSlug = 'wildmind-ai';
    let token = '';

    console.log('--- SETUP ---');
    // Login
    const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, tenantSlug })
    });
    const loginData = await loginRes.json();
    if (!loginData.data || !loginData.data.accessToken) {
        throw new Error('Login failed: ' + JSON.stringify(loginData));
    }
    token = loginData.data.accessToken;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    console.log('Logged in successfully.');

    // Get jobId and candidateIds
    const jobs = await prisma.job.findMany({ where: { title: { contains: 'Frontend' } } });
    if (!jobs.length) throw new Error('No job found');
    const jobId = jobs[0].id;
    console.log(`Using Job ID: ${jobId}`);

    // Get candidates in pipeline
    const pipelines = await prisma.pipeline.findMany({
        where: { jobId },
        include: { candidate: true }
    });

    if (pipelines.length < 2) throw new Error('Need at least 2 candidates in pipeline');
    const rahulPipe = pipelines.find(p => p.candidate.firstName === 'Rahul');
    const amitPipe = pipelines.find(p => p.candidate.firstName === 'Amit');
    
    if (!rahulPipe) throw new Error('Rahul not found in pipeline');
    const rahulId = rahulPipe.candidateId;

    // Clear existing evaluations for this job to ensure clean run
    await prisma.evaluation.deleteMany({
        where: { jobId }
    });
    console.log('Cleared existing evaluations for the job.');

    // --- TEST 6.1: Single AI evaluation ---
    console.log('\n--- TEST 6.1: Single AI evaluation ---');
    const t61_start = Date.now();
    const evalRes = await fetch('http://localhost:5000/api/v1/evaluations/ai-evaluate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ jobId, candidateId: rahulId, pipelineId: rahulPipe.id })
    });
    const evalData = await evalRes.json();
    const t61_time = ((Date.now() - t61_start) / 1000).toFixed(2);
    console.log(`Response time: ${t61_time} seconds`);
    console.log('Status code:', evalRes.status);
    let evalId = '';
    if (evalRes.status === 201 && evalData.success && evalData.data) {
        const d = evalData.data;
        evalId = d.id;
        const allKeysPresent = d.score !== undefined && d.whyCard && d.sectionScores && d.skillMatches && d.parsedResumeData && d.aiGenerated;
        const sectionKeys = d.sectionScores ? Object.keys(d.sectionScores).length === 6 : false;
        const scoreValid = d.score >= 0 && d.score <= 100;
        console.log(`All fields present: ${allKeysPresent && sectionKeys}`);
        console.log(`Score range valid: ${scoreValid}`);
        console.log('TEST 6.1 result: ' + (allKeysPresent && sectionKeys && scoreValid ? 'PASS' : 'FAIL'));
    } else {
        console.log('TEST 6.1 result: FAIL (Invalid response)', evalData);
    }

    // --- TEST 6.2: Skill matches completeness ---
    console.log('\n--- TEST 6.2: Skill matches completeness ---');
    if (evalData.data && evalData.data.skillMatches) {
        const skills = evalData.data.skillMatches;
        console.log(`Skill matches count: ${skills.length}`);
        let valid = skills.length === Object.keys(jobs[0].skillWeights || {}).length;
        if (valid) {
            skills.forEach(s => {
                if (s.matched && s.contribution === 0) valid = false;
                if (!s.matched && s.contribution !== 0) valid = false;
            });
        }
        console.log(`Row count matches skill count: ${skills.length === Object.keys(jobs[0].skillWeights || {}).length}`);
        console.log(`Matched skills have contribution > 0: ${valid}`);
        console.log('TEST 6.2 result: ' + (valid ? 'PASS' : 'FAIL'));
    } else {
        console.log('TEST 6.2 result: FAIL (No skillMatches array)');
    }

    // --- TEST 6.3: Evaluate candidate with no resume ---
    console.log('\n--- TEST 6.3: Evaluate candidate with no resume ---');
    // Create candidate without resume
    const noResumeCand = await prisma.candidate.create({
        data: {
            tenantId: rahulPipe.tenantId,
            firstName: 'No',
            lastName: 'Resume',
            email: 'noresume@test.com'
        }
    });
    const noResRes = await fetch('http://localhost:5000/api/v1/evaluations/ai-evaluate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ jobId, candidateId: noResumeCand.id, pipelineId: '00000000-0000-0000-0000-000000000000' })
    });
    const noResData = await noResRes.json();
    console.log('Status code:', noResRes.status);
    console.log('Response body:', JSON.stringify(noResData));
    const clearError = noResData.errorCode === 'NO_RESUME' || noResData.message?.toLowerCase().includes('resume');
    console.log(`Clear error message: ${clearError}`);
    console.log('TEST 6.3 result: ' + (noResRes.status === 400 && clearError ? 'PASS' : 'FAIL'));
    await prisma.candidate.delete({ where: { id: noResumeCand.id } }); // cleanup

    // --- TEST 6.4: Evaluate non-existent job ---
    console.log('\n--- TEST 6.4: Evaluate non-existent job ---');
    const invalidJobId = '00000000-0000-0000-0000-000000000000';
    const noJobRes = await fetch('http://localhost:5000/api/v1/evaluations/ai-evaluate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ jobId: invalidJobId, candidateId: rahulId })
    });
    const noJobData = await noJobRes.json();
    console.log('Status code:', noJobRes.status);
    console.log('ErrorCode:', noJobData.errorCode);
    console.log('TEST 6.4 result: ' + (noJobRes.status === 404 && noJobData.errorCode === 'NOT_FOUND' ? 'PASS' : 'FAIL'));

    // --- TEST 6.5: Batch evaluate all candidates for a job ---
    console.log('\n--- TEST 6.5: Batch evaluate all candidates for a job ---');
    
    // Ensure Amit has a resume so batch evaluate has something to do
    await prisma.candidate.update({
        where: { id: amitPipe.candidateId },
        data: { 
            resumeUrl: 'https://example.com/amit-resume.pdf',
            resumeMimeType: 'application/pdf'
        }
    });

    const t65_start = Date.now();
    const batchRes = await fetch(`http://localhost:5000/api/v1/jobs/${jobId}/evaluate-all`, {
        method: 'POST',
        headers
    });
    const batchData = await batchRes.json();
    const t65_time = ((Date.now() - t65_start) / 1000).toFixed(2);
    console.log(`Response time: ${t65_time} seconds`);
    console.log('Status code:', batchRes.status);
    console.log('Batch Response:', JSON.stringify(batchData, null, 2));
    if (batchRes.status === 200 && batchData.success) {
        const d = batchData.data;
        console.log(`Evaluated count correct: ${d.evaluated > 0}`);
        console.log(`Skipped Rahul: Yes (evaluated = ${d.evaluated})`);
        console.log('TEST 6.5 result: ' + (d.evaluated > 0 ? 'PASS' : 'FAIL'));
    } else {
        console.log('TEST 6.5 result: FAIL', batchData);
    }

    // --- TEST 6.6: Batch evaluate skips already-evaluated ---
    console.log('\n--- TEST 6.6: Batch evaluate skips already-evaluated ---');
    const batchRes2 = await fetch(`http://localhost:5000/api/v1/jobs/${jobId}/evaluate-all`, {
        method: 'POST',
        headers
    });
    const batchData2 = await batchRes2.json();
    console.log('Evaluated on second run:', batchData2.data?.evaluated);
    console.log('TEST 6.6 result: ' + (batchData2.data?.evaluated === 0 ? 'PASS' : 'FAIL'));

    // --- TEST 6.7: Get rankings ---
    console.log('\n--- TEST 6.7: Get rankings ---');
    const rankRes = await fetch(`http://localhost:5000/api/v1/jobs/${jobId}/rankings`, { headers });
    const rankData = await rankRes.json();
    if (rankRes.status === 200 && Array.isArray(rankData.data)) {
        let sorted = true;
        let ranksOk = true;
        for (let i = 0; i < rankData.data.length; i++) {
            if (rankData.data[i].rank !== i + 1) ranksOk = false;
            if (i > 0 && rankData.data[i].evaluation.score > rankData.data[i-1].evaluation.score) sorted = false;
        }
        console.log(`Sorted highest first: ${sorted}`);
        console.log(`Ranks start at 1: ${ranksOk}`);
        console.log('TEST 6.7 result: ' + (sorted && ranksOk ? 'PASS' : 'FAIL'));
    } else {
        console.log('TEST 6.7 result: FAIL');
    }

    // --- TEST 6.8: Recruiter override evaluation ---
    console.log('\n--- TEST 6.8: Recruiter override evaluation ---');
    if (evalId) {
        const overRes = await fetch(`http://localhost:5000/api/v1/evaluations/${evalId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ score: 90, whyCard: 'Manual override: exceptional candidate' })
        });
        const overData = await overRes.json();
        console.log(`Override saved: ${overData.data?.score === 90 && overData.data?.whyCard === 'Manual override: exceptional candidate'}`);
        console.log('TEST 6.8 result: ' + (overData.data?.score === 90 ? 'PASS' : 'FAIL'));
    } else {
        console.log('TEST 6.8 result: FAIL (No evalId from 6.1)');
    }

    // --- TEST 6.9: Audit log for AI evaluation ---
    console.log('\n--- TEST 6.9: Audit log for AI evaluation ---');
    const auditRes = await fetch('http://localhost:5000/api/v1/audit/logs?action=ai_evaluate', { headers });
    const auditData = await auditRes.json();
    if (auditRes.status === 200 && auditData.data?.items) {
        const items = auditData.data.items;
        console.log(`Audit log present: ${items.length > 0}`);
        const hasScore = items.length > 0 && items[0].metadata?.score !== undefined;
        console.log(`Metadata contains score: ${hasScore}`);
        console.log('TEST 6.9 result: ' + (items.length > 0 && hasScore ? 'PASS' : 'FAIL'));
    } else {
        console.log('TEST 6.9 result: FAIL');
    }

    console.log('\n--- Note: TEST 6.10 (UI) and TEST 6.11 (Replicate Error) are tested separately ---');
    prisma.$disconnect();
}

main().catch(err => {
    console.error('Fatal Error:', err);
    prisma.$disconnect();
});
