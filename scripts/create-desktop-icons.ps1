Add-Type -AssemblyName System.Drawing

$desktop  = [Environment]::GetFolderPath('Desktop')
$iconDir  = 'C:\Users\Chenan Xia\AI value chain dashboard\assets\icons'
New-Item -ItemType Directory -Force -Path $iconDir | Out-Null

$startIco = Join-Path $iconDir 'dashboard-start.ico'
$stopIco  = Join-Path $iconDir 'dashboard-stop.ico'
$startLnk = Join-Path $desktop 'AI Value Chain Dashboard.lnk'
$stopLnk  = Join-Path $desktop 'Stop AI Dashboard.lnk'

# ── Helper: save Bitmap as an ICO file ──────────────────────────────────────
function Save-Ico($bmp, $path) {
    $tmp = [IO.Path]::GetTempFileName() + '.png'
    $bmp.Save($tmp, [Drawing.Imaging.ImageFormat]::Png)
    $png = [IO.File]::ReadAllBytes($tmp)
    Remove-Item $tmp -Force
    $ms = New-Object IO.MemoryStream
    $bw = New-Object IO.BinaryWriter($ms)
    $bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]1)
    $bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([byte]0)
    $bw.Write([uint16]1); $bw.Write([uint16]32)
    $bw.Write([uint32]$png.Length); $bw.Write([uint32]22)
    $bw.Write($png); $bw.Flush()
    [IO.File]::WriteAllBytes($path, $ms.ToArray())
    $bw.Dispose(); $ms.Dispose()
    Write-Host "  Saved: $path"
}

# ── Helper: filled rounded rectangle ────────────────────────────────────────
function Add-RoundRect($g, $brush, $x, $y, $w, $h, $r) {
    $p = New-Object Drawing.Drawing2D.GraphicsPath
    $p.AddArc($x,          $y,          $r*2, $r*2, 180, 90)
    $p.AddArc($x+$w-$r*2,  $y,          $r*2, $r*2, 270, 90)
    $p.AddArc($x+$w-$r*2,  $y+$h-$r*2, $r*2, $r*2,   0, 90)
    $p.AddArc($x,          $y+$h-$r*2, $r*2, $r*2,  90, 90)
    $p.CloseFigure(); $g.FillPath($brush, $p); $p.Dispose()
}

# ── Helper: centred string ───────────────────────────────────────────────────
function Draw-Centered($g, $text, $font, $brush, $cx, $cy) {
    $sf = New-Object Drawing.StringFormat
    $sf.Alignment     = [Drawing.StringAlignment]::Center
    $sf.LineAlignment = [Drawing.StringAlignment]::Center
    $rect = New-Object Drawing.RectangleF(0, 0, 256, $cy * 2)
    $g.DrawString($text, $font, $brush, $rect, $sf)
    $sf.Dispose()
}

$sz = 256

# ════════════════════════════════════════════════════════════════════════════
# START icon
#   Dark navy card · teal-green accent bar top · large "AI" · teal play badge
# ════════════════════════════════════════════════════════════════════════════
Write-Host "Creating START icon..."
$bmp = New-Object Drawing.Bitmap($sz, $sz)
$g   = [Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode      = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
$g.TextRenderingHint  = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$g.Clear([Drawing.Color]::Transparent)

# Card background
$navyBrush = New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(255, 15, 20, 40))
Add-RoundRect $g $navyBrush 0 0 $sz $sz 40

# Top teal accent strip
$tealBrush = New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(255, 0, 210, 150))
Add-RoundRect $g $tealBrush 0 0 $sz 10 4

