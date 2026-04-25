import os
import json
from fastapi import FastAPI, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import subprocess
import asyncio
import re

app = FastAPI(title="Nexus Media Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # OrchestratorEngine
HUB_DIR = os.path.dirname(BASE_DIR) # MediaHub
YT_DIR = os.path.join(HUB_DIR, "StoryEngine", "YouTube_Stories")
VOICES_DIR = os.path.join(HUB_DIR, "VoiceEngine", "voices")
os.makedirs(VOICES_DIR, exist_ok=True)

@app.get("/api/health")
def health_check():
    return {"status": "online", "engines": ["YouTube_Stories", "TikTok_TrueCrime"]}

@app.get("/api/generations/youtube")
def get_youtube_generations():
    gen_path = os.path.join(YT_DIR, "generations")
    if not os.path.exists(gen_path):
        return {"data": []}
        
    results = []
    for foldername in os.listdir(gen_path):
        folder_path = os.path.join(gen_path, foldername)
        if os.path.isdir(folder_path):
            meta_path = os.path.join(folder_path, "metadata.json")
            if os.path.exists(meta_path):
                with open(meta_path, "r", encoding="utf-8") as f:
                    try:
                        meta = json.load(f)
                        meta["folder_name"] = foldername
                        results.append(meta)
                    except json.JSONDecodeError:
                        pass
    
    results.sort(key=lambda x: x.get("timestamp", 0), reverse=True)
    return {"data": results}

@app.get("/api/voices")
def get_custom_voices():
    """ Returns available F5-TTS reference voices (.wav) and metadata """
    meta_path = os.path.join(VOICES_DIR, "voices_metadata.json")
    metadata = []
    if os.path.exists(meta_path):
        with open(meta_path, "r", encoding="utf-8") as f:
            try:
                metadata = json.load(f)
            except json.JSONDecodeError:
                metadata = []
    
    # Check physical folder vs metadata mapping
    if not os.path.exists(VOICES_DIR):
        return {"data": []}
    files = [f for f in os.listdir(VOICES_DIR) if f.lower().endswith(".wav")]
    
    # Merge strategy: if a .wav exists but no metadata, send it empty
    results = []
    for f in files:
        matched = next((m for m in metadata if m.get("filename") == f), None)
        if matched:
            results.append(matched)
        else:
            results.append({"filename": f, "id": f, "ref_text": "", "gender": "unknown", "age": "unknown", "traits": ""})
            
    return {"data": results}

from fastapi import Form
@app.post("/api/voices/upload")
async def upload_custom_voice(
    file: UploadFile = File(...),
    ref_text: str = Form(""),
    gender: str = Form(""),
    age: str = Form(""),
    traits: str = Form("")
):
    """ Endpoint to save ANY media file, convert to .WAV, and inject Metadata """
    base_name = os.path.splitext(file.filename)[0]
    final_wav_name = f"{base_name}.wav"
    temp_path = os.path.join(VOICES_DIR, f"temp_{file.filename}")
    final_path = os.path.join(VOICES_DIR, final_wav_name)
    
    # Write temp incoming blob
    with open(temp_path, "wb") as f:
        f.write(await file.read())
        
    # Standardize to WAV 24kHz Mono 16-bit
    if not file.filename.lower().endswith(".wav"):
        try:
            cmd = ["ffmpeg", "-y", "-i", temp_path, "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", final_path]
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            os.remove(temp_path)
        except Exception as e:
            if os.path.exists(temp_path): os.remove(temp_path)
            return {"status": "error", "message": f"FFmpeg Error: {e}"}
    else:
        # If it was already WAV, we still FFmpeg it to ensure correct sampling rate
        try:
            cmd = ["ffmpeg", "-y", "-i", temp_path, "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", final_path]
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            os.remove(temp_path)
        except:
             os.rename(temp_path, final_path)
             
    # Append to JSON
    meta_path = os.path.join(VOICES_DIR, "voices_metadata.json")
    all_data = []
    if os.path.exists(meta_path):
        with open(meta_path, "r", encoding="utf-8") as f:
            try:
                all_data = json.load(f)
            except:
                all_data = []
                
    # Remove existing entry if overwrite
    all_data = [x for x in all_data if x.get("filename") != final_wav_name]
    
    new_entry = {
        "id": base_name,
        "filename": final_wav_name,
        "ref_text": ref_text,
        "gender": gender,
        "age": age,
        "traits": traits
    }
    all_data.append(new_entry)
    
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(all_data, f, indent=4, ensure_ascii=False)
        
    return {"status": "success", "filename": final_wav_name, "metadata": new_entry}
@app.get("/api/assets/{asset_type}")
def get_assets(asset_type: str):
    """
    Returns available RVC models or BGM tracks.
    asset_type must be either 'rvc' or 'bgm'.
    """
    if asset_type not in ["rvc", "bgm"]:
        return {"data": []}
        
    folder = "rvc_models" if asset_type == "rvc" else "bgm"
    target_path = os.path.join(YT_DIR, "assets", folder)
    
    if not os.path.exists(target_path):
        return {"data": []}
        
    extensions = {".pth"} if asset_type == "rvc" else {".mp3", ".wav", ".aac"}
    
    files = [f for f in os.listdir(target_path) if os.path.splitext(f)[1].lower() in extensions]
    return {"data": files}

def run_youtube_engine_stream(duration: int, dialogue_ratio: int, rating: str, localization: str, voice: str, theme: str, is_zero_shot: bool):
    """ Runs the engine and streams real-time logs """
    script_path = os.path.join(YT_DIR, "scripts", "story_engine.py")
    print(f"[FastAPI] Firing Log-Stream Engine: {script_path} for {duration} mins (ZeroShot: {is_zero_shot})")
    
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    
    # sys.argv layout: [1] duration, [2] dialogue, [3] rating, [4] loc, [5] voice, [6] custom_theme, [7] isZeroShot
    args = [
        "python", "-u", script_path, 
        str(duration), 
        str(dialogue_ratio), 
        rating, 
        localization, 
        voice,
        theme,
        str(is_zero_shot)
    ]
    
    process = subprocess.Popen(
        args, 
        cwd=os.path.dirname(script_path),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env
    )
    
    for raw_line in iter(process.stdout.readline, ""):
        if raw_line:
            # Handle TQDM \r mixed lines by splitting them
            for line in raw_line.split('\r'):
                line = line.strip()
                if not line: continue
                
                # Catch TQDM percentages like 24%|████     | 10/40
                match = re.search(r"(\d+)%\|.*\|", line)
                if match:
                    yield f"data: [QWEN3 MOTOR] {match.group(1)}% Renderizado...\n\n"
                    continue
                    
                # Ignore ASCII raw TQDM blocks that have no match but pollute output
                if '\x1b[' in line or ('|' in line and '%' in line):
                    continue
                    
                yield f"data: {line}\n\n"
            
    process.stdout.close()
    process.wait()
    
    if process.returncode == 0:
        yield "data: [PIPELINE_COMPLETE]\n\n"
    else:
        yield "data: [ERROR] Pipeline failed fatally.\n\n"

@app.get("/api/engines/youtube/stream")
def launch_youtube_engine_stream(
    duration: int = 5, 
    dialogueRatio: int = 30, 
    rating: str = "Teen", 
    localization: str = "Neutro", 
    voice: str = "pt-BR-AntonioNeural",
    theme: str = "",
    isZeroShot: bool = False
):
    return StreamingResponse(
        run_youtube_engine_stream(duration, dialogueRatio, rating, localization, voice, theme, isZeroShot), 
        media_type="text/event-stream"
    )

if __name__ == "__main__":
    import uvicorn
    # Hot-reload habilitado similar ao Bun (uvicorn no modo string)
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
