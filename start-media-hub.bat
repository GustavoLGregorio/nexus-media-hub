@echo off
title Nexus Media Hub (Orchestrator)

echo ====================================================
echo  Iniciando Nexus Media Hub - Portal v2.0
echo ====================================================

echo [1] Subindo FastAPI Backend (Porta 8000)...
start "Nexus Backend" cmd /k "cd /d C:\Users\hukak\Nexus\MediaHub\OrchestratorEngine\backend && python server.py"

echo [3] Subindo Vite+React WebUI (Porta 5173)...
cd /d "C:\Users\hukak\Nexus\MediaHub\OrchestratorEngine\frontend"
start "Nexus Frontend" cmd /k "bun run dev"

echo.
echo Tudo online. Feche esta janela parar os logs primarios.
pause