# "AI" text — large, white, bold, upper portion
$aiFont    = New-Object Drawing.Font("Arial", 92, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
$whiteBrush = New-Object Drawing.SolidBrush([Drawing.Color]::White)
$sf = New-Object Drawing.StringFormat
$sf.Alignment = $sf.LineAlignment = [Drawing.StringAlignment]::Center
$g.DrawString("AI", $aiFont, $whiteBrush, ([Drawing.RectangleF]::new(0, 18, 256, 130)), $sf)

# Divider line
$divPen = New-Object Drawing.Pen([Drawing.Color]::FromArgb(60, 255, 255, 255), 1.5)
$g.DrawLine($divPen, 28, 156, 228, 156)

# Teal-green play circle badge (bottom half)
$g.FillEllipse($tealBrush, 78, 164, 100, 100)

# White play triangle inside badge
$triPts = [Drawing.PointF[]]@(
    [Drawing.PointF]::new(112, 183),
    [Drawing.PointF]::new(112, 245),
    [Drawing.PointF]::new(168, 214)
)
$g.FillPolygon($whiteBrush, $triPts)

$g.Dispose(); Save-Ico $bmp $startIco; $bmp.Dispose()

# ════════════════════════════════════════════════════════════════════════════
# STOP icon
#   Dark navy card · red accent bar top · large "AI" · red stop badge
# ════════════════════════════════════════════════════════════════════════════
Write-Host "Creating STOP icon..."
$bmp = New-Object Drawing.Bitmap($sz, $sz)
$g   = [Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode      = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
$g.TextRenderingHint  = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$g.Clear([Drawing.Color]::Transparent)

$navyBrush = New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(255, 15, 20, 40))
Add-RoundRect $g $navyBrush 0 0 $sz $sz 40

# Top red accent strip
$redBrush = New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(255, 220, 53, 69))
Add-RoundRect $g $redBrush 0 0 $sz 10 4

# "AI" text — large, white, bold, upper portion
$aiFont    = New-Object Drawing.Font("Arial", 92, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
$whiteBrush = New-Object Drawing.SolidBrush([Drawing.Color]::White)
$sf = New-Object Drawing.StringFormat
$sf.Alignment = $sf.LineAlignment = [Drawing.StringAlignment]::Center
$g.DrawString("AI", $aiFont, $whiteBrush, ([Drawing.RectangleF]::new(0, 18, 256, 130)), $sf)

# Divider line
$divPen = New-Object Drawing.Pen([Drawing.Color]::FromArgb(60, 255, 255, 255), 1.5)
$g.DrawLine($divPen, 28, 156, 228, 156)

# Red circle badge (bottom half)
$g.FillEllipse($redBrush, 78, 164, 100, 100)

# White rounded stop square inside badge
$stopBrush = New-Object Drawing.SolidBrush([Drawing.Color]::White)
Add-RoundRect $g $stopBrush 103 189 50 50 7

$g.Dispose(); Save-Ico $bmp $stopIco; $bmp.Dispose()

# ── Update .lnk shortcuts with new icons (VBS stays in project scripts) ─────
Write-Host "Updating shortcut icons..."
$projScripts = 'C:\Users\Chenan Xia\AI value chain dashboard\scripts'
$wsh = New-Object -ComObject WScript.Shell

$s = $wsh.CreateShortcut($startLnk)
$s.TargetPath       = 'wscript.exe'
$s.Arguments        = '"' + (Join-Path $projScripts 'AI-Value-Chain-Dashboard.vbs') + '"'
$s.IconLocation     = $startIco + ',0'
$s.Description      = 'Start AI Value Chain Dashboard'
$s.Save()
Write-Host "  Updated: $startLnk"

$s = $wsh.CreateShortcut($stopLnk)
$s.TargetPath       = 'wscript.exe'
$s.Arguments        = '"' + (Join-Path $projScripts 'AI-Value-Chain-Dashboard-Stop.vbs') + '"'
$s.IconLocation     = $stopIco + ',0'
$s.Description      = 'Stop AI Value Chain Dashboard'
$s.Save()
Write-Host "  Updated: $stopLnk"

Write-Host ""
Write-Host "Done."
