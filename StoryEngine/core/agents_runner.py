import os
import json
from pathlib import Path
from core.llm_provider import LLMProvider
from core.schemas import DIRECTOR_SCHEMA_INJECTION, ARCHIVIST_SCHEMA_INJECTION

class AgentsRunner:
    def __init__(self, project_config: dict, generation_dir: str):
        self.config = project_config
        self.generation_dir = Path(generation_dir)
        
        # Initialize LLM Provider based on global_config -> text_engine
        text_engine_config = self.config.get("global_config", {}).get("text_engine", {})
        self.llm = LLMProvider(text_engine_config)
        
        self.personas = self.config.get("agents_persona", {})
        self.parameters = self.config.get("project_parameters", {})

    def run(self):
        """Executes the StoryEngine pipeline strictly inside Python."""
        print("[StoryEngine] Starting Agnostic Story Generation Pipeline...")
        
        # 1. Run Director
        director_blueprint = self._run_director()
        
        # 2. Run Archivist (Visuals) based on Director's script
        # Assuming the director generated a script or scenes, we pass it to the archivist
        script_data = director_blueprint.get("scaffold_plan", [])
        
        print("[StoryEngine] Extracting Visuals (Archivist)...")
        visual_prompts = self._run_archivist(script_data)
        
        # 3. Compile Master Blueprint
        master_blueprint = {
            "project_name": self.config.get("project_name", "Unknown"),
            "scaffold_plan": script_data,
            "visual_prompts": visual_prompts,
            "audio_specs": {
                "music_prompt": director_blueprint.get("cinematic_music_prompt", "")
            },
            "voice_specs": self.config.get("global_config", {}).get("voice_engine", {})
        }
        
        self._save_blueprint(master_blueprint)
        print(f"[StoryEngine] Blueprint Saved in {self.generation_dir}")

    def _run_director(self) -> dict:
        print("[StoryEngine] Calling Director Agent...")
        base_persona = self.personas.get("director", "You are the Director.")
        
        # INJECTION: Append mandatory schema
        system_prompt = base_persona + "\n" + DIRECTOR_SCHEMA_INJECTION
        
        user_prompt = f"Create a narrative scaffold targeting {self.parameters.get('target_audience')}. Pacing: {self.parameters.get('pacing')}."
        
        return self.llm.generate_json(system_prompt, user_prompt)

    def _run_archivist(self, script_data: list) -> dict:
        base_persona = self.personas.get("archivist", "You are the Archivist.")
        
        # INJECTION: Append mandatory schema
        system_prompt = base_persona + "\n" + ARCHIVIST_SCHEMA_INJECTION
        
        user_prompt = f"Extract the visual states from this script: {json.dumps(script_data)}"
        
        return self.llm.generate_json(system_prompt, user_prompt)
        
    def _save_blueprint(self, blueprint: dict):
        self.generation_dir.mkdir(parents=True, exist_ok=True)
        blueprint_path = self.generation_dir / "director_blueprint.json"
        
        with open(blueprint_path, "w", encoding="utf-8") as f:
            json.dump(blueprint, f, indent=2, ensure_ascii=False)
