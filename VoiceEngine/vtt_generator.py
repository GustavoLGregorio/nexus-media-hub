import os
import sys
import argparse
import json
import torch
from transformers import pipeline

def generate_vtt(audio_path, output_vtt, language='english'):
    print(f"[VTT] Generating subtitles for {audio_path} (Language: {language})...")
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    
    pipe = pipeline(
        "automatic-speech-recognition",
        model="openai/whisper-small", # Downgrade parameter to support word-level without OOM
        dtype=torch.float16 if device == "cuda" else torch.float32,
        device=device,
    )
    
    result = pipe(
        audio_path,
        chunk_length_s=30,
        batch_size=1, # Fixed VRAM leak!
        return_timestamps="word",
        generate_kwargs={"language": "english", "task": "transcribe"}
    )
    
    with open(output_vtt, "w", encoding="utf-8") as f:
        f.write("WEBVTT\n\n")
        
        words = result.get("chunks", [])
        cues = []
        current_cue = []
        
        for w in words:
            current_cue.append(w)
            text_str = w.get("text", "")
            # Break into small dynamic blocks of 4 words or strong punctuation
            if len(current_cue) >= 4 or any(p in text_str for p in [".", ",", "!", "?", ";"]):
                cues.append(current_cue)
                current_cue = []
                
        if current_cue:
            cues.append(current_cue)
            
        for cue_words in cues:
            start = cue_words[0].get("timestamp", [0.0, 0.0])[0]
            end = cue_words[-1].get("timestamp", [0.0, 0.0])[1]
            if start is None: start = 0.0
            if end is None: end = start + 1.0 # Fallback 1 sec
            
            text = "".join([w.get("text", "") for w in cue_words]).strip()
            # Clean up pacing punctuations (ellipses and em-dashes) from the subtitles
            text = text.replace("...", "").replace("—", "-").replace(" .", ".").strip()
            
            def format_ts(seconds):
                h = int(seconds // 3600)
                m = int((seconds % 3600) // 60)
                s = seconds % 60
                return f"{h:02}:{m:02}:{s:06.3f}"
            
            f.write(f"{format_ts(start)} --> {format_ts(end)}\n")
            f.write(f"{text}\n\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate VTT subtitles")
    parser.add_argument("audio_path", type=str)
    parser.add_argument("output_vtt", type=str)
    parser.add_argument("--language", type=str, default="portuguese", help="Language for Whisper (e.g. english, portuguese)")
    args = parser.parse_args()
    
    generate_vtt(args.audio_path, args.output_vtt, args.language)
