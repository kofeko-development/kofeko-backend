// Seed: register a portal candidate and apply to a job with token
const http = require('http');

async function makeRequest(path, method, body, token = null) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const opts = {
      hostname: '127.0.0.1', port: 5000, path, method,
      headers: { 
        'Content-Type': 'application/json', 
        'Content-Length': Buffer.byteLength(bodyStr) 
      }
    };
    if (token) {
        opts.headers['Authorization'] = `Bearer ${token}`;
    }
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, data }); }});
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function main() {
  const SLUG = 'wildmind-ai'; // From Module 5 output
  const email = 'portal.candidate@kofeko.dev';
  const password = 'Portal@123';

  console.log('--- Registering/Logging in Portal Candidate ---');

  // 1. Register (ignore if 409)
  await makeRequest('/api/v1/portal/auth/registerCandidate', 'POST', {
    tenantSlug: SLUG, firstName: 'Portal', lastName: 'Candidate',
    email, password
  });

  // 2. Login
  const loginRes = await makeRequest('/api/v1/portal/auth/loginCandidate', 'POST', { tenantSlug: SLUG, email, password });
  
  if (loginRes.status === 200) {
    const token = loginRes.data.data?.accessToken;
    console.log('Login successful. Token obtained.');

    // 3. Apply to the open job
    const JOB_ID = 'ad0370a2-3e52-464f-847c-80c10bf78856'; // Senior Frontend Developer
    console.log(`Applying to job: ${JOB_ID}`);
    const applyRes = await makeRequest(`/api/v1/portal/${SLUG}/jobs/${JOB_ID}/apply`, 'POST', {
      resumeUrl: 'https://example.com/portal-resume.pdf',
      resumeMimeType: 'application/pdf',
      coverLetter: 'I am very excited to apply for this role!'
    }, token);
    
    console.log('Apply status:', applyRes.status);
    if (applyRes.status === 201) {
        console.log('✅ Application successful!');
        console.log('Pipeline ID:', applyRes.data.data?.id);
    } else {
        console.log('Apply failed:', applyRes.data?.message || applyRes.data);
    }
  } else {
    console.log('Login failed:', loginRes.data?.message || loginRes.data);
  }
}

main().catch(console.error);
