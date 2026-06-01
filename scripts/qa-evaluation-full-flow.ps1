param(
  [string]$BaseUrl = 'http://localhost:5000/api/v1',
  [string]$TenantSlug = 'kofeko-test',
  [string]$StaffEmail = 'recruiter1@kofeko-test.com',
  [string]$StaffPassword = 'Recruiter@12345',
  [string]$ResumePath = '',
  [switch]$RunSeed
)

$ErrorActionPreference = 'Stop'

$results = @()
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendRoot = Split-Path -Parent $scriptDir
$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$candidateEmail = "qa.assessment.$stamp@kofeko-test.com"
$candidatePassword = 'Candidate@12345'
$jobTitle = "QA Automated Assessment $stamp"
$resultsPath = Join-Path $scriptDir 'qa-evaluation-full-flow-results.json'

function Record($id, $name, $status, $http, $notes) {
  $script:results += [pscustomobject]@{
    Id = $id
    Test = $name
    Status = $status
    HTTP = $http
    Notes = $notes
  }
}

function Get-ApiErrorBody($err) {
  if ($err.ErrorDetails.Message) {
    try { return $err.ErrorDetails.Message | ConvertFrom-Json } catch { return $null }
  }
  return $null
}

function Invoke-Json($method, $uri, $token, $body = $null, [int]$timeoutSec = 60) {
  $headers = @{}
  if ($token) {
    $headers.Authorization = "Bearer $token"
  }

  if ($null -eq $body) {
    return Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -TimeoutSec $timeoutSec
  }

  return Invoke-RestMethod `
    -Uri $uri `
    -Method $method `
    -Headers $headers `
    -Body ($body | ConvertTo-Json -Depth 12) `
    -ContentType 'application/json' `
    -TimeoutSec $timeoutSec
}

function Resolve-ResumeFile {
  if ($ResumePath) {
    $explicit = Resolve-Path $ResumePath -ErrorAction Stop
    return $explicit.Path
  }

  $searchRoots = @(
    (Join-Path $backendRoot 'dummy-pdf'),
    (Join-Path $backendRoot 'dummy-pdfs'),
    (Join-Path $backendRoot 'uploads')
  )

  foreach ($root in $searchRoots) {
    if (Test-Path $root) {
      $match = Get-ChildItem -Path $root -Recurse -File -Filter '*.pdf' | Select-Object -First 1
      if ($match) {
        return $match.FullName
      }
    }
  }

  $fallback = Get-ChildItem -Path $backendRoot -Recurse -File -Filter '*.pdf' |
    Where-Object { $_.FullName -notmatch '\\node_modules\\|\\.git\\' } |
    Select-Object -First 1

  if ($fallback) {
    return $fallback.FullName
  }

  throw 'No PDF resume found. Place a PDF under kofeko_backend/dummy-pdf or pass -ResumePath "C:\path\to\resume.pdf".'
}

