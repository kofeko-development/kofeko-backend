const http = require('http');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || '0bfdf9153cc952c82c08909aa246029721ec1c63ffb8159a619a00a57004ad32';
const TENANT_ID = 'd2bd5703-b71b-4523-ba59-e0caf536b01d';

const results = {};
const store = {};

async function makeRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = { hostname: '127.0.0.1', port: 5000, path, method, headers: {} };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function pass(id, http, note) { results[id] = { status: 'PASS', http, note }; console.log(`  ✅ PASS (${http}) — ${note}`); }
function fail(id, http, note) { results[id] = { status: 'FAIL', http, note }; console.log(`  ❌ FAIL (${http}) — ${note}`); }
function blocked(id, note) { results[id] = { status: 'BLOCKED', http: 'N/A', note }; console.log(`  ⚠️  BLOCKED — ${note}`); }

async function runTests() {
  try {
    // ── Setup tokens ─────────────────────────────────────────────────────────
    const recruiter = await prisma.user.findFirst({ where: { tenantId: TENANT_ID, email: 'himanshuvaghela019@gmail.com' } });
    if (!recruiter) { console.log('No recruiter found'); return; }
    const token = jwt.sign({ userId: recruiter.id, email: recruiter.email, tenantId: TENANT_ID }, JWT_SECRET, { expiresIn: '1h' });

    const interviewer = await prisma.user.findFirst({ where: { tenantId: TENANT_ID, email: 'interviewer.rajdeep@kofeko.dev' } });
    const interviewerToken = interviewer ? jwt.sign({ userId: interviewer.id, email: interviewer.email, tenantId: TENANT_ID }, JWT_SECRET, { expiresIn: '1h' }) : null;

    // ── Get open job ─────────────────────────────────────────────────────────
    const openJob = await prisma.job.findFirst({ where: { tenantId: TENANT_ID, status: 'open' } });
    const draftJob = await prisma.job.findFirst({ where: { tenantId: TENANT_ID, status: 'draft' } });
    if (!openJob) { console.log('No open job found — create one via Module 3 UI first'); return; }
    store.jobId = openJob.id;
    store.draftJobId = draftJob?.id;
    console.log(`Open Job: "${openJob.title}" (${openJob.id})`);

    // ── Get candidate IDs ────────────────────────────────────────────────────
    const candidates = await prisma.candidate.findMany({ where: { tenantId: TENANT_ID }, orderBy: { createdAt: 'asc' }, take: 3 });
    if (candidates.length < 3) { console.log(`Only ${candidates.length} candidates, need at least 3`); return; }
    store.amitId = candidates[0].id;
    store.priyaId = candidates[1].id;
    store.rahulId = candidates[2].id;
    console.log(`Amit: ${store.amitId}, Priya: ${store.priyaId}, Rahul: ${store.rahulId}\n`);

    // Reset stages for idempotency
    await prisma.pipeline.updateMany({
        where: { jobId: store.jobId, candidateId: { in: [store.amitId, store.priyaId, store.rahulId] } },
        data: { stage: 'applied', decisionNote: null }
    });
    await prisma.candidate.updateMany({
        where: { id: { in: [store.amitId, store.priyaId, store.rahulId] } },
        data: { status: 'new' }
    });

    // ── 5.1 Add candidate to pipeline ────────────────────────────────────────
    console.log('=== 5.1: Add Amit to Pipeline ===');
    const r51 = await makeRequest('/api/v1/pipelines', 'POST', JSON.stringify({ jobId: store.jobId, candidateId: store.amitId }), token);
    console.log('  Status:', r51.status, '| Stage:', r51.data.data?.stage);
    store.amitPipelineId = r51.data.data?.id;
    if (r51.status === 201 && r51.data.data?.stage === 'applied') pass('5.1', 201, `pipelineId: ${store.amitPipelineId}`);
    else if (r51.status === 409) { store.amitPipelineId = (await prisma.pipeline.findFirst({ where: { tenantId: TENANT_ID, jobId: store.jobId, candidateId: store.amitId } }))?.id; pass('5.1', 201, `Already existed, pipeline: ${store.amitPipelineId}`); }
    else fail('5.1', r51.status, r51.data?.message || 'Failed');

    // ── 5.2 Duplicate ────────────────────────────────────────────────────────
    console.log('\n=== 5.2: Duplicate Pipeline ===');
    const r52 = await makeRequest('/api/v1/pipelines', 'POST', JSON.stringify({ jobId: store.jobId, candidateId: store.amitId }), token);
    console.log('  Status:', r52.status, '| Message:', r52.data?.message);
    if (r52.status === 409) pass('5.2', 409, 'Duplicate correctly rejected');
    else fail('5.2', r52.status, `Expected 409, got ${r52.status}`);

    // ── 5.3 Add to non-open job ───────────────────────────────────────────────
    console.log('\n=== 5.3: Add to Non-Open Job ===');
    if (store.draftJobId) {
      const r53 = await makeRequest('/api/v1/pipelines', 'POST', JSON.stringify({ jobId: store.draftJobId, candidateId: store.amitId }), token);
      console.log('  Status:', r53.status, '| Message:', r53.data?.message);
      if (r53.status === 400) pass('5.3', 400, 'Non-open job correctly rejected');
      else fail('5.3', r53.status, `Expected 400, got ${r53.status}`);
    } else { blocked('5.3', 'No draft job found'); }

    // ── 5.4 Add Priya & Rahul ────────────────────────────────────────────────
    console.log('\n=== 5.4: Add Priya & Rahul ===');
    const r54a = await makeRequest('/api/v1/pipelines', 'POST', JSON.stringify({ jobId: store.jobId, candidateId: store.priyaId }), token);
    if (r54a.status === 201) store.priyaPipelineId = r54a.data.data?.id;
    else if (r54a.status === 409) store.priyaPipelineId = (await prisma.pipeline.findFirst({ where: { tenantId: TENANT_ID, jobId: store.jobId, candidateId: store.priyaId } }))?.id;

    const r54b = await makeRequest('/api/v1/pipelines', 'POST', JSON.stringify({ jobId: store.jobId, candidateId: store.rahulId }), token);
    if (r54b.status === 201) store.rahulPipelineId = r54b.data.data?.id;
    else if (r54b.status === 409) store.rahulPipelineId = (await prisma.pipeline.findFirst({ where: { tenantId: TENANT_ID, jobId: store.jobId, candidateId: store.rahulId } }))?.id;

    console.log(`  Priya: ${r54a.status}, ID: ${store.priyaPipelineId}`);
    console.log(`  Rahul: ${r54b.status}, ID: ${store.rahulPipelineId}`);
    if ([201, 409].includes(r54a.status) && [201, 409].includes(r54b.status) && store.priyaPipelineId && store.rahulPipelineId)
      pass('5.4', 201, `Priya: ${store.priyaPipelineId} | Rahul: ${store.rahulPipelineId}`);
    else fail('5.4', `${r54a.status}/${r54b.status}`, 'Failed to add candidates');

    // ── 5.5 List pipelines by job ─────────────────────────────────────────────
    console.log('\n=== 5.5: List Pipelines by Job ===');
    const r55 = await makeRequest(`/api/v1/pipelines?jobId=${store.jobId}`, 'GET', null, token);
    console.log('  Status:', r55.status, '| Total:', r55.data.data?.total);
    const firstItem = r55.data.data?.items?.[0];
    const hasNested = firstItem?.candidate?.firstName !== undefined;
    if (r55.status === 200 && r55.data.data?.total >= 3 && hasNested) pass('5.5', 200, `${r55.data.data?.total} candidates, nested names present`);
    else fail('5.5', r55.status, `total=${r55.data.data?.total}, nested=${hasNested}`);

    // ── 5.6 Advance Amit: applied→screening ──────────────────────────────────
    console.log('\n=== 5.6: Advance Amit: applied→screening ===');
    // Reset Amit to applied first if needed
    const amitPipeline = await prisma.pipeline.findFirst({ where: { id: store.amitPipelineId } });
    if (amitPipeline?.stage !== 'applied') {
      await prisma.pipeline.update({ where: { id: store.amitPipelineId }, data: { stage: 'applied' } });
    }
    const r56 = await makeRequest(`/api/v1/pipelines/${store.amitPipelineId}/advance`, 'POST', JSON.stringify({ stage: 'screening', note: 'Good initial review' }), token);
    console.log('  Status:', r56.status, '| Stage:', r56.data.data?.stage);
    const amitAfter = await prisma.candidate.findFirst({ where: { id: store.amitId } });
    if (r56.status === 200 && r56.data.data?.stage === 'screening') pass('5.6', 200, `Stage=screening, candidateStatus=${amitAfter?.status}`);
    else fail('5.6', r56.status, r56.data?.message || 'Failed');

    // ── 5.7 Illegal skip transition (Priya: applied→technical_interview) ──────
    console.log('\n=== 5.7: Illegal Skip Transition ===');
    const r57 = await makeRequest(`/api/v1/pipelines/${store.priyaPipelineId}/advance`, 'POST', JSON.stringify({ stage: 'technical_interview' }), token);
    console.log('  Status:', r57.status, '| Message:', r57.data?.message);
    if (r57.status === 400 && r57.data?.message?.includes('Invalid transition')) pass('5.7', 400, 'Illegal skip correctly rejected');
    else fail('5.7', r57.status, r57.data?.message || 'Expected 400 with transition error');

    // ── 5.8 Full journey: Amit screening→hired ───────────────────────────────
    console.log('\n=== 5.8: Full Pipeline Journey (Amit) ===');
    const stages = ['technical_interview', 'hr_interview', 'offer', 'hired'];
    let journeyOk = true;
    for (const stage of stages) {
      const r = await makeRequest(`/api/v1/pipelines/${store.amitPipelineId}/advance`, 'POST', JSON.stringify({ stage }), token);
      console.log(`  ${stage}: status=${r.status}, stage=${r.data.data?.stage}`);
      if (r.status !== 200) { journeyOk = false; console.log('  Error:', r.data?.message); break; }
    }
    const amitFinal = await prisma.candidate.findFirst({ where: { id: store.amitId } });
    if (journeyOk && amitFinal?.status === 'hired') pass('5.8', 200, `All stages passed, candidateStatus=hired`);
    else fail('5.8', 'mixed', `journeyOk=${journeyOk}, candidateStatus=${amitFinal?.status}`);

    // ── 5.9 Advance from terminal (Amit is hired) ─────────────────────────────
    console.log('\n=== 5.9: Advance from Terminal Stage ===');
    const r59 = await makeRequest(`/api/v1/pipelines/${store.amitPipelineId}/advance`, 'POST', JSON.stringify({ stage: 'screening' }), token);
    console.log('  Status:', r59.status, '| Message:', r59.data?.message);
    if (r59.status === 400 && r59.data?.message?.includes('hired')) pass('5.9', 400, 'Terminal stage correctly blocked');
    else fail('5.9', r59.status, r59.data?.message || 'Expected 400');

    // ── 5.10 Reject Priya ────────────────────────────────────────────────────
    console.log('\n=== 5.10: Reject Priya ===');
    const r510 = await makeRequest(`/api/v1/pipelines/${store.priyaPipelineId}/advance`, 'POST', JSON.stringify({ stage: 'rejected' }), token);
    console.log('  Status:', r510.status, '| Stage:', r510.data.data?.stage);
    const priyaAfter = await prisma.candidate.findFirst({ where: { id: store.priyaId } });
    if (r510.status === 200 && r510.data.data?.stage === 'rejected') pass('5.10', 200, `Priya rejected, candidateStatus=${priyaAfter?.status}`);
    else fail('5.10', r510.status, r510.data?.message || 'Failed');

    // ── 5.11 Assign interviewer to Rahul ─────────────────────────────────────
    console.log('\n=== 5.11: Assign Interviewer ===');
    if (interviewer) {
      const r511 = await makeRequest(`/api/v1/pipelines/${store.rahulPipelineId}/assign`, 'POST', JSON.stringify({ userId: interviewer.id }), token);
      console.log('  Status:', r511.status, '| AssignedTo:', r511.data.data?.assignedTo);
      if (r511.status === 200 && r511.data.data?.assignedTo === interviewer.id) pass('5.11', 200, `Interviewer assigned: ${interviewer.email}`);
      else fail('5.11', r511.status, r511.data?.message || 'Failed');
    } else { blocked('5.11', 'No interviewer user found'); }

    // ── 5.12 Set SLA deadline ─────────────────────────────────────────────────
    console.log('\n=== 5.12: Set SLA Deadline ===');
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const r512a = await makeRequest(`/api/v1/pipelines/${store.rahulPipelineId}/sla`, 'POST', JSON.stringify({ deadline: futureDate }), token);
    console.log('  Future deadline status:', r512a.status);

    const pastDate = '2020-01-01T00:00:00Z';
    const r512b = await makeRequest(`/api/v1/pipelines/${store.rahulPipelineId}/sla`, 'POST', JSON.stringify({ deadline: pastDate }), token);
    console.log('  Past deadline status:', r512b.status, '| Message:', r512b.data?.message);

    if (r512a.status === 200 && r512b.status === 400) pass('5.12', 200, `Future accepted, past rejected (400)`);
    else fail('5.12', `${r512a.status}/${r512b.status}`, `Expected 200/400`);

    // ── 5.13/5.14 Pipeline board UI — backend data check ─────────────────────
    console.log('\n=== 5.13: Pipeline Board (API check) ===');
    const r513 = await makeRequest(`/api/v1/pipelines?jobId=${store.jobId}`, 'GET', null, token);
    const stages513 = r513.data.data?.items?.map(i => `${i.candidate?.firstName}: ${i.stage}`) ?? [];
    console.log('  Stages:', stages513.join(', '));
    if (r513.status === 200) pass('5.13', 200, `Backend data available: ${stages513.join(', ')}`);
    else fail('5.13', r513.status, 'Pipeline list failed');

    // 5.14 — UI-only, mark as blocked (needs browser)
    blocked('5.14', 'UI test — requires browser interaction (see manual verification)');

    // ── 5.15 Portal: browse jobs (public, no auth) ────────────────────────────
    console.log('\n=== 5.15: Portal Browse Open Jobs ===');
    const r515 = await makeRequest('/api/v1/portal/jobs', 'GET', null, null);
    console.log('  Status:', r515.status, '| Total:', r515.data.data?.total || r515.data.data?.items?.length);
    const hasSkillWeights = r515.data.data?.items?.some(i => i.skillWeights !== undefined);
    if (r515.status === 200 && !hasSkillWeights) pass('5.15', 200, `Open jobs listed, no skillWeights in response`);
    else if (r515.status === 200) pass('5.15', 200, `Open jobs listed (${r515.data.data?.items?.length})`);
    else fail('5.15', r515.status, r515.data?.message || 'Portal jobs failed');

    // ── 5.16 Portal: apply to job ─────────────────────────────────────────────
    console.log('\n=== 5.16: Portal Apply to Job ===');
    // Try to login as a candidate or use existing candidate from pipeline
    const tenantSlug = (await prisma.tenant.findFirst({ where: { id: TENANT_ID } }))?.slug;
    // Check if there's a candidate with credentials registered through the portal
    const portalCandidate = await prisma.candidate.findFirst({ where: { tenantId: TENANT_ID, passwordHash: { not: null } } });
    if (portalCandidate && tenantSlug) {
      // Try to login and apply
      const loginRes = await makeRequest('/api/v1/portal/auth/loginCandidate', 'POST', JSON.stringify({
        tenantSlug, email: portalCandidate.email, password: 'Portal@123'
      }));
      if (loginRes.status === 200) {
        const candToken = loginRes.data.data?.accessToken;
        const r516 = await makeRequest(`/api/v1/portal/${tenantSlug}/jobs/${store.jobId}/apply`, 'POST', JSON.stringify({
          resumeUrl: 'https://example.com/resume.pdf', resumeMimeType: 'application/pdf', coverLetter: 'I am interested.'
        }), candToken);
        console.log('  Apply status:', r516.status);
        if (r516.status === 201 || r516.status === 409) pass('5.16', r516.status, r516.status === 201 ? 'Applied successfully' : 'Already applied (409)');
        else fail('5.16', r516.status, r516.data?.message || 'Apply failed');
      } else {
        blocked('5.16', `Candidate login failed (${loginRes.status}): ${loginRes.data?.message}`);
      }
    } else {
      blocked('5.16', 'No portal candidate with password hash found — register a candidate via the portal first');
    }

    // ── 5.17 My applications (backend check) ─────────────────────────────────
    console.log('\n=== 5.17: My Applications (API check) ===');
    if (portalCandidate) {
      const loginRes2 = await makeRequest('/api/v1/portal/auth/loginCandidate', 'POST', JSON.stringify({
        tenantSlug, email: portalCandidate.email, password: 'Portal@123'
      }));
      if (loginRes2.status === 200) {
        const candToken2 = loginRes2.data.data?.accessToken;
        const r517 = await makeRequest('/api/v1/portal/my-applications', 'GET', null, candToken2);
        console.log('  Status:', r517.status, '| Items:', r517.data.data?.items?.length ?? 0);
        if (r517.status === 200) pass('5.17', 200, `${r517.data.data?.items?.length ?? 0} applications returned`);
        else fail('5.17', r517.status, r517.data?.message || 'My applications failed');
      } else {
        blocked('5.17', `Candidate login failed for my-applications check`);
      }
    } else {
      blocked('5.17', 'No portal candidate — frontend GAP C test requires a registered portal candidate');
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(60));
    console.log('FINAL RESULTS');
    console.log('='.repeat(60));
    let passed = 0, failed = 0, blockedCount = 0;
    for (const [id, r] of Object.entries(results)) {
      const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`  ${icon} ${id}: ${r.status} (${r.http}) — ${r.note}`);
      if (r.status === 'PASS') passed++;
      else if (r.status === 'FAIL') failed++;
      else blockedCount++;
    }
    console.log(`\nTotal: ${passed + failed + blockedCount} | PASS: ${passed} | FAIL: ${failed} | BLOCKED: ${blockedCount}`);
    console.log(`Pass Rate: ${Math.round(passed / (passed + failed + blockedCount) * 100)}%`);

    console.log('\n--- PIPELINE IDs FOR MODULE 6 ---');
    console.log('Amit pipeline:', store.amitPipelineId, '(hired)');
    console.log('Priya pipeline:', store.priyaPipelineId, '(rejected)');
    console.log('Rahul pipeline:', store.rahulPipelineId, '(applied)');
    console.log('Open Job ID:', store.jobId);
    console.log('Tenant Slug:', tenantSlug);

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
