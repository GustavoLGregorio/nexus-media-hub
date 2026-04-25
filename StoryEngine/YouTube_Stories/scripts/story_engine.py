import os
import re
import json
import time
import hashlib
import asyncio
import sys
import subprocess
from typing import Dict, Any
from dotenv import load_dotenv

# Base architecture paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # YouTube_Stories
STORY_ENGINE_DIR = os.path.dirname(BASE_DIR) # StoryEngine
MEDIA_HUB_DIR = os.path.dirname(STORY_ENGINE_DIR) # MediaHub

# Global Security Root
ENV_PATH = os.path.join(MEDIA_HUB_DIR, '.env')

load_dotenv(ENV_PATH)

from google import genai
from google.genai import types

# Import agents prompts and combinatorial logic
sys.path.append(BASE_DIR)
from agents.prompts import (
    YOUTUBE_SYSTEM_PROMPT, 
    DIRECTOR_SYSTEM_PROMPT, 
    CRITIC_SYSTEM_PROMPT, 
    FINAL_USER_SYSTEM_PROMPT,
    ARCHIVIST_SYSTEM_PROMPT,
    ARTIST_SYSTEM_PROMPT,
    generate_combinatorial_theme
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("[ERROR] GEMINI_API_KEY missing from WebUI/.env")
    sys.exit(1)

client = genai.Client(api_key=GEMINI_API_KEY)

def clean_for_tts(text: str) -> str:
    """ Strips edge-tts breaking artifacts """
    text = re.sub(r'[\*\#\_\[\]\(\)]', '', text)
    text = text.replace('"', '').replace('“', '').replace('”', '')
    text = text.replace('  ', ' ')
    return text.strip()

from google.genai.errors import APIError

def call_gemini_with_retry(model, contents, config, max_retries=4):
    """ Wrapped call for Gemini to handle 429 and 503 errors actively """
    
    # 🌟 Artificial Pace: Google Free Tier is 15 RPM (1 req every 4 secs). 
    # Force a 5 second sleep BEFORE every call to almost eliminate burst limit crashes.
    time.sleep(3)
    
    for attempt in range(max_retries):
        try:
            return client.models.generate_content(
                model=model,
                contents=contents,
                config=config
            )
        except APIError as e:
            err_msg = str(e)
            if attempt < max_retries - 1 and ("429" in err_msg or "503" in err_msg):
                wait_time = 45 # Default se falhar o regex
                match = re.search(r"retry in (\d+(\.\d+)?)s", err_msg)
                if match:
                    wait_time = int(float(match.group(1))) + 5
                
                print(f"[SYSTEM] Gemini API Error (429/503). Recovering in {wait_time}s... [Attempt {attempt+1}/{max_retries}]")
                for remaining in range(wait_time, 0, -1):
                    # print(f"[COOLDOWN] {remaining}") # less spammy
                    time.sleep(1)
            else:
                raise e
        except Exception as e:
            raise e

def invoke_director(theme: str, n_chunks: str, previous_feedback: str = "") -> list[dict]:
    """ Agent 1: Director Planner """
    print(f"[DIRECTOR] Invoking DIRECTOR Agent to scaffold narrative (Flexible: {n_chunks}).")
    prompt = f"Base Theme:\n'{theme}'\n\nReturn the strict JSON array for {n_chunks} chunks."
    if previous_feedback:
        prompt += f"\n\n[WARNING] THE PREVIOUS VERSION WAS REJECTED BY THE AUDIENCE FOR THE FOLLOWING REASON: {previous_feedback}\nDO NOT REPEAT THE SAME MISTAKES. CHANGE YOUR APPROACH."
        
    sys_instruction = DIRECTOR_SYSTEM_PROMPT.replace('{n_chunks}', str(n_chunks))
    
    response = call_gemini_with_retry(
        model='gemini-3.1-flash-lite-preview',
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=sys_instruction,
            temperature=0.7,
            response_mime_type="application/json",
        )
    )
    
    try:
        data = json.loads(response.text)
        return {"scaffold_plan": data.get("scaffold_plan", []), "cinematic_music_prompt": data.get("cinematic_music_prompt", "Atmospheric background music, tense")}
    except json.JSONDecodeError:
        print("[ERROR] Director returned invalid JSON.")
        return {"scaffold_plan": [], "cinematic_music_prompt": "Cinematic ambient music"}