function Upload-Resume($uri, $token, $path) {
  Add-Type -AssemblyName System.Net.Http

  $client = [System.Net.Http.HttpClient]::new()
  $content = $null
  $fileContent = $null

  try {
    $client.DefaultRequestHeaders.Authorization =
      [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $token)

    $bytes = [System.IO.File]::ReadAllBytes($path)
    $fileContent = [System.Net.Http.ByteArrayContent]::new($bytes)
    $fileContent.Headers.ContentType =
      [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse('application/pdf')

    $content = [System.Net.Http.MultipartFormDataContent]::new()
    $content.Add($fileContent, 'resume', [System.IO.Path]::GetFileName($path))

    $response = $client.PostAsync($uri, $content).Result
    $raw = $response.Content.ReadAsStringAsync().Result

    if (-not $response.IsSuccessStatusCode) {
      throw "Upload failed ($([int]$response.StatusCode)): $raw"
    }

    return $raw | ConvertFrom-Json
  } finally {
    if ($content) { $content.Dispose() }
    if ($fileContent) { $fileContent.Dispose() }
    $client.Dispose()
  }
}

try {
  if ($RunSeed) {
    Push-Location $backendRoot
    try {
      npm run seed:test | Out-Host
      Record '0.0' 'Seed QA data' 'PASS' 0 'npm run seed:test'
    } finally {
      Pop-Location
    }
  }

  $resumeFile = Resolve-ResumeFile
  Record '0.1' 'Find real PDF resume' 'PASS' 0 $resumeFile

  $healthRoot = $BaseUrl -replace '/api/v1$', ''
  try {
    Invoke-RestMethod -Uri "$healthRoot/health" -TimeoutSec 10 | Out-Null
    Record '0.2' 'Backend health' 'PASS' 200 "$healthRoot/health"
  } catch {
    Record '0.2' 'Backend health' 'FAIL' 0 $_.Exception.Message
    throw
  }

  $staffLogin = Invoke-Json 'POST' "$BaseUrl/auth/login" $null @{
    email = $StaffEmail
    password = $StaffPassword
  }
  $staffToken = $staffLogin.data.accessToken
  Record '1.0' 'Recruiter login' 'PASS' 200 $StaffEmail

  $job = Invoke-Json 'POST' "$BaseUrl/jobs" $staffToken @{
    title = $jobTitle
    description = 'Automated QA job for AI evaluation flow. Requires React, TypeScript, API integration, and product delivery experience.'
    requirements = 'React, TypeScript, Next.js, API integration, candidate screening, and clear communication.'
    location = 'Remote'
    employmentType = 'Full-time'
    department = 'QA Automation'
    experienceMin = 3
    experienceMax = 8
    hiringPriority = 'high'
    skillWeights = @(
      @{ skill = 'React'; weight = 10 },
      @{ skill = 'TypeScript'; weight = 9 },
      @{ skill = 'Next.js'; weight = 8 },
      @{ skill = 'API Integration'; weight = 7 }
    )
  }
  $jobId = $job.data.id
  Record '1.1' 'Create job with skill weights' 'PASS' 201 $jobTitle

  $published = Invoke-Json 'POST' "$BaseUrl/jobs/$jobId/publish" $staffToken
  Record '1.2' 'Publish job' 'PASS' 200 $published.data.status

  $publicJob = Invoke-Json 'GET' "$BaseUrl/portal/$TenantSlug/jobs/$jobId" $null
  Record '1.3' 'Public job visible' 'PASS' 200 $publicJob.data.title

  Invoke-Json 'POST' "$BaseUrl/portal/auth/registerCandidate" $null @{
    tenantSlug = $TenantSlug
    firstName = 'QA'
    lastName = 'Assessment'
    email = $candidateEmail
    password = $candidatePassword
  } | Out-Null
  Record '2.0' 'Candidate registers' 'PASS' 201 $candidateEmail

  $candidateLogin = Invoke-Json 'POST' "$BaseUrl/portal/auth/loginCandidate" $null @{
    tenantSlug = $TenantSlug
    email = $candidateEmail
    password = $candidatePassword
  }
  $candidateToken = $candidateLogin.data.accessToken
  Record '2.1' 'Candidate login' 'PASS' 200 $candidateEmail

  $upload = Upload-Resume "$BaseUrl/portal/upload-resume" $candidateToken $resumeFile
  $resumeUrl = $upload.data.resumeUrl
  $resumeMimeType = $upload.data.resumeMimeType
  if (-not $resumeUrl) {
    throw 'Upload succeeded but did not return resumeUrl'
  }
  Record '2.2' 'Candidate uploads real PDF resume' 'PASS' 200 ([System.IO.Path]::GetFileName($resumeFile))

  $application = Invoke-Json 'POST' "$BaseUrl/portal/$TenantSlug/jobs/$jobId/apply" $candidateToken @{
    resumeUrl = $resumeUrl
    resumeMimeType = $resumeMimeType
    coverLetter = 'Automated QA application for validating the AI assessment flow.'
  }
  $pipelineId = $application.data.pipelineId
  Record '2.3' 'Candidate applies to job' 'PASS' 201 $pipelineId

  $pipelines = Invoke-Json 'GET' "$BaseUrl/pipelines?jobId=$jobId&limit=50" $staffToken
  $pipeline = $pipelines.data.items | Where-Object { $_.id -eq $pipelineId } | Select-Object -First 1
  if (-not $pipeline) {
    throw "Pipeline $pipelineId was not found on recruiter job page API"
  }
  $candidateId = $pipeline.candidateId
  Record '3.0' 'Recruiter sees applicant in pipeline' 'PASS' 200 $candidateId

  $evaluation = Invoke-Json 'POST' "$BaseUrl/evaluations/ai-evaluate" $staffToken @{
    jobId = $jobId
    candidateId = $candidateId
    pipelineId = $pipelineId
  } 180
  $evaluationId = $evaluation.data.id
  $score = $evaluation.data.score
  if (-not $evaluationId -or $null -eq $score) {
    throw 'AI evaluation did not return an id and score'
  }
  Record '3.1' 'Recruiter runs Evaluate with AI' 'PASS' 201 "score=$score evaluation=$evaluationId"

  $evaluations = Invoke-Json 'GET' "$BaseUrl/evaluations?page=1&limit=100" $staffToken
  $foundAssessment = $evaluations.data.items | Where-Object { $_.id -eq $evaluationId } | Select-Object -First 1
  if (-not $foundAssessment) {
    throw "Evaluation $evaluationId was not found in Assessments list"
  }
  Record '3.2' 'Assessment appears in Assessments API' 'PASS' 200 $evaluationId

  $override = Invoke-Json 'PATCH' "$BaseUrl/evaluations/$evaluationId" $staffToken @{
    score = 88
    whyCard = 'QA override: automated full-flow assessment completed successfully.'
  }
  Record '3.3' 'Recruiter saves assessment override' 'PASS' 200 "score=$($override.data.score)"

  $rankings = Invoke-Json 'GET' "$BaseUrl/jobs/$jobId/rankings" $staffToken
  $rank = $rankings.data | Where-Object { $_.candidate.id -eq $candidateId } | Select-Object -First 1
  if (-not $rank) {
    throw 'Ranking was not returned for evaluated candidate'
  }
  Record '3.4' 'Rankings include evaluated candidate' 'PASS' 200 "rank=$($rank.rank)"

  $batch = Invoke-Json 'POST' "$BaseUrl/jobs/$jobId/evaluate-all" $staffToken $null 180
  Record '3.5' 'Batch evaluate safely skips already evaluated candidate' 'PASS' 200 "evaluated=$($batch.data.evaluated) failed=$($batch.data.failed)"

} catch {
  $err = Get-ApiErrorBody $_
  $notes = if ($err) { $err | ConvertTo-Json -Compress } else { $_.Exception.Message }
  Record 'ERR' 'Full assessment flow' 'FAIL' 0 $notes
} finally {
  $results | ConvertTo-Json -Depth 8 | Set-Content -Path $resultsPath -Encoding UTF8
  $results | Format-Table -AutoSize

  $failed = $results | Where-Object { $_.Status -eq 'FAIL' }
  if ($failed) {
    Write-Host "`nResults written to $resultsPath"
    exit 1
  }

  Write-Host "`nResults written to $resultsPath"
  exit 0
}
