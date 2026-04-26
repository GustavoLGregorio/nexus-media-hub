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
            # For simplicity using google-generativeai, we can prepend or use system_instruction.
            # Modern gemini-1.5 models support system_instruction.
            try:
                model = genai.GenerativeModel(
                    model_name=self.model_name,
                    system_instruction=system_prompt
                )
                response = model.generate_content(user_prompt)
                return response.text
            except Exception as e:
                print(f"[LLM Error - Gemini] {e}")
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
