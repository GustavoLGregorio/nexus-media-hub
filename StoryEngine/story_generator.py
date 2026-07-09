import argparse
import json
import sys
from core.agents_runner import AgentsRunner

def main():
    parser = argparse.ArgumentParser(description="MediaHub Agnostic StoryEngine")
    parser.add_argument("--config", type=str, required=True, help="Path to project_config.json")
    parser.add_argument("--output_dir", type=str, required=True, help="Path to generation directory")
    
    parser.add_argument("--duration", type=int, default=0, help="Override target duration in minutes")
    parser.add_argument("--dialogue_ratio", type=int, default=0, help="Override dialogue ratio")
    parser.add_argument("--rating", type=str, default="", help="Override content rating")
    parser.add_argument("--localization", type=str, default="", help="Override localization")
    parser.add_argument("--voice", type=str, default="", help="Override TTS Voice")
    parser.add_argument("--theme", type=str, default="", help="Override scenario theme")
    parser.add_argument("--zero_shot", action="store_true", help="Zero-shot mode (skip Director)")
    
    args = parser.parse_args()
    
    # Load environment variables
    from dotenv import load_dotenv
    from pathlib import Path
    
    # Try to find .env in the root MediaHub directory
    env_path = Path(__file__).resolve().parent.parent / ".env"
    load_dotenv(dotenv_path=env_path)
    
    try:
        with open(args.config, "r", encoding="utf-8") as f:
            project_config = json.load(f)
            
        # Apply runtime overrides
        if args.duration > 0:
            project_config["duration"] = args.duration
        if args.dialogue_ratio > 0:
            project_config["dialogue_ratio"] = args.dialogue_ratio
        if args.rating:
            project_config["rating"] = args.rating
        if args.localization:
            project_config["localization"] = args.localization
        if args.voice:
            project_config["voice"] = args.voice
        if args.theme:
            project_config["theme"] = args.theme
        if args.zero_shot:
            project_config["zero_shot"] = True
            
    except Exception as e:
        print(f"[StoryEngine Error] Failed to read config file {args.config}: {e}")
        sys.exit(1)
        
    runner = AgentsRunner(project_config, args.output_dir)
    runner.run()

if __name__ == "__main__":
    main()
