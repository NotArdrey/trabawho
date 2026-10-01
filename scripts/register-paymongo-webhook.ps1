param(
  [string]$ProjectRef = "dczhfpcfqlygpbqjctwf"
)

$ErrorActionPreference = "Stop"
$endpoint = "https://$ProjectRef.supabase.co/functions/v1/paymongo-webhook"
$secureValue = Read-Host "PayMongo test secret" -AsSecureString
$secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
$tempSecretFile = $null

try {
  $plainValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
  $basicBytes = [Text.Encoding]::ASCII.GetBytes("${plainValue}:")
  $headers = @{
    Accept = "application/json"
    Authorization = "Basic $([Convert]::ToBase64String($basicBytes))"
  }

  $existingResponse = Invoke-RestMethod `
    -Uri "https://api.paymongo.com/v1/webhooks" `
    -Headers $headers `
    -Method Get
  $existing = @($existingResponse.data) |
    Where-Object { $_.attributes.url -eq $endpoint } |
    Select-Object -First 1

  if ($existing) {
    $webhookResponse = Invoke-RestMethod `
      -Uri "https://api.paymongo.com/v1/webhooks/$($existing.id)" `
      -Headers $headers `
      -Method Get
    $created = $false
  } else {
    $body = @{
      data = @{
        attributes = @{
          events = @("checkout_session.payment.paid")
          url = $endpoint
        }
      }
    } | ConvertTo-Json -Depth 6
    $createHeaders = $headers.Clone()
    $createHeaders["Content-Type"] = "application/json"
    $webhookResponse = Invoke-RestMethod `
      -Uri "https://api.paymongo.com/v1/webhooks" `
      -Headers $createHeaders `
      -Method Post `
      -Body $body
    $created = $true
  }

  $webhook = $webhookResponse.data
  $signingSecret = [string]$webhook.attributes.secret_key
  if ([string]::IsNullOrWhiteSpace($signingSecret)) {
    throw "PayMongo did not return a signing secret. Rotate the existing endpoint secret in the PayMongo dashboard."
  }

  $tempSecretFile = [IO.Path]::GetTempFileName()
  [IO.File]::WriteAllText(
    $tempSecretFile,
    "PAYMONGO_WEBHOOK_SECRET=$signingSecret`n",
    [Text.UTF8Encoding]::new($false)
  )
  & npx supabase secrets set --env-file $tempSecretFile --project-ref $ProjectRef
  if ($LASTEXITCODE -ne 0) {
    throw "Supabase rejected the PayMongo webhook signing secret."
  }

  $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()
  $verificationBody = '{"data":{"id":"evt_signature_check","type":"event","attributes":{"type":"verification.test"}}}'
  $hmac = [Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($signingSecret))
  try {
    $signatureBytes = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes("$timestamp.$verificationBody"))
    $signature = ([BitConverter]::ToString($signatureBytes) -replace "-", "").ToLowerInvariant()
  } finally {
    $hmac.Dispose()
  }
  try {
    Invoke-WebRequest `
      -Uri $endpoint `
      -Method Post `
      -ContentType "application/json" `
      -Headers @{ "Paymongo-Signature" = "t=$timestamp,te=$signature,li=" } `
      -Body $verificationBody | Out-Null
    throw "Webhook verification unexpectedly accepted the diagnostic payload."
  } catch {
    $statusCode = [int]$_.Exception.Response.StatusCode
    if ($statusCode -ne 400) {
      throw "Webhook signature verification failed with HTTP $statusCode."
    }
  }

  $action = if ($created) { "created" } else { "reused" }
  Write-Output "PayMongo webhook ${action}: $($webhook.id)"
  Write-Output "Webhook signing-secret verification: passed"
} finally {
  if ($tempSecretFile) {
    $resolvedTemp = [IO.Path]::GetFullPath($tempSecretFile)
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if (
      $resolvedTemp.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and
      (Test-Path -LiteralPath $resolvedTemp)
    ) {
      Remove-Item -LiteralPath $resolvedTemp -Force
    }
  }
  if ($secretPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
  }
  $plainValue = $null
  $signingSecret = $null
  $secureValue = $null
}
