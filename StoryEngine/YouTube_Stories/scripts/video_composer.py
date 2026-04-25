import os
import subprocess
import json
import time
import wave
import glob

def get_audio_duration(wav_path: str):
    try:
        with wave.open(wav_path, 'r') as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            return frames / float(rate)
    except Exception as e:
        print(f"[ERROR] Could not parse audio duration for {wav_path}: {e}")
        return 0

def extract_act_num(f):
    base = os.path.basename(f)
    if "act_" in base:
       try:
           return int(base.split("act_")[1].split(".")[0])
       except:
           return 999
    return 999

def create_final_video(gen_dir: str):
    """
    Creates a fast-render TikTok/Shorts vertical video
    using Flux generated images from the same directory, stitched via FFmpeg.
    """
    audio_path = os.path.join(gen_dir, "audio_base.wav")
    vtt_path = os.path.join(gen_dir, "subtitles.vtt")
    output_video = os.path.join(gen_dir, "final_video.mp4")
    meta_path = os.path.join(gen_dir, "metadata.json")
    
    if not os.path.exists(audio_path) or not os.path.exists(vtt_path):
        print(f"[ERROR] Audio or VTT missing in {gen_dir}. Video composition aborted.")
        return False
        
    print(f"[SYSTEM] Staring FFmpeg Video Composition in {gen_dir}...")
    
    music_path = os.path.join(gen_dir, "music_base.wav")
    has_music = os.path.exists(music_path)
    
    audio_duration = get_audio_duration(audio_path)
    if audio_duration == 0:
        audio_duration = 60.0 # fallback

    # Scan for Images
    thumb_path = os.path.join(gen_dir, "thumbnail.png")
    act_files = sorted(glob.glob(os.path.join(gen_dir, "act_*.png")), key=extract_act_num)
    
    valid_images = []
    if os.path.exists(thumb_path):
        valid_images.append("thumbnail.png")
    for act in act_files:
        valid_images.append(os.path.basename(act))
        
    vtt_local = os.path.basename(vtt_path)
    
    # Setup FFmpeg CMD
    cmd = ["ffmpeg", "-y"]
    
    if valid_images:
        slides_path = os.path.join(gen_dir, "slides.txt")
        dur_per_img = audio_duration / len(valid_images)
        with open(slides_path, "w", encoding="utf-8") as f:
            for img in valid_images:
                f.write(f"file '{img}'\n")
                f.write(f"duration {dur_per_img:.3f}\n")
            f.write(f"file '{valid_images[-1]}'\n") # ffconcat repeats last file safely
            
        print(f"[SYSTEM] Generated slides.txt for {len(valid_images)} images ({dur_per_img:.2f}s each)")
        cmd.extend(["-f", "concat", "-safe", "0", "-i", "slides.txt"])
    else:
        print("[WARNING] No visual assets found. Falling back to black background.")
        cmd.extend(["-f", "lavfi", "-i", "color=c=black:s=1080x1920:r=30"])

    # Input 1: Voice, Input 2: Music (Optional)
    cmd.extend(["-i", "audio_base.wav"])
    if has_music:
        cmd.extend(["-i", "music_base.wav"])
        
    sub_style = "Fontname=Roboto,FontSize=26,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=3,Bold=1,Alignment=2,MarginV=300"
    
    if has_music:
        if valid_images:
            complex_filter = (
                "[1:a]volume=1.5[a1];"
                "[2:a]volume=0.15[a2];"
                "[a1][a2]amix=inputs=2:duration=first:dropout_transition=2[aout];"
                f"[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,subtitles={vtt_local}:force_style='{sub_style}'[vout]"
            )
        else:
            complex_filter = (
                "[1:a]volume=1.5[a1];"
                "[2:a]volume=0.15[a2];"
                "[a1][a2]amix=inputs=2:duration=first:dropout_transition=2[aout];"
                f"[0:v]subtitles={vtt_local}:force_style='{sub_style}'[vout]"
            )
            
        cmd.extend([
            "-filter_complex", complex_filter,
            "-map", "[vout]",
            "-map", "[aout]",
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-c:a", "aac", "-b:a", "192k",
            "-shortest", "final_video.mp4"
        ])
    else:
        if valid_images:
            vf_filter = f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,subtitles={vtt_local}:force_style='{sub_style}'"
        else:
            vf_filter = f"subtitles={vtt_local}:force_style='{sub_style}'"
            
        cmd.extend([
            "-vf", vf_filter,
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-c:a", "copy",
            "-shortest", "final_video.mp4"
        ])
    
    start_time = time.time()
    
    process = subprocess.Popen(cmd, cwd=gen_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    stdout, stderr = process.communicate()
    
    if process.returncode != 0:
        print(f"[ERROR] FFmpeg Video Render failed:\n{stderr.decode('utf-8', errors='ignore')}")
        return False
        
    elapsed = int(time.time() - start_time)
    print(f"[SYSTEM] Render Completed in {elapsed}s. Saved to: {output_video}")
    
    if os.path.exists(meta_path):
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
        meta["status"] = "Completed Final MP4"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=4, ensure_ascii=False)
            
    return True

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        create_final_video(sys.argv[1])
