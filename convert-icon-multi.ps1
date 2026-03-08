Add-Type -AssemblyName System.Drawing

# Load the JPG image
$img = [System.Drawing.Image]::FromFile("$PWD\public\logo.jpg")

# Create icons at multiple sizes (required for Windows)
$sizes = @(256, 128, 64, 48, 32, 16)
$iconPath = "$PWD\public\icon.ico"

# Create a memory stream to hold the icon
$memoryStream = New-Object System.IO.MemoryStream

# Write ICO header
$writer = New-Object System.IO.BinaryWriter($memoryStream)
$writer.Write([uint16]0)  # Reserved
$writer.Write([uint16]1)  # Type (1 = ICO)
$writer.Write([uint16]$sizes.Count)  # Number of images

$imageDataOffset = 6 + ($sizes.Count * 16)
$imageDataList = @()

foreach ($size in $sizes) {
    # Create bitmap at this size
    $bitmap = New-Object System.Drawing.Bitmap $size, $size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.DrawImage($img, 0, 0, $size, $size)
    $graphics.Dispose()
    
    # Save to PNG in memory
    $pngStream = New-Object System.IO.MemoryStream
    $bitmap.Save($pngStream, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngData = $pngStream.ToArray()
    $pngStream.Dispose()
    $bitmap.Dispose()
    
    # Write directory entry
    $writer.Write([byte]$size)  # Width
    $writer.Write([byte]$size)  # Height
    $writer.Write([byte]0)      # Color palette
    $writer.Write([byte]0)      # Reserved
    $writer.Write([uint16]1)    # Color planes
    $writer.Write([uint16]32)   # Bits per pixel
    $writer.Write([uint32]$pngData.Length)  # Size of image data
    $writer.Write([uint32]$imageDataOffset) # Offset to image data
    
    $imageDataList += $pngData
    $imageDataOffset += $pngData.Length
}

# Write all image data
foreach ($imageData in $imageDataList) {
    $writer.Write($imageData)
}

$writer.Flush()
$iconData = $memoryStream.ToArray()
[System.IO.File]::WriteAllBytes($iconPath, $iconData)

$writer.Close()
$memoryStream.Close()
$img.Dispose()

Write-Host "Multi-resolution icon created successfully at: $iconPath"
Write-Host "Icon size: $([System.IO.FileInfo]::new($iconPath).Length) bytes"
