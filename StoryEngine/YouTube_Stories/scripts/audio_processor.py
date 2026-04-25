import os
import subprocess
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(BASE_DIR, "assets")
BGM_DIR = os.path.join(ASSETS_DIR, "bgm")
RVC_DIR = os.path.join(ASSETS_DIR, "rvc_models")

def run_rvc_modulation(input_wav: str, output_wav: str, rvc_model_name: str) -> bool:
    """
    Dummy RVC Wrapper. 
    In production, this will use `rvc-python` or invoke the local RVC-CLI to 
    pitch-shift and clone the TTS voice into the custom voice actor.
    """
    model_path = os.path.join(RVC_DIR, f"{rvc_model_name}.pth")
    if not os.path.exists(model_path):
        print(f"[AUDIO] RVC Model '{rvc_model_name}' not found. Skipping voice modulation.")
        return False
        
    print(f"[AUDIO] Running RVC Deep Voice Cloning with model: {rvc_model_name}")
    try:
        # TODO: rvc-python execution logic here
        # import rvc_python
        # rvc.infer_file(input_wav, model_path, output_wav, pitch=0)
        
        # Mocking for now by just copying the file to output
        import shutil
        shutil.copy(input_wav, output_wav)
        return True
    except Exception as e:
        print(f"[ERROR] RVC Modulation failed: {e}")
        return False

def mix_bgm(vocal_audio: str, bgm_audio: str, output_audio: str, volume: float = 0.08) -> bool:
    """
    Uses FFMPEG to mix a looped Background Track under the Vocals.
    """
    if not os.path.exists(bgm_audio):
        print("[AUDIO] BGM track not found. Skipping BGM mix.")
        return False
        
    print(f"[AUDIO] Mixing BGM track ({volume * 100}%) into vocals...")
    
    # FFmpeg mix command:
    # -i vocals -stream_loop -1 -i bgm 
    # [1:a]volume=0.08[a1] -> Diminish BGM
    # [0:a][a1]amix=duration=first -> Merge, end when vocals end
    cmd = [
        "ffmpeg", "-y",
        "-i", vocal_audio,
        "-stream_loop", "-1", "-i", bgm_audio,
        "-filter_complex", f"[1:a]volume={volume}[a1];[0:a][a1]amix=inputs=2:duration=first:dropout_transition=2",
        "-c:a", "libmp3lame",
        output_audio
    ]
    
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    stdout, stderr = process.communicate()
    
    if process.returncode != 0:
        print(f"[ERROR] FFmpeg Mixing failed: {stderr.decode('utf-8', errors='ignore')}")
        return False
        
    return True

def process_generation_audio(generation_dir: str):
    """
    Master pipeline audio orchestrator.
    Called after TTS generates `audio_base.mp3`.
    """
    base_audio = os.path.join(generation_dir, "audio_base.mp3")
    modulated_audio = os.path.join(generation_dir, "audio_modulated.wav")
    final_audio = os.path.join(generation_dir, "audio_final.mp3")
    meta_path = os.path.join(generation_dir, "metadata.json")
    
    if not os.path.exists(base_audio):
        print(f"[ERROR] Base audio {base_audio} not found. Cannot process.")
        return
        
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
        
    voice_actor = meta.get("rvc_voice", "none")
    bgm_track = meta.get("bgm_track", "tense.mp3")
    
    current_vocals = base_audio
    
    # 1. RVC Modulation Overlay
    if voice_actor != "none":
        success = run_rvc_modulation(base_audio, modulated_audio, voice_actor)
        if success:
            current_vocals = modulated_audio
            meta["status"] = "Voice Modulated"
            
    # 2. BGM Injection
    bgm_path = os.path.join(BGM_DIR, bgm_track)
    if os.path.exists(bgm_path):
        success = mix_bgm(current_vocals, bgm_path, final_audio, volume=0.08)
        if success:
            meta["status"] = "Completed Final Mix"
        else:
            final_audio = current_vocals
    else:
        import shutil
        print("[AUDIO] Warning: No BGM applied. Keeping raw vocals as final.")
        shutil.copy(current_vocals, final_audio)
        meta["status"] = "Completed Final Mix (No BGM)"
        
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=4, ensure_ascii=False)
        
    print(f"\n[SYSTEM] Audio Post-Processing Complete. Output: {final_audio}")

if __name__ == "__main__":
    # Test block
    import sys
    if len(sys.argv) > 1:
        process_generation_audio(sys.argv[1])
