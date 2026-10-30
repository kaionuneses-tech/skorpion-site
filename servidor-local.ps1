# =====================================================================
#  SKORPION — servidor local só para PRÉ-VISUALIZAR o site no seu PC.
#
#  Para que serve: abrir os arquivos com duplo clique (file://) quebra
#  algumas coisas. Este script serve a pasta em http://localhost:8765/.
#  NÃO é necessário para publicar — a hospedagem já faz esse papel.
#
#  Como usar: clique com o botão direito neste arquivo →
#  "Executar com o PowerShell". Depois abra http://localhost:8765/
#  no navegador. Para parar, feche a janela do PowerShell.
# =====================================================================

param(
  [string]$Root = $PSScriptRoot,
  [int]$Port = 8765
)

$ErrorActionPreference = "Continue"

$mime = @{
  ".html"="text/html; charset=utf-8"; ".css"="text/css; charset=utf-8";
  ".js"="application/javascript; charset=utf-8"; ".json"="application/json; charset=utf-8";
  ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".png"="image/png"; ".gif"="image/gif";
  ".svg"="image/svg+xml"; ".ico"="image/x-icon"; ".webp"="image/webp";
  ".sql"="text/plain; charset=utf-8"; ".md"="text/plain; charset=utf-8";
  ".woff2"="font/woff2"; ".woff"="font/woff"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Servindo $Root em http://localhost:$Port/"

$resolvedRoot = [System.IO.Path]::GetFullPath($Root)

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $path = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($path -eq "/") { $path = "/index.html" }

    $full = Join-Path $Root ($path.TrimStart('/') -replace '/', '\')
    $bytes = $null
    $type = "application/octet-stream"
    $code = 200

    if (Test-Path -LiteralPath $full -PathType Leaf) {
      $fullResolved = [System.IO.Path]::GetFullPath($full)
      if ($fullResolved.StartsWith($resolvedRoot)) {
        $bytes = [System.IO.File]::ReadAllBytes($fullResolved)
        $ext = [System.IO.Path]::GetExtension($fullResolved).ToLower()
        if ($mime.ContainsKey($ext)) { $type = $mime[$ext] }
      } else { $code = 403 }
    } else { $code = 404 }

    if ($null -eq $bytes) {
      $bytes = [System.Text.Encoding]::UTF8.GetBytes("<h1>$code</h1><p>$path</p>")
      $type = "text/html; charset=utf-8"
    }

    $ctx.Response.StatusCode = $code
    $ctx.Response.ContentType = $type
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.Headers.Add("Cache-Control", "no-store")
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $ctx.Response.OutputStream.Close()
    Write-Host "$code $path"
  } catch {
    Write-Host "err: $($_.Exception.Message)"
    try { $ctx.Response.Abort() } catch {}
  }
}
