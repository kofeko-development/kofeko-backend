async function test() {
    const email = 'himanshuvaghela019@gmail.com';
    const password = 'Password@123';
    const tenantSlug = 'wildmind-ai';
    
    try {
        const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, tenantSlug })
        });
        const loginData = await loginRes.json();
        if (!loginData.success || !loginData.data?.accessToken) {
            console.error('Login Failed:', loginData);
            return;
        }
        const token = loginData.data.accessToken;
        console.log('Login successful');
        
        const headers = { Authorization: `Bearer ${token}` };
        
        // List jobs
        const jobsRes = await fetch('http://localhost:5000/api/v1/jobs', { headers });
        const jobsData = await jobsRes.json();
        const jobs = jobsData.data?.items || [];
        console.log(`Found ${jobs.length} jobs`);
        
        if (jobs.length > 0) {
            const jobId = jobs[0].id;
            console.log(`Testing GET /jobs/${jobId}`);
            const jobRes = await fetch(`http://localhost:5000/api/v1/jobs/${jobId}`, { headers });
            const jobData = await jobRes.json();
            console.log('GET Job Success:', jobData.data?.title || jobData);
        } else {
            console.log('No jobs found to test GET');
        }
    } catch (err) {
        console.error('Unexpected Error:', err.message);
    }
}

test();
