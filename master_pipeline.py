import argparse
import os
import sys
import json
from pathlib import Path
import subprocess

def get_python_exe(engine_dir, fallback="python"):
    # Check for venv/Scripts/python.exe or .venv/Scripts/python.exe
    engine_dir = Path(engine_dir)
    venv_py = engine_dir / "venv" / "Scripts" / "python.exe"
    dot_venv_py = engine_dir / ".venv" / "Scripts" / "python.exe"
    comfy_venv = engine_dir / "ComfyUI" / ".venv" / "Scripts" / "python.exe"
    ace_venv = engine_dir / "ACE-Step-1.5" / ".venv" / "Scripts" / "python.exe"
    
    if venv_py.exists(): return str(venv_py)
    if dot_venv_py.exists(): return str(dot_venv_py)
    if comfy_venv.exists(): return str(comfy_venv)
    if ace_venv.exists(): return str(ace_venv)
    
    print(f"[MasterPipeline Warning] No venv found in {engine_dir}, falling back to '{fallback}'")
    return fallback

def run_command(cmd, cwd=None):
    print(f"[MasterPipeline] Running: {' '.join(cmd)}")
    process = subprocess.Popen(
        cmd,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        universal_newlines=True,
        encoding="utf-8"
    )
    for line in process.stdout:
        print(line.strip(), flush=True)
    process.wait()
    if process.returncode != 0:
        print(f"[MasterPipeline Error] Command failed with exit code {process.returncode}")
        sys.exit(process.returncode)

