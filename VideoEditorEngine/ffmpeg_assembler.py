import os
import json
import argparse
import subprocess
from pathlib import Path
import struct

def get_ttf_name(path):
    try:
        with open(path, 'rb') as f:
            f.seek(4)
            num_tables = struct.unpack('>H', f.read(2))[0]
            f.seek(12)
            for _ in range(num_tables):
                tag = f.read(4)
                checkSum, offset, length = struct.unpack('>III', f.read(12))
                if tag == b'name':
                    f.seek(offset)
                    format, count, stringOffset = struct.unpack('>HHH', f.read(6))
                    for i in range(count):
                        platformID, encodingID, languageID, nameID, len_, off = struct.unpack('>HHHHHH', f.read(12))
                        if nameID == 1: # Font Family Name
                            pos = f.tell()
                            f.seek(offset + stringOffset + off)
                            name_bytes = f.read(len_)
                            f.seek(pos)
                            if platformID == 3: # Windows
                                return name_bytes.decode('utf-16-be')
                            elif platformID == 1: # Mac
                                return name_bytes.decode('mac_roman')
                    break
    except Exception:
        pass
    return None

def run_ffmpeg(cmd, cwd=None):
    print(f"[FFMPEG Assembler] Executing: {' '.join(cmd)}")
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True, cwd=cwd)
    for line in process.stdout:
        print(f"[FFMPEG] {line.strip()}")
    process.wait()
    if process.returncode != 0:
        raise RuntimeError(f"FFMPEG failed with exit code {process.returncode}")

def create_act_video(act_index, img_path, audio_path, vtt_path, duration, output_path, width, height):
    """
    Creates a video segment for a single act using the generated image and audio.
    Applies a subtle Ken Burns (zoom/pan) effect, center crop, fades, and burns in subtitles.
    """
    gen_dir = Path(img_path).parent
    img_name = Path(img_path).name
    audio_name = Path(audio_path).name
    vtt_name = Path(vtt_path).name
    out_name = Path(output_path).name

    # Scale and center crop to target resolution, then zoompan
    scale_crop = f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height}"
    zoompan_filter = f"zoompan=z='min(zoom+0.0015,1.5)':d={int(duration * 25)}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{height},fps=25"
    
    cmd = [
        "ffmpeg", "-y",
        "-loop", "1", "-i", img_name,
        "-i", audio_name,
    ]
    
    vtt_file = Path(vtt_path)
    if vtt_file.exists():
        # Check for custom fonts
        project_root = Path(__file__).resolve().parent.parent
        fonts_dir = project_root / "fonts"
        custom_font_name = "Impact"
        fontsdir_flag = ""
        
        if fonts_dir.exists():
            for f in fonts_dir.iterdir():
                if f.suffix.lower() in [".ttf", ".otf"]:
                    rel_fonts = os.path.relpath(fonts_dir, gen_dir).replace('\\', '/')
                    fontsdir_flag = f"fontsdir={rel_fonts}:"
                    
                    internal_name = get_ttf_name(str(f))
                    custom_font_name = internal_name if internal_name else f.stem
                    break
        style = f"Alignment=2,Fontname={custom_font_name},Fontsize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1.5,BackColour=&H80000000,MarginV=40"
        style_escaped = style.replace(',', '\\,')
        vf = f"{scale_crop},{zoompan_filter},subtitles={vtt_name}:{fontsdir_flag}force_style={style_escaped}"
    else:
        vf = f"{scale_crop},{zoompan_filter}"
        
    cmd.extend([
        "-vf", vf,
        "-c:v", "libx264", "-tune", "stillimage", "-c:a", "aac", "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-shortest",
        out_name
    ])
    run_ffmpeg(cmd, cwd=str(gen_dir))

