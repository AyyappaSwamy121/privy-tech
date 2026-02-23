$ErrorActionPreference = "Stop"
$BaseUrl = "http://localhost:5000"

Write-Host "--- STARTING PRINT LIMIT TEST (PowerShell) ---"

# 1. Create dummy file
"test content" | Set-Content -Path "test.txt"

# 2. Upload file
Write-Host "1. Uploading file..."
$boundary = [System.Guid]::NewGuid().ToString() 
$LF = "`r`n"

$fileContent = [System.IO.File]::ReadAllBytes("test.txt")
$fileHeader = "--$boundary$LF" +
              "Content-Disposition: form-data; name=`"file`"; filename=`"test.txt`"$LF" +
              "Content-Type: text/plain$LF$LF"
$fileFooter = "$LF--$boundary--"

$limitHeader = "--$boundary$LF" +
               "Content-Disposition: form-data; name=`"printLimit`"$LF$LF" +
               "1$LF"

$expiryHeader = "--$boundary$LF" +
                "Content-Disposition: form-data; name=`"expiry`"$LF$LF" +
                "5$LF"

$body = [System.Text.Encoding]::ASCII.GetBytes($limitHeader + $expiryHeader + $fileHeader) + $fileContent + [System.Text.Encoding]::ASCII.GetBytes($fileFooter)

try {
    $uploadResponse = Invoke-RestMethod -Uri "$BaseUrl/api/upload" -Method Post -ContentType "multipart/form-data; boundary=$boundary" -Body $body
    $code = $uploadResponse.code
    Write-Host "✅ Upload Success. Code: $code"
} catch {
    Write-Error "Upload Failed: $_"
    exit 1
}

# 3. Verify Initial
Write-Host "2. Verifying document..."
$verify = Invoke-RestMethod -Uri "$BaseUrl/api/document/verify/$code"
if ($verify.printLimit -ne 1) {
    Write-Error "Print limit is $($verify.printLimit), expected 1"
} else {
    Write-Host "✅ Print Limit Correct: 1"
}

# 4. Print 1 (Should Succeed)
Write-Host "3. Attempting 1st Print..."
try {
    $print1 = Invoke-RestMethod -Uri "$BaseUrl/api/document/printed/$code" -Method Post
    if ($print1.success -eq $true) {
        Write-Host "✅ Print 1 Success."
    } else {
        Write-Error "Print 1 Failed unexpectedly."
    }
} catch {
    Write-Error "Print 1 Failed: $_"
}

# 5. Print 2 (Should Fail)
Write-Host "4. Attempting 2nd Print (Should Fail)..."
try {
    Invoke-RestMethod -Uri "$BaseUrl/api/document/printed/$code" -Method Post
    Write-Error "❌ Print 2 Succeeded but should have failed!"
} catch {
    $resp = $_.Exception.Response
    if ($resp.StatusCode -eq 410 -or $resp.StatusCode -eq 400) {
        Write-Host "✅ Print 2 Correctly Failed. ($($resp.StatusCode))"
    } else {
        Write-Error "❌ Print 2 Failed with unexpected status: $($resp.StatusCode)"
    }
}

Write-Host "--- TEST COMPLETE ---"