def main():
    parser = argparse.ArgumentParser(description="MediaHub Master Pipeline Orchestrator")
    parser.add_argument("--config", type=str, required=True, help="Path to project_config.json")
    parser.add_argument("--output_dir", type=str, required=True, help="Path to specific generation directory (with UUID)")
    parser.add_argument("--run_id", type=str, required=True, help="UUID for this run")
    
    # StoryEngine Overrides
    parser.add_argument("--duration", type=int, default=0, help="Override target duration in minutes")
    parser.add_argument("--dialogue_ratio", type=int, default=0, help="Override dialogue ratio")
    parser.add_argument("--rating", type=str, default="", help="Override content rating")
    parser.add_argument("--localization", type=str, default="", help="Override localization")
    parser.add_argument("--voice", type=str, default="", help="Override TTS Voice")
    parser.add_argument("--theme", type=str, default="", help="Override scenario theme")
    parser.add_argument("--zero_shot", action="store_true", help="Zero-shot mode (skip Director)")
    
    args = parser.parse_args()
    
    root_dir = Path(__file__).resolve().parent
    
    print(f"==================================================")
    print(f"[MasterPipeline] Starting Production for Run: {args.run_id}")
    print(f"==================================================")
    
    # 1. RUN STORY ENGINE
    print(f"\n>>> PHASE 1: STORY ENGINE <<<")
    story_engine_script = root_dir / "StoryEngine" / "story_generator.py"
    
    story_cmd = [
        "python", "-u", str(story_engine_script),
        "--config", args.config,
        "--output_dir", args.output_dir,
        "--duration", str(args.duration),
        "--dialogue_ratio", str(args.dialogue_ratio),
    ]
    if args.rating: story_cmd.extend(["--rating", args.rating])
    if args.localization: story_cmd.extend(["--localization", args.localization])
    if args.voice: story_cmd.extend(["--voice", args.voice])
    if args.theme: story_cmd.extend(["--theme", args.theme])
    if args.zero_shot: story_cmd.append("--zero_shot")
    
    run_command(story_cmd, cwd=str(root_dir / "StoryEngine"))
    
    blueprint_path = Path(args.output_dir) / "director_blueprint.json"
    if not blueprint_path.exists():
        print("[MasterPipeline Error] Blueprint not found! StoryEngine failed silently.")
        sys.exit(1)
        
    with open(blueprint_path, "r", encoding="utf-8") as f:
        blueprint = json.load(f)
        
    with open(args.config, "r", encoding="utf-8") as f:
        project_config = json.load(f)
        
    config_lang = project_config.get("language", "en-US").lower()
    if "en" in config_lang: qwen_lang = "English"
    elif "pt" in config_lang: qwen_lang = "Portuguese"
    elif "es" in config_lang: qwen_lang = "Spanish"
    elif "fr" in config_lang: qwen_lang = "French"
    elif "zh" in config_lang: qwen_lang = "Chinese"
    elif "ja" in config_lang: qwen_lang = "Japanese"
    elif "ko" in config_lang: qwen_lang = "Korean"
    else: qwen_lang = "English"
    
    acts = blueprint.get("acts", [])
    music_vibe = blueprint.get("global_music_vibe", "cinematic ambient music")
    
    # Pre-calculate assets paths
    output_dir_path = Path(args.output_dir)
        
    # Pre-calculate assets paths
    output_dir_path = Path(args.output_dir)

    print(f"\n>>> PHASE 2: VOICE & SUBTITLES <<<")
    voice_engine_script = root_dir / "VoiceEngine" / "qwen_tts_engine.py"
    vtt_engine_script = root_dir / "VoiceEngine" / "vtt_generator.py"
    voice_python = get_python_exe(root_dir / "VoiceEngine")
    
    # Fix .wav extension doubling
    voice_name = args.voice if args.voice else "default"
    if not voice_name.endswith(".wav"):
        voice_name += ".wav"
        
    ref_audio = root_dir / "VoiceEngine" / "voices" / voice_name
    if not ref_audio.exists():
        print(f"[MasterPipeline Warning] Reference audio {ref_audio} not found. Voice generation might fail.")
        
    # Extract reference text from voices_metadata.json
    voices_meta_path = root_dir / "VoiceEngine" / "voices" / "voices_metadata.json"
    ref_text = "Sample reference text"
    if voices_meta_path.exists():
        try:
            with open(voices_meta_path, "r", encoding="utf-8") as f:
                voices_meta = json.load(f)
                for v in voices_meta:
                    if v.get("filename") == voice_name:
                        ref_text = v.get("ref_text", ref_text)
                        break
        except Exception as e:
            print(f"[MasterPipeline Warning] Could not parse voices metadata: {e}")
            
    if voice_engine_script.exists():
        for i, act in enumerate(acts):
            act_num = act.get("act_number", i + 1)
            text = act.get("text", "")
            
            audio_out = output_dir_path / f"act_{act_num}_audio.wav"
            text_out = output_dir_path / f"act_{act_num}_text.txt"
            
            with open(text_out, "w", encoding="utf-8") as f:
                f.write(text)
            
            # 1. Generate Audio
            voice_cmd = [
                voice_python, "-u", str(voice_engine_script),
                "--text", text,
                "--output", str(audio_out),
                "--prompt", "Cinematic storytelling narrator",
                "--ref_audio", str(ref_audio),
                "--ref_text", ref_text,
                "--language", qwen_lang
            ]
            print(f"[MasterPipeline] Generating voice for Act {act_num} (Language: {qwen_lang})...")
            run_command(voice_cmd, cwd=str(root_dir / "VoiceEngine"))
            
            # 2. Generate Subtitles per act
            if vtt_engine_script.exists() and audio_out.exists():
                vtt_out = output_dir_path / f"act_{act_num}_subtitles.vtt"
                whisper_lang = "english" if qwen_lang == "en" else "portuguese"
                vtt_cmd = [voice_python, "-u", str(vtt_engine_script), str(audio_out), str(vtt_out), "--language", whisper_lang]
                print(f"[MasterPipeline] Generating subtitles for Act {act_num} (Language: {whisper_lang})...")
                run_command(vtt_cmd, cwd=str(root_dir / "VoiceEngine"))
    else:
        print("[MasterPipeline] VoiceEngine not found or implemented. Skipping.")

    print(f"\n>>> PHASE 3: VISUAL ENGINE <<<")
    visual_engine_script = root_dir / "VisualEngine" / "image_engine.py"
    visual_python = get_python_exe(root_dir / "VisualEngine")
    if visual_engine_script.exists():
        for i, act in enumerate(acts):
            act_num = act.get("act_number", i + 1)
            artist_prompts = act.get("artist_prompts", {})
            prompt = artist_prompts.get("positive_prompt", "")
            
            img_out = output_dir_path / f"act_{act_num}_image.png"
            
            visual_cmd = [
                visual_python, "-u", str(visual_engine_script),
                "--prompt", prompt,
                "--output", str(img_out)
            ]
            print(f"[MasterPipeline] Generating image for Act {act_num}...")
            run_command(visual_cmd, cwd=str(root_dir / "VisualEngine"))
    else:
        print("[MasterPipeline] VisualEngine not found. Skipping.")

    print(f"\n>>> PHASE 4: SOUND ENGINE <<<")
    sound_engine_script = root_dir / "SoundEngine" / "audio_engine.py"
    sound_python = get_python_exe(root_dir / "SoundEngine")
    if sound_engine_script.exists():
        bgm_out = output_dir_path / "background_music.mp3"
        duration = args.duration * 60 if args.duration > 0 else 30 # Default to 30s if not specified
        if duration > 300: duration = 300 # Limit ACE-Step max duration to 5 mins
        
        sound_cmd = [
            sound_python, "-u", str(sound_engine_script),
            "--prompt", music_vibe,
            "--duration", str(int(duration)),
            "--output", str(bgm_out)
        ]
        print(f"[MasterPipeline] Generating background music ({duration}s)...")
        run_command(sound_cmd, cwd=str(root_dir / "SoundEngine"))
    else:
        print("[MasterPipeline] SoundEngine not found. Skipping.")

    print(f"\n>>> PHASE 5: VIDEO EDITOR ENGINE <<<")
    editor_engine_script = root_dir / "VideoEditorEngine" / "ffmpeg_assembler.py"
    # Editor doesn't use third-party pip modules, use system python
    editor_python = get_python_exe(root_dir / "StoryEngine") 
    if editor_engine_script.exists():
        # ffmpeg_assembler expects --blueprint
        editor_cmd = [editor_python, "-u", str(editor_engine_script), "--blueprint", str(blueprint_path)]
        print(f"[MasterPipeline] Assembling final video...")
        run_command(editor_cmd, cwd=str(root_dir / "VideoEditorEngine"))
    else:
        print("[MasterPipeline Warning] VideoEditorEngine/ffmpeg_assembler.py not found! Final video will not be assembled automatically.")
        
        
    print(f"\n==================================================")
    print(f"[MasterPipeline] Production Complete for Run: {args.run_id}")
    print(f"==================================================")

if __name__ == "__main__":
    main()