def main():
    parser = argparse.ArgumentParser(description="FFMPEG Video Assembler")
    parser.add_argument("--blueprint", type=str, required=True, help="Path to director_blueprint.json")
    args = parser.parse_args()
    
    blueprint_path = Path(args.blueprint)
    gen_dir = blueprint_path.parent
    project_dir = gen_dir.parent
    
    # Read project config to determine aspect ratio
    config_path = project_dir / "project_config.json"
    aspect_ratio = "9:16"
    if config_path.exists():
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                project_config = json.load(f)
                aspect_ratio = project_config.get("aspectRatio", "9:16")
        except:
            pass
            
    width, height = 1080, 1920
    if aspect_ratio == "16:9":
        width, height = 1920, 1080
    elif aspect_ratio == "1:1":
        width, height = 1080, 1080
    
    with open(blueprint_path, "r", encoding="utf-8") as f:
        blueprint = json.load(f)
        
    acts = blueprint.get("acts", [])
    if not acts:
        print("[FFMPEG Assembler] No acts found in blueprint.")
        return
        
    print(f"[FFMPEG Assembler] Found {len(acts)} acts. Assembling segments...")
    
    segment_files = []
    
    # 1. Create individual act segments with zoompan and subtitles
    for i, act in enumerate(acts):
        act_num = act.get("act_number", i + 1)
        img_path = gen_dir / f"act_{act_num}_image.png"
        audio_path = gen_dir / f"act_{act_num}_audio.wav"
        vtt_path = gen_dir / f"act_{act_num}_subtitles.vtt"
        
        # Check if assets exist
        if not img_path.exists() or not audio_path.exists():
            print(f"[FFMPEG Assembler Warning] Missing assets for Act {act_num}. Skipping.")
            continue
            
        # Get exact audio duration to calculate zoom frames
        probe_cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(audio_path)]
        try:
            dur_str = subprocess.check_output(probe_cmd, universal_newlines=True).strip()
            duration = float(dur_str)
        except Exception as e:
            print(f"[FFMPEG Assembler Error] Could not probe audio duration for act {act_num}: {e}")
            duration = 5.0 # fallback
            
        segment_out = gen_dir / f"act_{act_num}_segment.mp4"
        print(f"[FFMPEG Assembler] Generating segment {act_num} (Duration: {duration:.2f}s, Resolution: {width}x{height})")
        create_act_video(act_num, str(img_path), str(audio_path), str(vtt_path), duration, str(segment_out), width, height)
        segment_files.append(segment_out)
        
    if not segment_files:
        print("[FFMPEG Assembler] No valid segments to assemble.")
        return
        
    # 2. Robust Concat Filter and Audio Mix
    print("[FFMPEG Assembler] Building complex filtergraph for seamless transitions and BGM mix...")
    run_id = gen_dir.name.split('_')[-1]
    final_out = gen_dir / f"final_video_{run_id}.mp4"
    bgm_path = gen_dir / "background_music.mp3"
    
    if not bgm_path.exists():
        alt_bgm = gen_dir / "background_music.wav"
        if alt_bgm.exists():
            bgm_path = alt_bgm
            
    final_cmd = ["ffmpeg", "-y"]
    
    # Add all segment inputs
    for seg in segment_files:
        final_cmd.extend(["-i", seg.name])
        
    num_segments = len(segment_files)
    bgm_index = num_segments # Index of bgm input will be the number of segments
    
    filter_complex = ""
    concat_inputs = ""
    for i in range(num_segments):
        concat_inputs += f"[{i}:v][{i}:a]"
        
    # Concat filter
    filter_complex += f"{concat_inputs}concat=n={num_segments}:v=1:a=1[v_concat][a_concat]"
    
    if bgm_path.exists():
        print("[FFMPEG Assembler] Background music found. Mixing audio.")
        final_cmd.extend(["-stream_loop", "-1", "-i", bgm_path.name])
        # Volume: Voice (a_concat) at 1.0, BGM (bgm_index:a) at 0.60
        filter_complex += f";[a_concat]volume=1.0[a_voice];[{bgm_index}:a]volume=0.60[a_bgm];[a_voice][a_bgm]amix=inputs=2:duration=first[a_mix]"
        audio_map = "[a_mix]"
    else:
        print("[FFMPEG Assembler] No background music found. Proceeding with voice only.")
        audio_map = "[a_concat]"
        
    final_cmd.extend([
        "-filter_complex", filter_complex,
        "-map", "[v_concat]",
        "-map", audio_map,
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        final_out.name
    ])
    
    run_ffmpeg(final_cmd, cwd=str(gen_dir))
    print(f"[FFMPEG Assembler] Final video generated successfully at: {final_out}")
    
    # Cleanup intermediate files
    try:
        for seg in segment_files:
            seg.unlink(missing_ok=True)
    except Exception as e:
        print(f"[FFMPEG Assembler Warning] Could not cleanup intermediate files: {e}")

if __name__ == "__main__":
    main()
