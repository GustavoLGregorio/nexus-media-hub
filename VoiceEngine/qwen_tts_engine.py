import os
import json
import torch
import soundfile as sf
from faster_qwen3_tts import FasterQwen3TTS

class QwenVoiceEngine:
    def __init__(self, model_id: str = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"):
        """
        Initializes the Qwen3-TTS model for narrative cinematic generation.
        We default to the 1.7B model to utilize the 12GB VRAM optimally while 
        guaranteeing the ultimate storytelling quality and emotional depth.
        """
        self.model_id = model_id
        self.model = None

    def load_model(self):
        """Loads the tensors into the RTX 3060 VRAM."""
        print(f"[SYSTEM] Booting up Qwen3-TTS engine onto VRAM: {self.model_id}")
        self.model = FasterQwen3TTS.from_pretrained(self.model_id)

    def generate_voice(self, text: str, output_path: str, voice_prompt: str, ref_audio_path: str, ref_text: str, language: str = "English"):
        """
        Generates the voice clone leveraging the reference audio and the instruction 
        (natural language voice_prompt) without requiring pseudo-syntax.
        """
        if self.model is None:
            self.load_model()
            
        print(f"[SYSTEM] Generating audio sequence...")
        print(f"[SYSTEM] Zero-Shot Reference: {os.path.basename(ref_audio_path)}")
        print(f"[SYSTEM] Prompt Intention: {voice_prompt}")
        print(f"[SYSTEM] Language: {language}")
        
        # Inference using zero-shot cloning across the specified language
        audio_data, sample_rate = self.model.generate_voice_clone(
            text=text,
            language=language,
            ref_audio=ref_audio_path,
            ref_text=ref_text,
        )
        
        sf.write(output_path, audio_data[0], sample_rate)
        print(f"[SYSTEM] Audio successfully saved to: {output_path}")

    def unload(self):
        """
        Aggressively empty VRAM mapping to allow SoundEngine / VideoEngine to take over.
        Survival mode offloading as dictated by the ARCHITECTURE_AND_SCALE guidelines.
        """
        if self.model is not None:
            print("[SYSTEM] Unloading Qwen3-TTS model off VRAM...")
            del self.model
            self.model = None
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            print("[SYSTEM] VRAM mapping fully cleared.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--ref_audio", required=True)
    parser.add_argument("--ref_text", required=True)
    parser.add_argument("--language", default="English")
    args = parser.parse_args()
    
    engine = QwenVoiceEngine()
    engine.generate_voice(
        text=args.text,
        output_path=args.output,
        voice_prompt=args.prompt,
        ref_audio_path=args.ref_audio,
        ref_text=args.ref_text,
        language=args.language
    )
    engine.unload()