def invoke_writer(chunk_instruction: str, pacing: str, previous_text: str, world_state: dict, dialogue: int, rating: str, loc: str) -> str:
    """ Agent 2: Narrative organic generator """
    print("[SYSTEM] Invoking WRITER Agent for current unit.")
    
    sys_instruction = YOUTUBE_SYSTEM_PROMPT.format(dialogue_ratio=dialogue, content_rating=rating, localization=loc)
    
    prompt = f"ESTADO ESPACIAL/INVENTÁRIO ATUAL:\n{json.dumps(world_state, ensure_ascii=False)}\n\nÚLTIMA PÁGINA (Para manter coesão fluida, não repita):\n{previous_text}\n\nSUA MISSÃO PARA O CHUNK ATUAL:\n{chunk_instruction}\n\nDIRETIVA DE RITMO ORGÂNICO:\n{pacing}"

    response = call_gemini_with_retry(
        model='gemini-3.1-flash-lite-preview',
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=sys_instruction,
            temperature=0.85,
        )
    )
    return response.text.strip()
    
def invoke_zero_shot_writer(theme: str, dialogue: int, rating: str, loc: str) -> str:
    """ Agent 2 (Zero-Shot Bypass): Generates the entire story in one flow. """
    print("[SYSTEM] Invoking WRITER Agent in ZERO-SHOT bypass mode.")
    
    sys_instruction = YOUTUBE_SYSTEM_PROMPT.format(dialogue_ratio=dialogue, content_rating=rating, localization=loc)
    prompt = f"BASE THEME:\n{theme}\n\nWRITE THE COMPLETE STORY FROM START TO FINISH IN A SINGLE FLOW. Avoid symmetrical paragraphs, respect the long-form flow. End with an impactful moral."
    
    response = call_gemini_with_retry(
        model='gemini-3.1-flash-lite-preview', # Standardized back to 3.1 flash
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=sys_instruction,
            temperature=0.8,
        )
    )
    return response.text.strip()

def invoke_archivist(chunk_text: str) -> dict:
    """ Extract Spatial and Status memory from the last chunk. """
    print("[SYSTEM] Invoking ARCHIVIST Agent to extract World State.")
    response = call_gemini_with_retry(
        model='gemini-3.1-flash-lite-preview',
        contents=chunk_text,
        config=types.GenerateContentConfig(
            system_instruction=ARCHIVIST_SYSTEM_PROMPT,
            temperature=0.1,
            response_mime_type="application/json",
        )
    )
    try:
        return json.loads(response.text)
    except Exception:
        return {"current_location": "Desconhecida", "character_statuses": [], "last_concrete_action": "Erro."}

def invoke_critic(chunk_text: str) -> Dict[str, Any]:
    """ Agent 3: Unforgiving structural and vocabulary reviewer """
    print("[SYSTEM] Invoking CRITIC Agent to validate chunk hook and tone.")
    
    prompt = f"EVALUATE THIS CHUNK WRITTEN BY THE WRITER:\n\n{chunk_text}"
    
    response = call_gemini_with_retry(
        model='gemini-3.1-flash-lite-preview',
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=CRITIC_SYSTEM_PROMPT,
            temperature=0.2, # Crítico é frio matemático
            response_mime_type="application/json",
        )
    )
    try:
        return json.loads(response.text)
    except Exception:
        print("[ERROR] Critic crashed, auto-passing chunk fallback.")
        return {"decision": "pass", "feedback": "JSON crash fallback", "revised_chunk_if_revise": None}

