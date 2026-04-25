# Nexus MediaHub

The Nexus MediaHub is the core orchestral root for the entire multi-agent, generative media ecosystem. This repository bridges specialized micro-engines (like `StoryEngine` for narrative plot construction and `SoundEngine` for musical synthesis) through a centralized `OrchestratorEngine`.

## Repository Architecture

```text
MediaHub/
├── OrchestratorEngine/   # The Brain. FastAPI Backend + React WebUI (Monolithic Supervisor)
├── StoryEngine/          # LLM Generation (Cognitive Logic, Video Compositing, Story Generation)
├── SoundEngine/          # PyTorch-based Audio/Music Generation (Extreme VRAM Offloads)
└── .env                  # Global Configuration Keys (Gemini, CivitAI, HuggingFace)
```

## Global Engineering Strict Standards

To ensure long-term structural integrity, maintainability, and enterprise scalability (specifically for monetization, "SaaS" deployments, or engine licensing), the following absolute rules MUST be followed:

### 1. English Exclusivity Policy
All documentation and internal source code is strictly tracked in English.
- **Log Streams & Print Calls:** Every system output, backend print, and UI diagnostic log mapping out of python must be English. (e.g. `[SYSTEM] Booting up generation...`, never `[SISTEMA] Iniciando...`).
- **Variables & Structure:** Classes, JSON arrays, and variables must be English only.
- **Exception:** Raw LLM prompt structures designated to generate content specific for PT-BR audiences. Prompts themselves may include Portuguese instructions to the sub-agent.

### 2. Strict Naming Conventions
- Top-level Engines must use **PascalCase** (`StoryEngine`, `SoundEngine`).
- Python files and variables must use **snake_case** (`story_engine.py`, `video_composer`).
- Frontend frameworks and React applications must use **camelCase** for internal component files.

### 3. Comprehensive Documentation
Every function, macro, and pipeline loop written here must be rigorously documented via `docstrings` or typescript `JSDoc` annotations. We enforce explicit type hinting in all Python components (`-> list[dict]`, `: str`) to maintain stability when agents compile codes autonomously.

### 4. Zero-Assumption Environment Security
Frontend configurations do NOT bleed into backend scripts. The Root folder contains a single source of truth `.env` file that the isolated Python architectures pull their intelligence keys from. 
