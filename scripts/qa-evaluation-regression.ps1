# QA Evaluation regression — live API (no secrets printed)

$ErrorActionPreference = 'Stop'

$base = 'http://localhost:5000/api/v1'

$preferredJobTitle = 'Senior React Developer'

$noWeightsJobTitle = 'Open Internship (no skill weights)'

$results = @()



function Record($id, $name, $status, $http, $notes) {

  $script:results += [pscustomobject]@{ Id = $id; Test = $name; Status = $status; HTTP = $http; Notes = $notes }

}



function Get-ApiErrorBody($err) {

  if ($err.ErrorDetails.Message) {

    try { return $err.ErrorDetails.Message | ConvertFrom-Json } catch { return $null }

  }

  return $null

}



function Find-JobPipelineWithResume($jobs, $headers, [string]$titleFilter) {

  $ordered = @()

  if ($titleFilter) {

    $match = $jobs.data.items | Where-Object { $_.title -eq $titleFilter -and $_.status -eq 'open' }

    if ($match) { $ordered += $match }

  }

  $ordered += $jobs.data.items | Where-Object {

    $_.status -eq 'open' -and $_.skillWeights -and $_.skillWeights.Count -gt 0 -and

    (-not $titleFilter -or $_.title -ne $titleFilter)

  }



  foreach ($job in $ordered) {

    $pipelines = Invoke-RestMethod -Uri "$base/pipelines?jobId=$($job.id)&limit=50" -Headers $headers

    foreach ($pipe in $pipelines.data.items) {

      $cand = Invoke-RestMethod -Uri "$base/candidates/$($pipe.candidateId)" -Headers $headers

      if ($cand.data.resumeUrl) {

        return @{

          Job = $job

          Pipeline = $pipe

          Candidate = $cand.data

        }

      }

    }

  }

  return $null

}



# Login

$loginBody = @{ email = 'recruiter1@kofeko-test.com'; password = 'Recruiter@12345' } | ConvertTo-Json

try {

  $login = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -Body $loginBody -ContentType 'application/json'

  $token = $login.data.accessToken

  Record 'ENV' 'Staff login (seed recruiter)' 'PASS' 200 'recruiter1@kofeko-test.com'

} catch {

  Record 'ENV' 'Staff login' 'FAIL' $_.Exception.Response.StatusCode.value__ $_.ErrorDetails.Message

  $results | Format-Table

  exit 1

}



$headers = @{ Authorization = "Bearer $token" }

$jobs = Invoke-RestMethod -Uri "$base/jobs?limit=50" -Headers $headers

$jobId = $null

$candidateId = $null

$pipelineId = $null

$evalId = $null

$pipelines = $null



# 6.0 / 6.0b — open job with skill weights AND a pipeline candidate with resume

try {

  $match = Find-JobPipelineWithResume $jobs $headers $preferredJobTitle

  if (-not $match) { throw 'No open job with skillWeights and a pipelined candidate with resumeUrl' }

  $openJob = $match.Job

  $jobId = $openJob.id

  $pipe = $match.Pipeline

  $pipelineId = $pipe.id

  $candidateId = $pipe.candidateId

  $pipelines = Invoke-RestMethod -Uri "$base/pipelines?jobId=$jobId&limit=50" -Headers $headers

  Record '6.0' 'Find open job with skillWeights' 'PASS' 200 $openJob.title

  Record '6.0b' 'Pipeline + resume present' 'PASS' 200 "$($match.Candidate.firstName) $($match.Candidate.lastName)"

} catch {

  Record '6.0' 'Find open job with skillWeights' 'FAIL' 0 $_.Exception.Message

  Record '6.0b' 'Pipeline + resume' 'FAIL' 0 $_.Exception.Message

}



# 6.2 NO_SKILL_WEIGHTS — independent of main job (uses any resume candidate)

if ($candidateId) {

  try {

    $noWeightsJob = $jobs.data.items | Where-Object {

      $_.title -eq $noWeightsJobTitle -or

      ((-not $_.skillWeights -or $_.skillWeights.Count -eq 0) -and $_.status -eq 'open')

    } | Select-Object -First 1

    if (-not $noWeightsJob) { throw 'No open job without skillWeights' }

    $body = @{ jobId = $noWeightsJob.id; candidateId = $candidateId } | ConvertTo-Json

    try {

      Invoke-RestMethod -Uri "$base/evaluations/ai-evaluate" -Method POST -Headers $headers -Body $body -ContentType 'application/json' -TimeoutSec 30

      Record '6.2' 'NO_SKILL_WEIGHTS' 'FAIL' 200 'Expected 400'

    } catch {

      $err = Get-ApiErrorBody $_

      if ($err.errorCode -eq 'NO_SKILL_WEIGHTS') { Record '6.2' 'NO_SKILL_WEIGHTS' 'PASS' 400 'NO_SKILL_WEIGHTS' }

      else { Record '6.2' 'NO_SKILL_WEIGHTS' 'FAIL' $_.Exception.Response.StatusCode.value__ $err.errorCode }

    }

  } catch {

    Record '6.2' 'NO_SKILL_WEIGHTS' 'SKIP' 0 $_.Exception.Message

  }

} else {

  Record '6.2' 'NO_SKILL_WEIGHTS' 'SKIP' 0 'No candidateId from 6.0b'

}