def invoke_audience(full_script: str) -> Dict[str, Any]:
    """ Agent 4: Final user judging the whole text to avoid typical AI fatigue. """
    print("[SYSTEM] Invoking AUDIENCE Agent to validate the complete story.")
    
    prompt = f"EVALUATE THE ENTIRE STORY CREATED BELOW:\n\n{full_script}"
    
    response = call_gemini_with_retry(
        model='gemini-3.1-flash-lite-preview',
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=FINAL_USER_SYSTEM_PROMPT,
            temperature=0.3,
            response_mime_type="application/json",
        )
    )
    try:
        return json.loads(response.text)
    except Exception:
        return {"verdict": "pass", "weak_points": "JSON crash fallback"}

def invoke_artist(theme: str, acts_text: list[str], last_world_state: dict) -> list[dict]:
    """ Agent 5: Artist """
    print("[SYSTEM] Invoking ARTIST Agent to generate Flux prompts.")
    
    prompt = f"DIRECTOR THEME:\n{theme}\n\nFINAL WORLD STATE:\n{json.dumps(last_world_state, ensure_ascii=False)}\n\n"
    for i, act_txt in enumerate(acts_text):
        prompt += f"--- ACT {i+1} ---\n{act_txt}\n\n"
        
    prompt += "Generate EXACTLY one prompt for 'thumbnail' and ONE prompt for EACH act provided above."
    
    response = call_gemini_with_retry(
        model='gemini-3.1-flash-lite-preview',
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=ARTIST_SYSTEM_PROMPT,
            temperature=0.7,
            response_mime_type="application/json",
        )
    )
    try:
        json_str = response.text.strip()
        match = re.search(r'\[.*\]', json_str, re.DOTALL)
        if match:
            json_str = match.group(0)
        return json.loads(json_str)
    except Exception as e:
        print(f"[ERROR] Artist crashed: {e}")
        return [{"act": "thumbnail", "prompt": f"Detailed cinematic masterpiece of {theme}"}]

async def generate_tts(text: str, output_path: str, voice: str = "pt-BR-AntonioNeural", vtt_path: str = ""):
    print(f"[SYSTEM] VoiceEngine Triggered. Requested voice: {voice}")
    
    import subprocess
    VOICE_ENGINE_DIR = os.path.join(MEDIA_HUB_DIR, "VoiceEngine")
    venv_python = os.path.join(VOICE_ENGINE_DIR, "venv", "Scripts", "python.exe")
    
    # If legacy Edge-TTS is still requested, force Qwen local default.
    if "[QWEN]" in voice or voice.endswith(".wav"):
        voice_filename = voice.replace("[QWEN]", "").strip()
    else:
        print(f"[WARNING] Legacy TTS detected. Forcing local override to Qwen (dossie_felipe.wav)")
        voice_filename = "dossie_felipe.wav"
        
    try:
        meta_db = os.path.join(VOICE_ENGINE_DIR, "voices", "voices_metadata.json")
        ref_text = "Basic reference transcription"
        voice_prompt = "Intense cinematic narrator"
        if os.path.exists(meta_db):
            with open(meta_db, "r", encoding="utf-8") as f:
                try:
                    data = json.load(f)
                    for v in data:
                        if v.get("filename") == voice_filename:
                            ref_text = v.get("ref_text", ref_text)
                            traits = v.get("traits", "")
                            if traits: voice_prompt = f"Narrator style: {traits}"
                            break
                except Exception: pass
                
        ref_audio = os.path.join(VOICE_ENGINE_DIR, "voices", voice_filename)
        
        if not os.path.exists(ref_audio):
            print(f"[ERROR] Reference audio {ref_audio} missing. Writing silence dummy.")
            with open(output_path, "wb") as f: f.write(b"")
        else:
            try:
                subprocess.run(
                    [venv_python, "qwen_tts_engine.py", "--text", text, "--output", output_path, "--prompt", voice_prompt, "--ref_audio", ref_audio, "--ref_text", ref_text],
                    cwd=VOICE_ENGINE_DIR, check=True
                )
            except subprocess.CalledProcessError as e:
                print(f"[ERROR] Fatal crash in Qwen TTS execution subprocess: {e}")
                with open(output_path, "wb") as f: f.write(b"")
    except Exception as e:
        print(f"[ERROR] Fatal crash in Qwen TTS pipeline hook: {e}")
        with open(output_path, "wb") as f: f.write(b"")
        
    if vtt_path:
        if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            try:
                subprocess.run([venv_python, "vtt_generator.py", output_path, vtt_path], cwd=VOICE_ENGINE_DIR, check=True)
            except Exception as e:
                print(f"[ERROR] VTT Generator Failed: {e}")
                with open(vtt_path, "w", encoding="utf-8") as f: f.write("WEBVTT\n\n00:00:00.000 --> 00:00:05.000\n[SUBTITLE ERROR]\n\n")
        else:
            with open(vtt_path, "w", encoding="utf-8") as f:
                f.write("WEBVTT\n\n00:00:00.000 --> 00:00:05.000\n[VOICE OFFLINE]\n\n")

