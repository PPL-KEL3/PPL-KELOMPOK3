@echo off
cd /d "%~dp0"
echo === TPR-10: Wilayah ^& Radius Layanan (20 TC) ===
".venv\Scripts\python.exe" -m pytest test_tpr10_service_areas.py -v
if errorlevel 1 exit /b %errorlevel%
echo.
echo === TPR-9: Profil Penyedia ^& WhatsApp (33 TC) ===
".venv\Scripts\python.exe" -m pytest test_tpr9_provider_profile.py -v
exit /b %errorlevel%
