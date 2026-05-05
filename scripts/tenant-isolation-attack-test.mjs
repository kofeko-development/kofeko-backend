const BASE_URL = 'http://localhost:5000/api/v1';

const randomSuffix = Date.now().toString().slice(-6);
const tenantA = {
  tenantName: `Tenant A ${randomSuffix}`,
  tenantSlug: `tenant-a-${randomSuffix}`,
  firstName: 'Alice',
  lastName: 'Admin',
  email: `alice.${randomSuffix}@example.com`,
  password: 'Admin@12345',
};

const tenantB = {
  tenantName: `Tenant B ${randomSuffix}`,
  tenantSlug: `tenant-b-${randomSuffix}`,
  firstName: 'Bob',
  lastName: 'Admin',
  email: `bob.${randomSuffix}@example.com`,
  password: 'Admin@12345',
};

const results = [];

const pushResult = (name, pass, details) => {
  results.push({ name, pass, details });
};

const api = async (path, options = {}) => {
  const mergedHeaders = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: mergedHeaders,
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return { status: response.status, ok: response.ok, body };
};

const authHeader = (accessToken) => ({ Authorization: `Bearer ${accessToken}` });

try {
  const registerA = await api('/auth/register-admin', { method: 'POST', body: JSON.stringify(tenantA) });
  const registerB = await api('/auth/register-admin', { method: 'POST', body: JSON.stringify(tenantB) });

  if (!registerA.ok || !registerB.ok) {
    throw new Error(`Failed to register tenants: A=${registerA.status}, B=${registerB.status}`);
  }

  const tokenA = registerA.body.data.accessToken;
  const tokenB = registerB.body.data.accessToken;
  const userA = registerA.body.data.user;
  const userB = registerB.body.data.user;
  const tenantAId = registerA.body.data.tenant.id;
  const tenantBId = registerB.body.data.tenant.id;

  pushResult(
    'Auth response excludes passwordHash',
    !('passwordHash' in userA) && !('passwordHash' in userB),
    `A keys: ${Object.keys(userA).join(',')}`,
  );

  pushResult(
    'Auth response includes permissions and roles',
    Array.isArray(userA.permissions) && Array.isArray(userA.roles),
    `permissions=${Array.isArray(userA.permissions)}, roles=${Array.isArray(userA.roles)}`,
  );

  const meA = await api('/auth/me', { method: 'GET', headers: authHeader(tokenA) });
  pushResult(
    '/auth/me is tenant-scoped',
    meA.ok && meA.body.data.tenantId === tenantAId,
    `status=${meA.status}, tenant=${meA.body?.data?.tenantId}`,
  );

  const createJobA = await api('/jobs', {
    method: 'POST',
    headers: authHeader(tokenA),
    body: JSON.stringify({
      tenantId: tenantBId,
      title: 'A confidential role',
      description: 'Confidential role for tenant A testing.',
      location: 'Remote',
      employmentType: 'full-time',
    }),
  });
  const jobAId = createJobA.body?.data?.id;
  const jobATenant = createJobA.body?.data?.tenantId;
  pushResult(
    'Create job ignores body tenantId override',
    createJobA.ok && jobATenant === tenantAId,
    `status=${createJobA.status}, tenant=${jobATenant}, message=${createJobA.body?.message ?? 'n/a'}, details=${JSON.stringify(createJobA.body?.details ?? null)}`,
  );

  const readJobCross = await api(`/jobs/${jobAId}`, { method: 'GET', headers: authHeader(tokenB) });
  pushResult(
    'Cross-tenant GET by id blocked',
    !readJobCross.ok,
    `status=${readJobCross.status}`,
  );

  const updateJobCross = await api(`/jobs/${jobAId}`, {
    method: 'PATCH',
    headers: authHeader(tokenB),
    body: JSON.stringify({ title: 'Hacked title' }),
  });
  pushResult(
    'Cross-tenant PATCH by id blocked',
    !updateJobCross.ok,
    `status=${updateJobCross.status}`,
  );

  const listJobsCrossQuery = await api(`/jobs?tenantId=${tenantAId}`, {
    method: 'GET',
    headers: authHeader(tokenB),
  });
  const crossJobs = listJobsCrossQuery.body?.data ?? [];
  pushResult(
    'List jobs ignores query tenantId override',
    listJobsCrossQuery.ok && crossJobs.length === 0,
    `status=${listJobsCrossQuery.status}, count=${crossJobs.length}`,
  );

  const listUsersCrossQuery = await api(`/users?tenantId=${tenantAId}`, {
    method: 'GET',
    headers: authHeader(tokenB),
  });
  const userEmails = (listUsersCrossQuery.body?.data ?? []).map((u) => u.email);
  pushResult(
    'List users ignores query tenantId override',
    listUsersCrossQuery.ok && !userEmails.includes(tenantA.email),
    `status=${listUsersCrossQuery.status}, emails=${userEmails.join('|')}`,
  );

  const createRoleCrossTenant = await api('/rbac/roles', {
    method: 'POST',
    headers: authHeader(tokenB),
    body: JSON.stringify({
      tenantId: tenantAId,
      name: `role-b-${randomSuffix}`,
      description: 'Should be created in B tenant only',
    }),
  });
  pushResult(
    'RBAC role create ignores body tenantId override',
    createRoleCrossTenant.ok && createRoleCrossTenant.body?.data?.tenantId === tenantBId,
    `status=${createRoleCrossTenant.status}, tenant=${createRoleCrossTenant.body?.data?.tenantId}, message=${createRoleCrossTenant.body?.message ?? 'n/a'}, details=${JSON.stringify(createRoleCrossTenant.body?.details ?? null)}`,
  );

  const getTenantCross = await api(`/tenants/${tenantAId}`, {
    method: 'GET',
    headers: authHeader(tokenB),
  });
  pushResult(
    'Cross-tenant tenant/:id blocked',
    !getTenantCross.ok && getTenantCross.status === 403,
    `status=${getTenantCross.status}`,
  );

  const companyUnauthorized = await api('/companies/register', {
    method: 'POST',
    body: JSON.stringify({
      companyName: 'NoAuth Co',
      companyAddress: { country: 'IN', state: 'MH', city: 'Pune', fullAddress: 'Addr', zipCode: '411001' },
      industry: 'Tech',
      companySize: '1-10',
      companyType: 'startup',
      foundedYear: 2024,
      companyWebsite: 'https://example.com',
      officialCompanyAddress: 'Addr',
      companyLogo: 'logo.png',
      shortDescription: 'desc',
      termsAccepted: true,
    }),
  });
  pushResult(
    'Company route requires auth',
    !companyUnauthorized.ok && companyUnauthorized.status === 401,
    `status=${companyUnauthorized.status}`,
  );

  const createCandidateA = await api('/candidates', {
    method: 'POST',
    headers: authHeader(tokenA),
    body: JSON.stringify({
      tenantId: tenantBId,
      firstName: 'Cand',
      lastName: 'One',
      email: `candidate.${randomSuffix}@example.com`,
      status: 'new',
    }),
  });
  const candidateAId = createCandidateA.body?.data?.id;
  pushResult(
    'Create candidate ignores body tenantId override',
    createCandidateA.ok && createCandidateA.body?.data?.tenantId === tenantAId,
    `status=${createCandidateA.status}, tenant=${createCandidateA.body?.data?.tenantId}`,
  );

  const readCandidateCross = await api(`/candidates/${candidateAId}`, {
    method: 'GET',
    headers: authHeader(tokenB),
  });
  pushResult(
    'Cross-tenant candidate GET blocked',
    !readCandidateCross.ok,
    `status=${readCandidateCross.status}`,
  );

  const createMetricCross = await api('/analytics/metrics', {
    method: 'POST',
    headers: authHeader(tokenB),
    body: JSON.stringify({
      tenantId: tenantAId,
      name: 'pipeline_velocity',
      value: 12,
      dimension: 'weekly',
    }),
  });
  pushResult(
    'Create metric ignores body tenantId override',
    createMetricCross.ok && createMetricCross.body?.data?.tenantId === tenantBId,
    `status=${createMetricCross.status}, tenant=${createMetricCross.body?.data?.tenantId}`,
  );

  const createAuditCross = await api('/audit/logs', {
    method: 'POST',
    headers: authHeader(tokenB),
    body: JSON.stringify({
      tenantId: tenantAId,
      actorId: userA.id,
      action: 'create',
      entityType: 'ManualCheck',
      entityId: `audit-${randomSuffix}`,
    }),
  });
  pushResult(
    'Create audit ignores body tenantId/actorId override',
    createAuditCross.ok &&
      createAuditCross.body?.data?.tenantId === tenantBId &&
      createAuditCross.body?.data?.actorId === userB.id,
    `status=${createAuditCross.status}, tenant=${createAuditCross.body?.data?.tenantId}, actor=${createAuditCross.body?.data?.actorId}`,
  );

  const notifA = await api('/communication/notifications', {
    method: 'POST',
    headers: authHeader(tokenA),
    body: JSON.stringify({
      tenantId: tenantBId,
      channel: 'in_app',
      title: 'Private notice',
      body: 'for tenant A only',
      recipient: tenantA.email,
    }),
  });
  const notifAId = notifA.body?.data?.id;
  const markNotifCross = await api(`/communication/notifications/${notifAId}/read`, {
    method: 'PATCH',
    headers: authHeader(tokenB),
  });
  pushResult(
    'Cross-tenant notification read blocked',
    !markNotifCross.ok,
    `status=${markNotifCross.status}`,
  );

  const companyA = await api('/companies/register', {
    method: 'POST',
    headers: authHeader(tokenA),
    body: JSON.stringify({
      companyName: `A Corp ${randomSuffix}`,
      companyAddress: { country: 'IN', state: 'MH', city: 'Pune', fullAddress: 'Addr A', zipCode: '411001' },
      industry: 'Tech',
      companySize: '1-10',
      companyType: 'startup',
      foundedYear: 2024,
      companyWebsite: 'https://a.example.com',
      officialCompanyAddress: 'Addr A',
      companyLogo: 'a-logo.png',
      shortDescription: 'A company',
      termsAccepted: true,
    }),
  });
  const companyAId = companyA.body?.data?.id;
  const companyByBUsingAId = await api(`/companies/${companyAId}`, {
    method: 'GET',
    headers: authHeader(tokenB),
  });
  pushResult(
    'Company GET does not leak cross-tenant by id',
    !companyByBUsingAId.ok || companyByBUsingAId.body?.data?.id !== companyAId,
    `status=${companyByBUsingAId.status}, returned=${companyByBUsingAId.body?.data?.id ?? 'none'}`,
  );

  const passCount = results.filter((r) => r.pass).length;
  const failCount = results.length - passCount;

  console.log(JSON.stringify({ passCount, failCount, results }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ fatal: true, error: String(error) }, null, 2));
  process.exit(1);
}
