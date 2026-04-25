import os
import sys
import torch
import argparse
import shutil
from pathlib import Path

# Fix relative path to ACE-Step module
current_dir = Path(__file__).resolve().parent
acestep_dir = current_dir / "ACE-Step-1.5"
sys.path.append(str(acestep_dir))

from acestep.inference import GenerationParams, GenerationConfig, generate_music
from acestep.handler import AceStepHandler

def main():
    parser = argparse.ArgumentParser(description="MediaHub SoundEngine using ACE-Step 1.5 XL SFT")
    parser.add_argument("--prompt", type=str, required=True, help="Descrição textual da música")
    parser.add_argument("--duration", type=int, default=15, help="Duração da trilha em segundos")
    parser.add_argument("--output", type=str, required=True, help="Caminho final do arquivo .wav gerado")
    args = parser.parse_args()

    print("\n[SOUND ENGINE] Booting up ACE-Step 1.5 XL SFT (50 Steps).")

    # 1. Apply maximum GPU Offload configuration
    try:
        from acestep.gpu_config import get_global_gpu_config
        # We ensure offload = True to save VRAM for VideoComposer and future image pipelines
        gpu_cfg = get_global_gpu_config()
        gpu_cfg.offload_to_cpu_default = True
        gpu_cfg.offload_dit_to_cpu_default = True
        gpu_cfg.quantization_default = True
    except Exception as e:
        print(f"[SOUND ENGINE] Failed to force GPU config: {e}")

    # 2. Instantiate and Initialize Handler with proper project root
    dit_handler = AceStepHandler()
    
    project_root = str(acestep_dir)  # ACE-Step-1.5 directory contains 'checkpoints/'
    
    try:
        status_msg, success = dit_handler.initialize_service(
            project_root=project_root,
            config_path="acestep-v15-xl-sft",
            offload_to_cpu=True,
            offload_dit_to_cpu=True,
            quantization="int8_weight_only",
        )
        if not success:
            print(f"[ERROR] Model initialization failed: {status_msg}")
            sys.exit(1)
        print(f"[SOUND ENGINE] Model loaded successfully.")
    except Exception as e:
        print(f"[ERROR] Fatal initialization crash: {e}")
        sys.exit(1)

    # 3. Settings for Highest Fidelity (No longer Turbo 8-steps)
    # Disable all LLM/CoT features since we run without an LLM handler
    params = GenerationParams(
        task_type="text2music",
        caption=args.prompt,
        lyrics="[Instrumental]",
        instrumental=True,
        duration=args.duration,
        inference_steps=50,  # High fidelity mode
        guidance_scale=4.5,  # Essential for SFT prompt adherence
        thinking=False,       # No LLM available — skip Chain-of-Thought
        use_cot_caption=False,
        use_cot_language=False,
        use_cot_metas=False,
    )

    config = GenerationConfig(
        batch_size=1,
        audio_format="wav"
    )

    output_dir = current_dir / "outputs"
    os.makedirs(output_dir, exist_ok=True)

    print(f"[SOUND ENGINE] Generating BGM ({args.duration}s): '{args.prompt}'")
    
    # 4. Generate — returns a GenerationResult dataclass
    result = generate_music(
        dit_handler=dit_handler,
        llm_handler=None,
        params=params,
        config=config,
        save_dir=str(output_dir)
    )

    # 5. Extract the actual file path from the GenerationResult object
    if result.success and result.audios:
        first_audio = result.audios[0]
        generated_file = first_audio.get("path", "")
        if generated_file and os.path.exists(generated_file):
            os.makedirs(os.path.dirname(args.output), exist_ok=True)
            try:
                import time
                time.sleep(1) # Grace period for internal OS file handles to detach
                shutil.move(generated_file, args.output)
            except PermissionError:
                shutil.copy2(generated_file, args.output)
                
            print(f"[SOUND ENGINE] Music exported successfully to: {args.output}")
        else:
            print(f"[ERROR] ACE-Step returned success but audio file missing at: {generated_file}")
            sys.exit(1)
    else:
        error_msg = result.error or result.status_message or "Unknown generation failure"
        print(f"[ERROR] ACE-Step generation failed: {error_msg}")
        sys.exit(1)

    # 6. Aggressive PyTorch VRAM Clear
    print("[SOUND ENGINE] Unloading model and purging VRAM...")
    del dit_handler
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    print("[SOUND ENGINE] Engine fully shutdown.")

if __name__ == "__main__":
    main()

