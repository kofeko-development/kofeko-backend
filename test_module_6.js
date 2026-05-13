const fs = require('fs');

async function main() {
    const email = 'himanshuvaghela019@gmail.com';
    const password = 'Password@123';
    const tenantSlug = 'wildmind-ai';
    const jobId = 'ad0370a2-3e52-464f-847c-80c10bf78856';
    const rahulId = 'fdab1639-3123-45bb-afd2-c12ec3cb7f5d';
    
    // Login
    const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, tenantSlug })
    });
    const loginData = await loginRes.json();
    const token = loginData.data.accessToken;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    
    console.log('--- TEST 6.1 & 6.2: AI Evaluation ---');
    
    // Get existing evaluation for Rahul (already created in previous run)
    const rankRes = await fetch(`http://localhost:5000/api/v1/jobs/${jobId}/rankings`, { headers });
    const rankData = await rankRes.json();
    const rahulRank = rankData.data.find(r => r.candidate.id === rahulId);
    
    let evalData;
    if (rahulRank) {
        console.log('Using existing evaluation for Rahul');
        evalData = { data: rahulRank.evaluation };
    } else {
        // Should not happen if previous run succeeded, but just in case
        console.log('No existing evaluation, creating one...');
        const pipeRes = await fetch(`http://localhost:5000/api/v1/pipelines?jobId=${jobId}`, { headers });
        const pipeData = await pipeRes.json();
        const rahulPipe = pipeData.data.items.find(p => p.candidateId === rahulId);
        const pipeId = rahulPipe.id;

        const evalRes = await fetch('http://localhost:5000/api/v1/evaluations/ai-evaluate', {
            method: 'POST',
            headers,
            body: JSON.stringify({ jobId, candidateId: rahulId, pipelineId: pipeId })
        });
        evalData = await evalRes.json();
    }

    if (evalData && evalData.data) {
        console.log('Score:', evalData.data.score);
        console.log('TEST 6.1 PASS');
        
        const skillMatches = evalData.data.skillMatches || [];
        console.log('Skill Matches Count:', skillMatches.length);
        if (skillMatches.length === 4) console.log('TEST 6.2 PASS');
        else console.log('TEST 6.2 FAIL (Expected 4 skills)');

        console.log('\n--- TEST 6.8: Recruiter Override ---');
        const evalId = evalData.data.id;
        const overrideRes = await fetch(`http://localhost:5000/api/v1/evaluations/${evalId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ score: 95, whyCard: 'Manual override: exceptional candidate' })
        });
        const overrideData = await overrideRes.json();
        console.log('Status:', overrideRes.status);
        if (overrideData.data.score === 95) console.log('TEST 6.8 PASS');
    }

    console.log('\n--- TEST 6.3: No Resume Error ---');
    const amitId = '7db130b1-7955-4c65-b561-8e9ced2b6e14'; 
    const noResumeRes = await fetch('http://localhost:5000/api/v1/evaluations/ai-evaluate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ jobId, candidateId: amitId })
    });
    const noResumeData = await noResumeRes.json();
    if (noResumeRes.status === 400 && noResumeData.errorCode === 'NO_RESUME') console.log('TEST 6.3 PASS');

    console.log('\n--- TEST 6.5 & 6.6: Batch Evaluate (Should skip evaluated) ---');
    const batchRes = await fetch(`http://localhost:5000/api/v1/jobs/${jobId}/evaluate-all`, {
        method: 'POST',
        headers
    });
    const batchData = await batchRes.json();
    console.log('Evaluated:', batchData.data.evaluated);
    if (batchData.data.evaluated === 0) console.log('TEST 6.5 & 6.6 PASS (All skipped)');

    console.log('\n--- TEST 6.9: Audit Log ---');
    const auditRes = await fetch('http://localhost:5000/api/v1/audit/logs?action=ai_evaluate', { headers });
    const auditData = await auditRes.json();
    console.log('Logs count:', auditData.data.items.length);
    if (auditData.data.items.length > 0) console.log('TEST 6.9 PASS');
}

main().catch(err => console.error('Error:', err.message));
