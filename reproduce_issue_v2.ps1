$headers = @{
    "Content-Type" = "application/json"
}
# Mimic a Face Descriptor (array of floats)
$faceData = @(0.1, 0.2, 0.3, 0.4, 0.5)

$body = @{
    firstName       = "TestFace"
    lastName        = "UserFace"
    username        = "testuser_face_" + (Get-Date).Ticks
    password        = "password123"
    confirmPassword = "password123"
    faceDescriptor  = $faceData
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://localhost/kinita/public/api/register_owner.php" -Method Post -Headers $headers -Body $body
    Write-Host "Response: " $response.Content
}
catch {
    Write-Host "Error: " $_
    # Read response body from exception if available
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader $_.Exception.Response.GetResponseStream()
        $respBody = $reader.ReadToEnd()
        Write-Host "Error Response Body: " $respBody
    }
}
