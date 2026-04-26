import os
import json
from pathlib import Path
from core.llm_provider import LLMProvider
from core.schemas import (
    DIRECTOR_SCHEMA_INJECTION, WRITER_SCHEMA_INJECTION,
    CRITIC_SCHEMA_INJECTION, AUDIENCE_SCHEMA_INJECTION,
    ARCHIVIST_SCHEMA_INJECTION, ARTIST_SCHEMA_INJECTION,
    COMPOSER_SCHEMA_INJECTION
)

class AgentsRunner:
    def __init__(self, project_config: dict, generation_dir: str):
        self.config = project_config
        self.project_name = self.config.get("name", self.config.get("project_name", "Unknown"))
        self.generation_dir = Path(generation_dir)
        self.project_root = self.generation_dir.parent
        
        # Adaptando a inicialização do LLM Provider para aceitar o formato planificado da nova UI
        provider_name = "gemini" if "gemini" in self.config.get("model", "") else "llama.cpp"
        text_engine_config = self.config.get("global_config", {}).get("text_engine", {
            "provider": provider_name,
            "model": self.config.get("model", "gemini-3-flash-preview")
        })
        self.llm = LLMProvider(text_engine_config)
        
        self.personas = self.config.get("agents", self.config.get("agents_persona", {}))
        self.parameters = self.config

    def run(self):
        print("[StoryEngine] Starting 7-Agent Story Generation Pipeline...")
        target_lang = self.parameters.get("language", "en-US")
        include_vocals = self.parameters.get("includeVocals", False)
        
        director_out = self._run_director(target_lang)
        scaffold = director_out.get("scaffold_plan", [])
        music_vibe = director_out.get("cinematic_music_prompt", "")
        
        acts_results = []
        archivist_state = "Starting empty state."

        for act in scaffold:
            act_num = act.get("act_number", len(acts_results) + 1)
            instruction = act.get("chunk_instruction", "")
            
            print(f"[StoryEngine] --- Processing Act {act_num} ---")
            
            approved_text = ""
            writer_prompt = ""
            
            for attempt in range(1, 4):
                print(f"[StoryEngine] Audience Loop: Attempt {attempt}/3")
                
                # 1. WRITER
                writer_prompt = f"Act Instruction: {instruction}\nCurrent Archivist State: {archivist_state}"
                writer_out = self._run_writer(writer_prompt, target_lang)
                draft_text = writer_out.get("text", "")
                
                # 2. CRITIC
                critic_out = self._run_critic(draft_text, target_lang)
                if critic_out.get("decision") == "revise":
                    draft_text = critic_out.get("revised_text", draft_text)
                    print("[StoryEngine] Critic revised the text.")
                else:
                    print("[StoryEngine] Critic passed the text.")
                    
                # 3. AUDIENCE
                audience_out = self._run_audience(draft_text, target_lang)
                decision = audience_out.get("decision", "reject")
                
                if decision == "pass":
                    print("[StoryEngine] Audience APPROVED!")
                    approved_text = draft_text
                    
                    if attempt <= 2:
                        self._save_to_dataset(writer_prompt, approved_text)
                    break
                else:
                    print(f"[StoryEngine] Audience REJECTED: {audience_out.get('feedback')}")
                    if attempt == 3:
                        print("[StoryEngine] Max attempts reached. Forcing acceptance to prevent infinite loop.")
                        approved_text = draft_text
                    else:
                        instruction += f"\\nAudience Feedback to fix: {audience_out.get('feedback')}"
            
            # 4. ARCHIVIST
            archivist_out = self._run_archivist(approved_text, archivist_state, target_lang)
            archivist_state = json.dumps(archivist_out)
            print("[StoryEngine] Archivist updated state.")
            
            # 5. ARTIST
            artist_out = self._run_artist(approved_text, archivist_state, target_lang)
            print("[StoryEngine] Artist generated ComfyUI prompts.")
            
            # 6. COMPOSER
            composer_out = self._run_composer(approved_text, music_vibe, include_vocals, target_lang)
            print("[StoryEngine] Composer generated audio prompts.")
            
            acts_results.append({
                "act_number": act_num,
                "text": approved_text,
                "archivist_state": archivist_out,
                "artist_prompts": artist_out,
                "composer_prompts": composer_out
            })
            
        master_blueprint = {
            "project_name": self.project_name,
            "global_music_vibe": music_vibe,
            "acts": acts_results
        }
        
        self._save_blueprint(master_blueprint)
        print(f"[StoryEngine] Pipeline Finished. Blueprint Saved.")

    def _inject(self, base_persona, target_lang, schema):
        lang_injection = f"\\n\\n!!! CRITICAL LANGUAGE DIRECTIVE !!!\\nALL narrative text and story content generated inside the JSON MUST be strictly written in {target_lang}."
        return str(base_persona) + lang_injection + "\\n" + schema

    def _run_director(self, lang):
        system = self._inject(self.personas.get("director", ""), lang, DIRECTOR_SCHEMA_INJECTION)
        user = f"Project Description: {self.parameters.get('description', '')}\\nAudience: {self.parameters.get('audience', '')}\\nPacing: {self.parameters.get('pacing', '')}"
        return self.llm.generate_json(system, user)

    def _run_writer(self, context, lang):
        system = self._inject(self.personas.get("writer", ""), lang, WRITER_SCHEMA_INJECTION)
        return self.llm.generate_json(system, context)

    def _run_critic(self, text, lang):
        system = self._inject(self.personas.get("critic", ""), lang, CRITIC_SCHEMA_INJECTION)
        return self.llm.generate_json(system, f"Review this text: {text}")

    def _run_audience(self, text, lang):
        system = self._inject(self.personas.get("audience", ""), lang, AUDIENCE_SCHEMA_INJECTION)
        return self.llm.generate_json(system, f"Evaluate this text: {text}")

    def _run_archivist(self, text, prev_state, lang):
        system = self._inject(self.personas.get("archivist", ""), lang, ARCHIVIST_SCHEMA_INJECTION)
        return self.llm.generate_json(system, f"Previous State: {prev_state}\\nNew Action Text: {text}")

    def _run_artist(self, text, state, lang):
        system = self._inject(self.personas.get("artist", ""), lang, ARTIST_SCHEMA_INJECTION)
        return self.llm.generate_json(system, f"Act Text: {text}\\nArchivist State: {state}")

    def _run_composer(self, text, vibe, vocals, lang):
        system = self._inject(self.personas.get("composer", ""), lang, COMPOSER_SCHEMA_INJECTION)
        user = f"Act Text: {text}\\nGlobal Vibe: {vibe}\\nInclude Vocals/Lyrics: {'YES' if vocals else 'NO'}"
        return self.llm.generate_json(system, user)

    def _save_to_dataset(self, instruction, text):
        dataset_path = self.project_root / "fine_tuning_dataset.jsonl"
        entry = {"messages": [{"role": "user", "content": instruction}, {"role": "assistant", "content": text}]}
        with open(dataset_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\\n")

    def _save_blueprint(self, blueprint):
        self.generation_dir.mkdir(parents=True, exist_ok=True)
        blueprint_path = self.generation_dir / "director_blueprint.json"
        with open(blueprint_path, "w", encoding="utf-8") as f:
            json.dump(blueprint, f, indent=2, ensure_ascii=False)