async def run_pipeline(target_minutes: int = 5, dialogue: int = 30, rating: str = "Teen", loc: str = "Neutro", voice: str = "pt-BR-AntonioNeural", custom_theme: str = "", is_zero_shot: bool = False):
    print(f"[SYSTEM] Initiating Nexus Master Loop pipeline for {target_minutes} minutes.")
    
    if custom_theme and custom_theme.strip():
        theme_seed = custom_theme.strip()
        print(f"[SYSTEM] Custom Theme Override:\n{theme_seed}\n")
    else:
        theme_seed = generate_combinatorial_theme()
        print(f"[SYSTEM] Narrative Random Seed Generated:\n{theme_seed}\n")
        
    if voice.lower() == "auto":
        meta_db = os.path.join(MEDIA_HUB_DIR, "VoiceEngine", "voices", "voices_metadata.json")
        if os.path.exists(meta_db):
            with open(meta_db, "r", encoding="utf-8") as f_db:
                voices_data = json.load(f_db)
            v_prompt = f"Chosen Theme: {theme_seed}\nVoice Database: {json.dumps(voices_data, ensure_ascii=False)}\nAnalyze the theme and respond STRICTLY with the 'filename' of the most compatible voice."
            try:
                resp = client.models.generate_content(model='gemini-3.1-flash-lite-preview', contents=v_prompt)
                chosen = resp.text.strip().replace('"', '').replace("'", "")
                if chosen.endswith(".wav"):
                    voice = f"[QWEN] {chosen}"
                    print(f"[DIRECTOR] Auto-Voice selected: {voice}")
            except Exception as e:
                print(f"[WARNING] Auto-voice failed: {e}")
    
    max_loops = 2
    current_loop = 1
    final_feedback = ""
    valid_story_text = ""
    critic_logs = []
    world_state = {}
    
    while current_loop <= max_loops:
        print(f"[SYSTEM] --- SCRIPT GENERATION LOOP {current_loop}/{max_loops} ---")
        
        final_chunks = []
        if is_zero_shot:
            print("[SYSTEM] ZERO-SHOT FAST MODE ENABLED. Bypassing Director.")
            raw_chunk = invoke_zero_shot_writer(theme_seed, dialogue, rating, loc)
            valid_chunk_text = raw_chunk
            critic_eval = invoke_critic(raw_chunk)
            if critic_eval.get("decision", "pass").lower() == "revise" and critic_eval.get("revised_chunk_if_revise"):
                valid_chunk_text = critic_eval.get("revised_chunk_if_revise")
            final_chunks.append(valid_chunk_text)
            music_prompt = "Energetic cinematic soundtrack, dramatic build-up" # Generic prompt
            full_compiled_script = "\n\n".join(final_chunks)
            world_state = invoke_archivist(full_compiled_script)
            cleaned_story = clean_for_tts(full_compiled_script)
            valid_story_text = cleaned_story
            print("[SYSTEM] Zero-Shot Script finalized.")
            break
            
        n_chunks = f"Flexible (Your cadence target is to structure the minimum or maximum necessary to intensely sustain ~{target_minutes} minutes of script reading)"
        director_data = invoke_director(theme_seed, n_chunks, previous_feedback=final_feedback)
        scaffold = director_data.get("scaffold_plan", [])
        music_prompt = director_data.get("cinematic_music_prompt", "Cinematic dark ambient")
        
        if not scaffold:
            print("[ERROR] Scaffolding failed. Aborting pipeline.")
            return
            
        print(f"[DIRECTOR] scaffolding plan returned {len(scaffold)} plot beats.")
        
        world_state = {}
        previous_text = "N/A"
        
        for i, chunk_data in enumerate(scaffold):
            print(f"\n[SYSTEM] --- Processing Act {i+1}/{len(scaffold)} ---")
            
            if isinstance(chunk_data, dict):
                instruction = chunk_data.get("chunk_instruction", str(chunk_data))
                pacing = chunk_data.get("pacing_directive", "neutral_flow")
            else:
                instruction = str(chunk_data)
                pacing = "neutral_flow"
                
            attempts = 0
            valid_chunk_text = ""
            
            while attempts < 2:
                attempts += 1
                raw_chunk = invoke_writer(instruction, pacing, previous_text, world_state, dialogue, rating, loc)
                critic_eval = invoke_critic(raw_chunk)
                
                decision = critic_eval.get("decision", "pass").lower()
                feedback = critic_eval.get("feedback", "")
                print(f"[CRITIC] Verdict: {decision.upper()} | Reasoning: {feedback[:50]}...")
                
                critic_logs.append(f"Loop {current_loop} | Act {i+1} attempt {attempts}: {decision.upper()}")
                
                if decision == "pass":
                    valid_chunk_text = raw_chunk
                    break
                elif decision == "revise" and critic_eval.get("revised_chunk_if_revise"):
                    valid_chunk_text = critic_eval.get("revised_chunk_if_revise")
                    break
            
            if not valid_chunk_text:
                valid_chunk_text = raw_chunk
                
            final_chunks.append(valid_chunk_text)
            for line in valid_chunk_text.split('\n'):
                if line.strip():
                    print(f"[STORY] {line.strip()}")
            
            # Fetch state tracker for next chunk
            world_state = invoke_archivist(valid_chunk_text)
            previous_text = valid_chunk_text[-500:] # Pass only last 500 chars to save context
        full_compiled_script = "\n\n".join(final_chunks)
        cleaned_story = clean_for_tts(full_compiled_script)
        
        print("[SYSTEM] Submitting compiled story to Audience Evaluator...")
        audience_eval = invoke_audience(cleaned_story)
        final_verdict = audience_eval.get("verdict", "PASS").upper()
        final_feedback = audience_eval.get("weak_points", "")
        
        print(f"[AUDIENCE] Verdict: {final_verdict} | Critique: {final_feedback}")
        
        if final_verdict == "PASS" or current_loop == max_loops:
            if final_verdict != "PASS":
                print("[SYSTEM] Hit max loops limits. Forcing acceptance of script.")
            else:
                # Save to fine_tuning dataset!
                fine_tune_path = os.path.join(MEDIA_HUB_DIR, "fine_tuning_dataset.jsonl")
                try:
                    with open(fine_tune_path, "a", encoding="utf-8") as f:
                        record = {"input": f"Theme: {theme_seed} | Dialogue: {dialogue}% | Rating: {rating} | Loc: {loc}", "output": cleaned_story}
                        f.write(json.dumps(record, ensure_ascii=False) + "\n")
                    print("[SYSTEM] Golden script appended to Fine-Tuning Dataset!")
                except Exception as e:
                    print(f"[ERROR] Failed to save fine-tuning record: {e}")
                    
            valid_story_text = cleaned_story
            break
            
        print("[SYSTEM] Story REJECTED by Audience. Wiping script and restarting loop...")
        current_loop += 1
    
    # OUTPUT ARCHITECTURE
    stamp = int(time.time())
    hash_id = hashlib.md5(valid_story_text.encode('utf-8')).hexdigest()[:8]
    folder_name = f"yt_{stamp}_{hash_id}"
    gen_dir = os.path.join(BASE_DIR, 'generations', folder_name)
    os.makedirs(gen_dir, exist_ok=True)
    
    # Parse params
    metadata = {
        "timestamp": stamp,
        "hash_id": hash_id,
        "platform": "YouTube",
        "status": "Writing Completed",
        "estimated_duration_seconds": len(valid_story_text) // 15,
        "tts_voice": voice,
        "dialogue_ratio": dialogue,
        "content_rating": rating,
        "localization": loc,
        "theme_seed": theme_seed,
        "critic_audit_logs": critic_logs,
        "final_audience_feedback": final_feedback
    }
    
    with open(os.path.join(gen_dir, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=4, ensure_ascii=False)
        
    with open(os.path.join(gen_dir, "raw_script.txt"), "w", encoding="utf-8") as f:
        f.write(valid_story_text)
        
    audio_path = os.path.join(gen_dir, "audio_base.wav")
    vtt_path = os.path.join(gen_dir, "subtitles.vtt")
    music_path = os.path.join(gen_dir, "music_base.wav")
    
    await generate_tts(valid_story_text, audio_path, voice=voice, vtt_path=vtt_path)
    
    # 3. Visual Engine (ARTIST Prompts -> ComfyUI Server)
    visual_prompts = invoke_artist(theme_seed, final_chunks, world_state)
    visual_prompts_path = os.path.join(gen_dir, "visual_prompts.json")
    with open(visual_prompts_path, "w", encoding="utf-8") as f:
        json.dump(visual_prompts, f, indent=4, ensure_ascii=False)
        
    print(f"\n[SYSTEM] Triggering VisualEngine. Saved {len(visual_prompts)} prompts to JSON.")
    visual_engine_dir = os.path.join(MEDIA_HUB_DIR, "VisualEngine")
    vis_python = os.path.join(visual_engine_dir, "ComfyUI", ".venv", "Scripts", "python.exe")
    
    try:
        subprocess.run([vis_python, "image_engine.py", "--prompts_json", visual_prompts_path, "--output_dir", gen_dir], cwd=visual_engine_dir, check=True)
    except Exception as e:
        print(f"[ERROR] Visual Engine Crashed: {e}")
    
    print(f"\n[SYSTEM] Triggering SoundEngine for Background Music...")
    print(f"[DIRECTOR] Music Prompt: {music_prompt}")
    
    SOUND_ENGINE_DIR = os.path.join(MEDIA_HUB_DIR, "SoundEngine")
    venv_python_se = os.path.join(SOUND_ENGINE_DIR, "ACE-Step-1.5", ".venv", "Scripts", "python.exe")
    duration_music = (len(valid_story_text) // 15) + 10 # 1 sec per 15 chars + 10s ambient buffer
    
    # SoundEngine invocation
    try:
        subprocess.run(
            [venv_python_se, "audio_engine.py", "--prompt", music_prompt, "--duration", str(duration_music), "--output", music_path],
            cwd=SOUND_ENGINE_DIR, check=True
        )
    except Exception as e:
        print(f"[ERROR] SoundEngine execution failed: {e}. Video will be rendered purely with voice.")
    
    metadata["status"] = "Completed Audio & VTT"
    with open(os.path.join(gen_dir, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=4, ensure_ascii=False)
        


    print("\n[SYSTEM] Post-Processing Video (Visual Symphony)...")
    import video_composer
    success = video_composer.create_final_video(gen_dir)
        
    if success:
        print("\n[SYSTEM] Pipeline completed cleanly.")
    else:
        print("\n[ERROR] Pipeline failed fatally.")
        sys.exit(1)

if __name__ == "__main__":
    # Args: duration, dialogue, rating, loc, voice, custom_theme, zero_shot
    tar_time = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    dial = int(sys.argv[2]) if len(sys.argv) > 2 else 30
    rat = sys.argv[3] if len(sys.argv) > 3 else "Teen"
    lo = sys.argv[4] if len(sys.argv) > 4 else "Neutro"
    vo = sys.argv[5] if len(sys.argv) > 5 else "pt-BR-AntonioNeural"
    theme = sys.argv[6] if len(sys.argv) > 6 else ""
    zero_shot = (sys.argv[7].lower() == "true") if len(sys.argv) > 7 else False

    asyncio.run(run_pipeline(tar_time, dial, rat, lo, vo, theme, zero_shot))
