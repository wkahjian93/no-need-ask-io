# Crops (private/shots/crops.json from find-boxes.js) and compresses the screenshots into private/build/shots/*.jpg
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'private\shots'
$dst = Join-Path $root 'private\build\shots'
New-Item -ItemType Directory -Force $dst | Out-Null
$crops = Get-Content (Join-Path $src 'crops.json') -Raw | ConvertFrom-Json
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]76)
$total = 0
Get-ChildItem $src -Filter *.png | ForEach-Object {
  $img = [System.Drawing.Image]::FromFile($_.FullName)
  $c = $crops.($_.BaseName)
  if ($c) { $sx = [int]$c[0]; $sy = [int]$c[1]; $sw = [int]$c[2]; $sh = [int]$c[3] } else { $sx = 0; $sy = 0; $sw = $img.Width; $sh = $img.Height }
  $w = [Math]::Min(900, $sw); $h = [int]($sh * $w / $sw)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp); $g.InterpolationMode = 'HighQualityBicubic'; $g.Clear([System.Drawing.Color]::White)
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, $w, $h), (New-Object System.Drawing.Rectangle $sx, $sy, $sw, $sh), [System.Drawing.GraphicsUnit]::Pixel)
  $out = Join-Path $dst ($_.BaseName + '.jpg'); $bmp.Save($out, $codec, $ep)
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
  $total += (Get-Item $out).Length
}
"screenshots: $((Get-ChildItem $dst).Count), total KB: $([int]($total/1024))"
