import argparse
import json
import sys
from core.agents_runner import AgentsRunner

def main():
    parser = argparse.ArgumentParser(description="MediaHub Agnostic StoryEngine")
    parser.add_argument("--config", type=str, required=True, help="Path to project_config.json")
    parser.add_argument("--output_dir", type=str, required=True, help="Path to generation directory")
    
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
    except Exception as e:
        print(f"[StoryEngine Error] Failed to read config file {args.config}: {e}")
        sys.exit(1)
        
    runner = AgentsRunner(project_config, args.output_dir)
    runner.run()

if __name__ == "__main__":
    main()
