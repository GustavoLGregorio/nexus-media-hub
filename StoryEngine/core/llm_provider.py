import os
import json
import google.generativeai as genai

# For local models, you might import an OpenAI-compatible client 
# or a specific llama.cpp python binding. For now, we mock the interface.

class LLMProvider:
    def __init__(self, config: dict):
        self.provider = config.get("provider", "gemini").lower()
        self.model_name = config.get("model", "gemini-1.5-pro")
        self.local_path = config.get("local_model_path", "")
        
        if self.provider == "gemini":
            api_key = os.environ.get("GEMINI_API_KEY")
            if not api_key:
                raise ValueError("GEMINI_API_KEY environment variable is not set.")
            genai.configure(api_key=api_key)
            self.client = genai.GenerativeModel(self.model_name)

    def generate(self, system_prompt: str, user_prompt: str) -> str:
        """Generates text from the configured provider."""
        if self.provider == "gemini":
            # Gemini expects system instructions in the model generation config or prepended.
            import time
            max_retries = 5
            base_delay = 15
            
            for attempt in range(max_retries):
                try:
                    model = genai.GenerativeModel(
                        model_name=self.model_name,
                        system_instruction=system_prompt
                    )
                    response = model.generate_content(user_prompt)
                    return response.text
                except Exception as e:
                    error_str = str(e)
                    if "429" in error_str or "Quota" in error_str:
                        # Extrai o tempo de espera do erro se existir
                        delay = base_delay * (attempt + 1)
                        if "Please retry in" in error_str:
                            try:
                                # Extract number from "Please retry in 51.583270162s."
                                delay_str = error_str.split("Please retry in ")[1].split("s.")[0]
                                delay = float(delay_str) + 2 # add 2 seconds margin
                            except:
                                pass
                        
                        print(f"[LLM Error - Quota Exceeded] Attempt {attempt + 1}/{max_retries}. Sleeping for {delay:.2f} seconds...")
                        time.sleep(delay)
                    else:
                        print(f"[LLM Error - Gemini] {e}")
                        # For non-quota errors, maybe retry quickly or just fail
                        if attempt == max_retries - 1:
                            return "{}"
                        time.sleep(5)
                        
            return "{}"
        elif self.provider == "llama.cpp":
            # Implementation for llama.cpp local inference via subprocess or HTTP server
            print(f"[LLM] Running local model from {self.local_path} (Stub)")
            # Stub: in the future, this calls the local server initialized by Orchestrator
            return "{}"
        else:
            raise ValueError(f"Unknown LLM Provider: {self.provider}")

    def generate_json(self, system_prompt: str, user_prompt: str) -> dict:
        """Forces JSON parsing on the output."""
        response_text = self.generate(system_prompt, user_prompt)
        
        # Clean markdown formatting if present
        response_text = response_text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
            
        try:
            return json.loads(response_text)
        except json.JSONDecodeError as e:
            print(f"[JSON Decode Error] Failed to parse output. Error: {e}")
            print(f"Raw Output: {response_text}")
            return {}