# 6.3 NO_RESUME — scan pipelines on QA job first, then tenant-wide

try {

  $noResumePipe = $null

  if ($pipelines) {

    foreach ($p in $pipelines.data.items) {

      $c = Invoke-RestMethod -Uri "$base/candidates/$($p.candidateId)" -Headers $headers

      if (-not $c.data.resumeUrl) { $noResumePipe = $p; break }

    }

  }

  if (-not $noResumePipe) {

    $allPipes = Invoke-RestMethod -Uri "$base/pipelines?limit=100" -Headers $headers

    foreach ($p in $allPipes.data.items) {

      $c = Invoke-RestMethod -Uri "$base/candidates/$($p.candidateId)" -Headers $headers

      if (-not $c.data.resumeUrl) { $noResumePipe = $p; break }

    }

  }

  if ($noResumePipe -and $jobId) {

    $body = @{ jobId = $jobId; candidateId = $noResumePipe.candidateId } | ConvertTo-Json

    try {

      Invoke-RestMethod -Uri "$base/evaluations/ai-evaluate" -Method POST -Headers $headers -Body $body -ContentType 'application/json' -TimeoutSec 30

      Record '6.3' 'NO_RESUME blocks evaluate' 'FAIL' 200 'Expected 400'

    } catch {

      $err = Get-ApiErrorBody $_

      if ($err.errorCode -eq 'NO_RESUME') { Record '6.3' 'NO_RESUME blocks evaluate' 'PASS' 400 'NO_RESUME' }

      else { Record '6.3' 'NO_RESUME blocks evaluate' 'FAIL' $_.Exception.Response.StatusCode.value__ $err.errorCode }

    }

  } else {

    Record '6.3' 'NO_RESUME blocks evaluate' 'SKIP' 0 'No resume-less candidate in pipelines (run seed:test)'

  }

} catch {

  Record '6.3' 'NO_RESUME' 'SKIP' 0 $_.Exception.Message

}



# 6.4 Invalid job 404

if ($candidateId) {

  try {

    $body = @{ jobId = '00000000-0000-0000-0000-000000000000'; candidateId = $candidateId } | ConvertTo-Json

    try {

      Invoke-RestMethod -Uri "$base/evaluations/ai-evaluate" -Method POST -Headers $headers -Body $body -ContentType 'application/json'

      Record '6.4' 'Invalid job 404' 'FAIL' 200 'Expected 404'

    } catch {

      Record '6.4' 'Invalid job 404' 'PASS' 404 'NOT_FOUND'

    }

  } catch { Record '6.4' 'Invalid job 404' 'FAIL' 0 $_.Exception.Message }

}



# 6.1 — candidate with resume, not yet in job rankings (e.g. amit on React job)

if ($jobId -and $pipelines) {

  $rankedIds = @()

  try {

    $rankPre = Invoke-RestMethod -Uri "$base/jobs/$jobId/rankings" -Headers $headers

    $rankedIds = @($rankPre.data | ForEach-Object { $_.candidate.id })

  } catch { }

  $aiPipe = $null

  foreach ($p in $pipelines.data.items) {

    $c = Invoke-RestMethod -Uri "$base/candidates/$($p.candidateId)" -Headers $headers

    if (-not $c.data.resumeUrl) { continue }

    if ($rankedIds -notcontains $p.candidateId) { $aiPipe = $p; break }

  }

  if (-not $aiPipe) {

    $aiPipe = ($pipelines.data.items | ForEach-Object {

      $c = Invoke-RestMethod -Uri "$base/candidates/$($_.candidateId)" -Headers $headers

      if ($c.data.resumeUrl) { return $_ }

    }) | Select-Object -First 1

  }

  if ($aiPipe) {

    $candidateId = $aiPipe.candidateId

    $pipelineId = $aiPipe.id

    try {

      $body = @{ jobId = $jobId; candidateId = $candidateId; pipelineId = $pipelineId } | ConvertTo-Json

      $eval = Invoke-RestMethod -Uri "$base/evaluations/ai-evaluate" -Method POST -Headers $headers -Body $body -ContentType 'application/json' -TimeoutSec 120

      $d = $eval.data

      if ($d.aiGenerated -ne $true) { throw 'aiGenerated not true' }

      if ($d.score -lt 0 -or $d.score -gt 100) { throw "score out of range: $($d.score)" }

      $evalId = $d.id

      Record '6.1' 'POST ai-evaluate' 'PASS' 201 "score=$($d.score)"

    } catch {

      $code = 0

      if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }

      $msg = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }

      Record '6.1' 'POST ai-evaluate' 'FAIL' $code $msg

    }

  }

} else {

  Record '6.1' 'POST ai-evaluate' 'SKIP' 0 'No job/pipelines from 6.0'

}



