@echo off
echo [SYSTEM] Starting VoiceEngine automated deployment for F5-TTS...

cd /d "%~dp0"
if not exist "venv" (
    echo [SYSTEM] Creating Python 3.12 Virtual Environment...
    python -m venv venv
)

echo [SYSTEM] Activating venv...
call venv\Scripts\activate.bat

echo [SYSTEM] Installing PyTorch with CUDA 12.1 for hardware acceleration...
pip install torch==2.4.0 torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

echo [SYSTEM] Installing Qwen3-TTS Core and its dependencies...
pip install transformers accelerate soundfile faster-qwen3-tts

echo [SYSTEM] VoiceEngine initialized. You can now launch inference_server.py
pause
