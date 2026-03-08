$headers = @{
    "Content-Type" = "application/json"
}
$body = @{
    firstName       = "Test"
    lastName        = "User"
    username        = "testuser_debug_" + (Get-Date).Ticks
    password        = "password123"
    confirmPassword = "password123"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://localhost/kinita/public/api/register_owner.php" -Method Post -Headers $headers -Body $body
    Write-Host "Response: " $response.Content
}
catch {
    Write-Host "Error: " $_
    Write-Host "Response: " $_.Exception.Response.GetResponseStream()
}
