# Cria uma regra de firewall restrita à sub-rede local para o Vitalis (porta 5178).
# Executado com elevação (UAC). Grava o resultado em verification/firewall-status.txt.
$ErrorActionPreference = 'Stop'
$status = Join-Path $PSScriptRoot '..\verification\firewall-status.txt'

try {
  $name = 'Vitalis PWA (LAN 5178)'
  $existing = Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue
  if ($existing) {
    Set-NetFirewallRule -DisplayName $name -Enabled True -Action Allow -Profile Any | Out-Null
    'OK-EXISTENTE' | Set-Content -Path $status -Encoding UTF8
  } else {
    New-NetFirewallRule `
      -DisplayName $name `
      -Description 'Acesso ao PWA Vitalis na rede local (somente sub-rede)' `
      -Direction Inbound `
      -Action Allow `
      -Protocol TCP `
      -LocalPort 5178 `
      -Profile Any `
      -RemoteAddress LocalSubnet | Out-Null
    'OK-CRIADA' | Set-Content -Path $status -Encoding UTF8
  }
} catch {
  "ERRO: $($_.Exception.Message)" | Set-Content -Path $status -Encoding UTF8
  exit 1
}
