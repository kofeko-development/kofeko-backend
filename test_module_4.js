const http = require('http');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || '0bfdf9153cc952c82c08909aa246029721ec1c63ffb8159a619a00a57004ad32';

const results = {};

async function makeRequest(path, method = 'GET', body = null, token = null, isFormData = false, boundary = '') {
  return new Promise((resolve, reject) => {
    const options = { hostname: '127.0.0.1', port: 5000, path, method, headers: {} };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (body) {
      if (isFormData) {
        options.headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
        options.headers['Content-Length'] = Buffer.byteLength(body);
      } else {
        options.headers['Content-Type'] = 'application/json';
        options.headers['Content-Length'] = Buffer.byteLength(body);
      }
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

async function runTests() {
  try {
    // ── Get a recruiter user & token ─────────────────────────────────────────
    const userRole = await prisma.userRole.findFirst({
      where: { role: { name: 'recruiter' } },
      include: { user: true }
    });
    let user = userRole?.user;
    if (!user) user = await prisma.user.findFirst();
    if (!user) { console.log('No users found.'); return; }

    const token = jwt.sign(
      { userId: user.id, email: user.email, tenantId: user.tenantId },
      JWT_SECRET, { expiresIn: '1h' }
    );
    console.log(`\nToken: ${user.email} | Tenant: ${user.tenantId}\n`);

    // ── Get an interviewer user & token ──────────────────────────────────────
    const interviewerRole = await prisma.userRole.findFirst({
      where: { role: { name: 'interviewer' } },
      include: { user: true }
    });
    const interviewerToken = interviewerRole?.user
      ? jwt.sign(
          { userId: interviewerRole.user.id, email: interviewerRole.user.email, tenantId: interviewerRole.user.tenantId },
          JWT_SECRET, { expiresIn: '1h' }
        )
      : null;

    // ── 4.1 List candidates ──────────────────────────────────────────────────
    console.log('=== 4.1: List Candidates ===');
    const r41 = await makeRequest('/api/v1/candidates?page=1&limit=100', 'GET', null, token);
    console.log('  Response:', JSON.stringify(r41.data).slice(0, 200));
    if (r41.status === 200) pass('4.1', 200, `List returned ${r41.data.data?.total ?? 0} candidates`);
    else fail('4.1', r41.status, r41.data?.message || 'Non-200 response');

    // ── 4.2 Upload PDF ───────────────────────────────────────────────────────
    console.log('\n=== 4.2: Upload PDF ===');
    const boundary = '----TestBoundary123';
    let pdfForm = `--${boundary}\r\nContent-Disposition: form-data; name="resume"; filename="test.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4 fake content\r\n--${boundary}--\r\n`;
    const r42 = await makeRequest('/api/v1/candidates/upload-resume', 'POST', pdfForm, token, true, boundary);
    const resumeUrl = r42.data.data?.url;
    console.log('  Status:', r42.status, '| URL:', resumeUrl);
    if (r42.status === 200 && resumeUrl) pass('4.2', 200, `URL: ${resumeUrl}`);
    else fail('4.2', r42.status, r42.data?.message || 'Upload failed');

    // ── 4.3 Upload DOCX ──────────────────────────────────────────────────────
    console.log('\n=== 4.3: Upload DOCX ===');
    let docxForm = `--${boundary}\r\nContent-Disposition: form-data; name="resume"; filename="test.docx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\nFake DOCX content\r\n--${boundary}--\r\n`;
    const r43 = await makeRequest('/api/v1/candidates/upload-resume', 'POST', docxForm, token, true, boundary);
    console.log('  Status:', r43.status, '| MimeType:', r43.data.data?.mimeType);
    if (r43.status === 200) pass('4.3', 200, `mimeType: ${r43.data.data?.mimeType}`);
    else fail('4.3', r43.status, r43.data?.message || 'Upload failed');

    // ── 4.4 Upload TXT ───────────────────────────────────────────────────────
    console.log('\n=== 4.4: Upload TXT ===');
    let txtForm = `--${boundary}\r\nContent-Disposition: form-data; name="resume"; filename="test.txt"\r\nContent-Type: text/plain\r\n\r\nFake text resume\r\n--${boundary}--\r\n`;
    const r44 = await makeRequest('/api/v1/candidates/upload-resume', 'POST', txtForm, token, true, boundary);
    console.log('  Status:', r44.status, '| MimeType:', r44.data.data?.mimeType);
    if (r44.status === 200) pass('4.4', 200, `mimeType: ${r44.data.data?.mimeType}`);
    else fail('4.4', r44.status, r44.data?.message || 'Upload failed');

    // ── 4.5 Upload JPG (rejected) ─────────────────────────────────────────────
    console.log('\n=== 4.5: Upload JPG (rejected) ===');
    let jpgForm = `--${boundary}\r\nContent-Disposition: form-data; name="resume"; filename="test.jpg"\r\nContent-Type: image/jpeg\r\n\r\nFake JPEG\r\n--${boundary}--\r\n`;
    const r45 = await makeRequest('/api/v1/candidates/upload-resume', 'POST', jpgForm, token, true, boundary);
    console.log('  Status:', r45.status, '| Message:', r45.data?.message);
    if (r45.status === 415) pass('4.5', 415, 'Correctly rejected JPG');
    else fail('4.5', r45.status, `Expected 415, got ${r45.status}`);

    // ── 4.6 Upload >8MB (rejected) ────────────────────────────────────────────
    console.log('\n=== 4.6: Upload >8MB ===');
    const bigContent = 'X'.repeat(9 * 1024 * 1024);
    let bigForm = `--${boundary}\r\nContent-Disposition: form-data; name="resume"; filename="huge.pdf"\r\nContent-Type: application/pdf\r\n\r\n${bigContent}\r\n--${boundary}--\r\n`;
    const r46 = await makeRequest('/api/v1/candidates/upload-resume', 'POST', bigForm, token, true, boundary);
    console.log('  Status:', r46.status, '| Message:', r46.data?.message);
    if ([413, 415, 400].includes(r46.status)) pass('4.6', r46.status, 'Large file rejected');
    else fail('4.6', r46.status, `Expected 413, got ${r46.status}: ${r46.data?.message}`);

    // ── 4.7 Create candidate (correct field names) ────────────────────────────
    console.log('\n=== 4.7: Create Candidate ===');
    // resumeUrl must be a real URL or omitted if validation rejects http://localhost
    const validResumeUrl = (resumeUrl && resumeUrl.startsWith('https://')) ? resumeUrl : undefined;
    const candidateEmail = `amit.sharma.${Date.now()}@test.com`;
    const payload47 = {
      firstName: 'Amit',
      lastName: 'Sharma',
      email: candidateEmail,
      phoneNumber: '+919876543210',   // ← correct field name
      ...(validResumeUrl ? { resumeUrl: validResumeUrl, resumeMimeType: 'application/pdf' } : {}),
      skills: ['React', 'TypeScript', 'Node.js'],
      location: 'Ahmedabad, India',
      expectedSalary: 1200000,
      noticePeriod: 30,
      source: 'linkedin',
    };
    const r47 = await makeRequest('/api/v1/candidates', 'POST', JSON.stringify(payload47), token);
    console.log('  Status:', r47.status, '| Data:', JSON.stringify(r47.data).slice(0, 300));
    const amitId = r47.data.data?.id;
    if (r47.status === 201 && amitId) pass('4.7', 201, `ID: ${amitId}`);
    else fail('4.7', r47.status, r47.data?.message || JSON.stringify(r47.data).slice(0, 200));

    // ── 4.8 Duplicate email ───────────────────────────────────────────────────
    console.log('\n=== 4.8: Duplicate Email ===');
    const r48 = await makeRequest('/api/v1/candidates', 'POST', JSON.stringify(payload47), token);
    console.log('  Status:', r48.status, '| Message:', r48.data?.message);
    if (r48.status === 409) pass('4.8', 409, 'Conflict returned for duplicate email');
    else fail('4.8', r48.status, `Expected 409, got ${r48.status}`);

    // ── 4.9 Create 2 more candidates ──────────────────────────────────────────
    console.log('\n=== 4.9: Create 2 more candidates ===');
    const r49a = await makeRequest('/api/v1/candidates', 'POST', JSON.stringify({
      firstName: 'Priya', lastName: 'Patel', email: `priya.patel.${Date.now()}@test.com`,
      skills: ['Python', 'Django', 'PostgreSQL']
    }), token);
    const priyaId = r49a.data.data?.id;
    console.log('  Priya:', r49a.status, '| ID:', priyaId);

    const r49b = await makeRequest('/api/v1/candidates', 'POST', JSON.stringify({
      firstName: 'Rahul', lastName: 'Mehta', email: `rahul.mehta.${Date.now()}@test.com`,
      skills: ['React', 'Node.js']
    }), token);
    const rahulId = r49b.data.data?.id;
    console.log('  Rahul:', r49b.status, '| ID:', rahulId);
    if (r49a.status === 201 && r49b.status === 201) pass('4.9', 201, `Priya: ${priyaId} | Rahul: ${rahulId}`);
    else fail('4.9', `${r49a.status}/${r49b.status}`, 'One or both candidates failed');

    // ── 4.10 Skills filter ────────────────────────────────────────────────────
    console.log('\n=== 4.10: Skills Filter ===');
    const r410 = await makeRequest('/api/v1/candidates?skills=React,TypeScript', 'GET', null, token);
    console.log('  Status:', r410.status, '| Total:', r410.data.data?.total);
    if (r410.status === 200) pass('4.10', 200, `${r410.data.data?.total ?? 0} candidates matched`);
    else fail('4.10', r410.status, 'Filter failed');

    // ── 4.11 Status filter ────────────────────────────────────────────────────
    console.log('\n=== 4.11: Status Filter ===');
    const r411 = await makeRequest('/api/v1/candidates?status=new', 'GET', null, token);
    console.log('  Status:', r411.status, '| Total:', r411.data.data?.total);
    if (r411.status === 200) pass('4.11', 200, `${r411.data.data?.total ?? 0} with status=new`);
    else fail('4.11', r411.status, 'Status filter failed');

    if (amitId) {
      // ── 4.12 Update candidate ───────────────────────────────────────────────
      console.log('\n=== 4.12: Update Candidate ===');
      const r412 = await makeRequest(`/api/v1/candidates/${amitId}`, 'PATCH', JSON.stringify({
        location: 'Mumbai, India', expectedSalary: 1500000
      }), token);
      console.log('  Status:', r412.status, '| Location:', r412.data.data?.location);
      if (r412.status === 200 && r412.data.data?.location === 'Mumbai, India') pass('4.12', 200, 'Fields updated correctly');
      else fail('4.12', r412.status, r412.data?.message || 'Update may have failed');

      // ── 4.13 Update status ──────────────────────────────────────────────────
      console.log('\n=== 4.13: Update Status ===');
      const r413 = await makeRequest(`/api/v1/candidates/${amitId}/status`, 'PATCH', JSON.stringify({
        status: 'screening'
      }), token);
      console.log('  Status:', r413.status, '| New Status:', r413.data.data?.status);
      if (r413.status === 200 && r413.data.data?.status === 'screening') pass('4.13', 200, 'Status → screening');
      else fail('4.13', r413.status, r413.data?.message || 'Status update failed');

      // ── 4.14 Invalid status ─────────────────────────────────────────────────
      console.log('\n=== 4.14: Invalid Status ===');
      const r414 = await makeRequest(`/api/v1/candidates/${amitId}/status`, 'PATCH', JSON.stringify({
        status: 'promoted'
      }), token);
      console.log('  Status:', r414.status);
      if (r414.status === 400) pass('4.14', 400, 'Validation rejected invalid status');
      else fail('4.14', r414.status, `Expected 400, got ${r414.status}`);
    } else {
      fail('4.12', 'N/A', 'Skipped — amitId missing'); 
      fail('4.13', 'N/A', 'Skipped — amitId missing'); 
      fail('4.14', 'N/A', 'Skipped — amitId missing');
    }

    // ── 4.15 Interviewer blocked from creating ───────────────────────────────
    console.log('\n=== 4.15: Interviewer Blocked ===');
    if (interviewerToken) {
      const r415 = await makeRequest('/api/v1/candidates', 'POST', JSON.stringify({
        firstName: 'Test', lastName: 'Block', email: `block.${Date.now()}@test.com`
      }), interviewerToken);
      console.log('  Status:', r415.status);
      if (r415.status === 403) pass('4.15', 403, 'Interviewer correctly blocked');
      else fail('4.15', r415.status, `Expected 403, got ${r415.status}`);
    } else {
      results['4.15'] = { status: 'BLOCKED', http: 'N/A', note: 'No interviewer user found in DB' };
      console.log('  ⚠️  BLOCKED — No interviewer user found');
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(60));
    console.log('FINAL RESULTS');
    console.log('='.repeat(60));
    let passed = 0, failed = 0, blocked = 0;
    for (const [id, r] of Object.entries(results)) {
      const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`  ${icon} ${id}: ${r.status} (${r.http}) — ${r.note}`);
      if (r.status === 'PASS') passed++;
      else if (r.status === 'FAIL') failed++;
      else blocked++;
    }
    console.log(`\nTotal: ${passed + failed + blocked} | PASS: ${passed} | FAIL: ${failed} | BLOCKED: ${blocked}`);
    console.log(`Pass Rate: ${Math.round(passed / (passed + failed + blocked) * 100)}%`);

    // Print IDs for the QA doc
    console.log('\n--- CANDIDATE IDs FOR MODULE 5 ---');
    console.log('Amit:', amitId || 'NOT CREATED');
    console.log('Priya:', results['4.9']?.status === 'PASS' ? results['4.9'].note.split('Priya: ')[1]?.split(' |')[0] : 'NOT CREATED');
    console.log('Rahul:', results['4.9']?.status === 'PASS' ? results['4.9'].note.split('Rahul: ')[1] : 'NOT CREATED');

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