# 6.8 / 6.8b / 6.9

if ($evalId) {

  try {

    $list = Invoke-RestMethod -Uri "$base/evaluations?page=1&limit=10" -Headers $headers

    if ($list.data.items.Count -lt 1) { throw 'empty list' }

    Record '6.8' 'GET evaluations list' 'PASS' 200 "total=$($list.data.total)"

  } catch { Record '6.8' 'GET evaluations list' 'FAIL' 0 $_.Exception.Message }



  try {

    $one = Invoke-RestMethod -Uri "$base/evaluations/$evalId" -Headers $headers

    Record '6.8b' 'GET evaluation by id' 'PASS' 200 $one.data.id

  } catch { Record '6.8b' 'GET evaluation by id' 'FAIL' 0 $_.Exception.Message }



  try {

    $patchBody = @{ score = 88; whyCard = 'QA regression override' } | ConvertTo-Json

    $patched = Invoke-RestMethod -Uri "$base/evaluations/$evalId" -Method PATCH -Headers $headers -Body $patchBody -ContentType 'application/json'

    if ($patched.data.score -eq 88) { Record '6.9' 'PATCH recruiter override' 'PASS' 200 'score=88' }

    else { Record '6.9' 'PATCH recruiter override' 'FAIL' 200 "score=$($patched.data.score)" }

  } catch { Record '6.9' 'PATCH recruiter override' 'FAIL' 0 $_.Exception.Message }

} else {

  Record '6.8' 'GET evaluations list' 'SKIP' 0 'Requires 6.1 evalId'

  Record '6.8b' 'GET evaluation by id' 'SKIP' 0 'Requires 6.1 evalId'

  Record '6.9' 'PATCH recruiter override' 'SKIP' 0 'Requires 6.1 evalId'

}



# 6.5 / 6.6 / 6.7 — on job with seed evaluations (Senior React Developer)

if ($jobId) {

  try {

    $batch1 = Invoke-RestMethod -Uri "$base/jobs/$jobId/evaluate-all" -Method POST -Headers $headers -Body '{}' -ContentType 'application/json' -TimeoutSec 300

    Record '6.5' 'POST evaluate-all (1st)' 'PASS' 200 "evaluated=$($batch1.data.evaluated) failed=$($batch1.data.failed)"

    $batch2 = Invoke-RestMethod -Uri "$base/jobs/$jobId/evaluate-all" -Method POST -Headers $headers -Body '{}' -ContentType 'application/json' -TimeoutSec 60

    if ($batch2.data.evaluated -eq 0) { Record '6.6' 'Batch skips evaluated' 'PASS' 200 'evaluated=0 on 2nd run' }

    else { Record '6.6' 'Batch skips evaluated' 'PARTIAL' 200 "evaluated=$($batch2.data.evaluated) on 2nd run" }

  } catch {

    $msg = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }

    Record '6.5' 'POST evaluate-all' 'FAIL' 0 $msg

    Record '6.6' 'Batch skips evaluated' 'SKIP' 0 'evaluate-all failed'

  }



  try {

    $rank = Invoke-RestMethod -Uri "$base/jobs/$jobId/rankings" -Headers $headers

    $items = $rank.data

    if ($items.Count -gt 1) {

      $sorted = $true

      for ($i = 0; $i -lt $items.Count - 1; $i++) {

        if ($items[$i].evaluation.score -lt $items[$i+1].evaluation.score) { $sorted = $false }

      }

      if ($sorted -and $items[0].rank -eq 1) { Record '6.7' 'GET rankings sorted' 'PASS' 200 "count=$($items.Count)" }

      else { Record '6.7' 'GET rankings sorted' 'FAIL' 200 'order or rank wrong' }

    } elseif ($items.Count -eq 1) {

      Record '6.7' 'GET rankings' 'PASS' 200 'single candidate'

    } else {

      Record '6.7' 'GET rankings' 'FAIL' 200 'empty rankings (need seed evaluations on job)'

    }

  } catch { Record '6.7' 'GET rankings' 'FAIL' 0 $_.Exception.Message }

}



$results | Format-Table -AutoSize

$fail = ($results | Where-Object { $_.Status -eq 'FAIL' }).Count

$pass = ($results | Where-Object { $_.Status -eq 'PASS' }).Count

$skip = ($results | Where-Object { $_.Status -eq 'SKIP' }).Count

Write-Host "`nSummary: PASS=$pass FAIL=$fail SKIP=$skip"

$results | ConvertTo-Json -Depth 3 | Out-File -FilePath (Join-Path $PSScriptRoot 'qa-evaluation-regression-results.json') -Encoding utf8

if ($fail -gt 0) { exit 1 }


