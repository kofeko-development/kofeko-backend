const fs = require('fs');

async function main() {
    const email = 'himanshuvaghela019@gmail.com';
    const password = 'Password@123';
    const tenantSlug = 'wildmind-ai';
    
    // Login
    const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, tenantSlug })
    });
    const loginData = await loginRes.json();
    const token = loginData.data.accessToken;
    console.log('Login successful');

    // Create a dummy resume file
    const resumeContent = `Rahul Mehta
Full Stack Developer
Skills: React, TypeScript, Node.js, Next.js, PostgreSQL
Experience:
- Senior Developer at TechCorp (2020-2024): Built high-performance React applications using Next.js and TypeScript.
- Junior Developer at WebSoft (2018-2020): Worked on Node.js backends and PostgreSQL databases.
Education: B.Tech in Computer Science from IIT Mumbai.`;
    
    fs.writeFileSync('rahul_resume.txt', resumeContent);
    console.log('Dummy resume created');

    // Upload resume
    const formData = new FormData();
    const fileBuffer = fs.readFileSync('rahul_resume.txt');
    const blob = new Blob([fileBuffer], { type: 'text/plain' });
    formData.append('resume', blob, 'rahul_resume.txt');
    
    const uploadRes = await fetch('http://localhost:5000/api/v1/candidates/upload-resume', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`
        },
        body: formData
    });
    
    const uploadData = await uploadRes.json();
    if (!uploadData.success) {
        console.error('Upload Failed:', uploadData);
        return;
    }
    const resumeUrl = uploadData.data.url;
    console.log('Resume uploaded:', resumeUrl);

    // Update Rahul Mehta candidate with this resume
    const candidateId = 'fdab1639-3123-45bb-afd2-c12ec3cb7f5d';
    const updateRes = await fetch(`http://localhost:5000/api/v1/candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
            resumeUrl,
            resumeMimeType: 'text/plain'
        })
    });
    const updateData = await updateRes.json();
    if (!updateData.success) {
        console.error('Update Failed:', updateData);
        return;
    }
    console.log('Rahul Mehta updated with resume');
}

main().catch(err => console.error('Error:', err.message));
