$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "=== TPR-10: Wilayah & Radius Layanan (20 TC) ===" -ForegroundColor Cyan
& .\.venv\Scripts\python.exe -m pytest test_tpr10_service_areas.py -v
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n=== TPR-9: Profil Penyedia & WhatsApp (33 TC) ===" -ForegroundColor Cyan
& .\.venv\Scripts\python.exe -m pytest test_tpr9_provider_profile.py -v
exit $LASTEXITCODE
