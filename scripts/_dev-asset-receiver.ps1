# Recibe N imagenes PNG (dataURL) via POST JSON {name, data} y las guarda
# en el directorio indicado. Uso solo de desarrollo, no se publica.
param([int]$Count = 5, [string]$OutDir)

$l = New-Object Net.HttpListener
$l.Prefixes.Add('http://localhost:8399/')
$l.Start()
for ($i = 0; $i -lt $Count; $i++) {
  $ctx = $l.GetContext()
  $sr = New-Object IO.StreamReader($ctx.Request.InputStream)
  $body = $sr.ReadToEnd()
  $json = $body | ConvertFrom-Json
  $b64 = $json.data -replace '^data:image/[a-z]+;base64,', ''
  $path = Join-Path $OutDir $json.name
  [IO.File]::WriteAllBytes($path, [Convert]::FromBase64String($b64))
  Write-Output "guardado: $path ($((Get-Item $path).Length) bytes)"
  $ctx.Response.StatusCode = 200
  $ctx.Response.Close()
}
$l.Stop()
