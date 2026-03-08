Add-Type -AssemblyName System.Drawing

# Load the JPG image
$img = [System.Drawing.Image]::FromFile("$PWD\public\logo.jpg")

# Create a new bitmap with the desired size (256x256 for icon)
$size = 256
$bitmap = New-Object System.Drawing.Bitmap $size, $size

# Draw the image onto the bitmap
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.DrawImage($img, 0, 0, $size, $size)
$graphics.Dispose()

# Save as ICO
$iconPath = "$PWD\public\icon.ico"
$icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
$stream = [System.IO.FileStream]::new($iconPath, [System.IO.FileMode]::Create)
$icon.Save($stream)
$stream.Close()

$img.Dispose()
$bitmap.Dispose()

Write-Host "Icon created successfully at: $iconPath"
