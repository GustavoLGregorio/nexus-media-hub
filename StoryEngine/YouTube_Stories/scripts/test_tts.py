import asyncio
import os
import sys

# Add the script parent directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from story_engine import generate_tts

async def test():
    text = "Isso é um teste de geração de áudio. O sistema deve funcionar sem travamentos."
    output_path = os.path.abspath("test_audio_success.mp3")
    vtt_path = os.path.abspath("test_subtitles.vtt")
    voice = "[F5] dossie_felipe.wav"
    
    print(f"Iniciando teste de TTS para: {voice}")
    try:
        await generate_tts(text, output_path, voice=voice, vtt_path=vtt_path)
        if os.path.exists(output_path):
            size = os.path.getsize(output_path)
            print(f"Sucesso! Áudio gerado em: {output_path} ({size} bytes)")
        else:
            print("Falha: O arquivo de áudio não foi encontrado.")
    except Exception as e:
        print(f"Erro no teste: {e}")

if __name__ == "__main__":
    asyncio.run(test())
