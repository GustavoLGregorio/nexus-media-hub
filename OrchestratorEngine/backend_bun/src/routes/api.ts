import { Elysia } from "elysia";
import { readdir, stat, readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const BASE_DIR = join(import.meta.dir, "../../../../");
const YT_DIR = join(BASE_DIR, "StoryEngine", "YouTube_Stories");
const VOICES_DIR = join(BASE_DIR, "VoiceEngine", "voices");

// Ensure voices dir exists
if (!existsSync(VOICES_DIR)) {
  mkdir(VOICES_DIR, { recursive: true }).catch(console.error);
}

export const apiRoutes = new Elysia()
  .get("/api/health", () => {
    return { status: "online", engines: ["YouTube_Stories", "TikTok_TrueCrime"], orchestrator: "bun" };
  })
  
  .get("/api/generations/youtube", async () => {
    const genPath = join(YT_DIR, "generations");
    if (!existsSync(genPath)) return { data: [] };
    
    const results = [];
    const entries = await readdir(genPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const metaPath = join(genPath, entry.name, "metadata.json");
        if (existsSync(metaPath)) {
          try {
            const fileContent = await readFile(metaPath, "utf-8");
            const meta = JSON.parse(fileContent);
            meta.folder_name = entry.name;
            results.push(meta);
          } catch (e) {
            // Ignore bad JSON
          }
        }
      }
    }
    
    // Sort logic would go here if needed
    return { data: results };
  })
  
  .get("/api/voices", async () => {
    const metaPath = join(VOICES_DIR, "voices_metadata.json");
    let metadata: any[] = [];
    
    if (existsSync(metaPath)) {
      try {
        metadata = JSON.parse(await readFile(metaPath, "utf-8"));
      } catch (e) {
        metadata = [];
      }
    }
    
    if (!existsSync(VOICES_DIR)) return { data: [] };
    
    const allFiles = await readdir(VOICES_DIR);
    const wavFiles = allFiles.filter(f => f.toLowerCase().endsWith(".wav"));
    
    const results = wavFiles.map(f => {
      const matched = metadata.find(m => m.filename === f);
      if (matched) return matched;
      return { filename: f, id: f, ref_text: "", gender: "unknown", age: "unknown", traits: "" };
    });
    
    return { data: results };
  })
  
  .get("/api/models/gemini", async () => {
    // Usando a chave configurada no .env do servidor
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { status: "error", message: "GEMINI_API_KEY is not set in backend .env" };
    }
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const data = await response.json();
      
      if (data.models) {
        // Filtrar apenas modelos que importam para texto criativo
        const validModels = data.models
          .filter((m: any) => m.name.includes("gemini") && m.supportedGenerationMethods.includes("generateContent"))
          .map((m: any) => m.name.replace("models/", ""));
          
        return { status: "success", data: validModels };
      }
      return { status: "error", message: "Failed to parse models" };
    } catch (e) {
      return { status: "error", message: String(e) };
    }
  })
  
  .post("/api/factory/ai-assist", async ({ body }: { body: any }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { status: "error", message: "GEMINI_API_KEY is not set" };
    
    const { name, audience, aspectRatio, pacing, language, description, includeVocals } = body;
    
    const systemPrompt = `You are a Master Creative Director configuring a multi-agent AI pipeline for a project.
Project Name: ${name}
Target Audience: ${audience}
Aspect Ratio: ${aspectRatio}
Pacing/Vibe: ${pacing}
Language (Output Language for the final content): ${language}
Project Core Description: ${description}
Include Vocals in Music: ${includeVocals ? 'Yes' : 'No'}

Your goal is to write System Prompts (instructions) for 7 distinct AI Agents that will execute this project.
The agents are:
1. "director": Plans the structure, pacing, and acts.
2. "writer": Writes the actual creative story/script narrative.
3. "critic": The objective/technical reviewer. Checks for AI clichés, grammatical errors, logic flaws, state breaking from archivist, and platform forbidden words.
4. "audience": The subjective reviewer. Evaluates engagement, hooks, and if the story truly appeals to the target audience.
5. "archivist": Keeps track of the story state, character physical appearance, locations, and concrete actions.
6. "artist": Generates visual prompts for ComfyUI. Must consume data from the archivist and the current act to output positive and negative prompts.
7. "composer": Analyzes the soundtrack requested by the director and generates prompts for ACE-Step-1.5XL. If 'Include Vocals' is Yes, also writes the lyrics.

IMPORTANT: The system prompts must explicitly enforce that the output should be generated in the requested language: ${language}.
RETURN ONLY A VALID JSON OBJECT WITH THESE 7 EXACT KEYS: "director", "writer", "critic", "audience", "archivist", "artist", "composer". The values must be their complete system prompts as strings. Do not use markdown blocks like \`\`\`json. Return raw JSON.`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      
      const data = await response.json();
      if (data.candidates && data.candidates.length > 0) {
        let jsonString = data.candidates[0].content.parts[0].text;
        jsonString = jsonString.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(jsonString);
        return { status: "success", data: parsed };
      }
      return { status: "error", message: "Failed to generate agents from Gemini" };
    } catch (e) {
      return { status: "error", message: String(e) };
    }
  })
  
  .post("/api/projects", async ({ body }: { body: any }) => {
    const { name, config } = body;
    if (!name || !config) return { status: "error", message: "Missing name or config payload" };
    
    const safeName = name.replace(/ /g, "_");
    const projectPath = join(BASE_DIR, "ProjectVault", safeName);
    
    try {
      if (!existsSync(projectPath)) {
        await mkdir(projectPath, { recursive: true });
      }
      const configPath = join(projectPath, "project_config.json");
      await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
      
      return { status: "success", message: "Project saved successfully", path: projectPath };
    } catch(e) {
       return { status: "error", message: String(e) };
    }
  })
  
  .get("/api/projects", async () => {
    const vaultPath = join(BASE_DIR, "ProjectVault");
    if (!existsSync(vaultPath)) return { data: [] };
    
    const results = [];
    try {
      const entries = await readdir(vaultPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const configPath = join(vaultPath, entry.name, "project_config.json");
          if (existsSync(configPath)) {
            try {
              const fileContent = await readFile(configPath, "utf-8");
              const config = JSON.parse(fileContent);
              // Fallback for missing name just in case
              config.name = config.name || entry.name;
              results.push(config);
            } catch (e) {
              // Ignore bad JSON
            }
          }
        }
      }
      return { data: results };
    } catch (e) {
      return { data: [] };
    }
  })
  
  .post("/api/voices/upload", async ({ body }: { body: any }) => {
    const { file, ref_text, gender, age, traits } = body;
    if (!file) return { status: "error", message: "No file provided" };
    
    let originalName = file.name || "uploaded";
    let baseName = originalName.substring(0, originalName.lastIndexOf('.'));
    if (!baseName) baseName = originalName;
    baseName = baseName.replace(/[^a-zA-Z0-9_-]/g, "_");
    
    const finalWavName = `${baseName}.wav`;
    const finalWavPath = join(VOICES_DIR, finalWavName);
    
    const tempPath = join(VOICES_DIR, `temp_${Date.now()}_${originalName}`);
    const arrayBuffer = await file.arrayBuffer();
    await writeFile(tempPath, Buffer.from(arrayBuffer));
    
    try {
      const proc = Bun.spawn(["ffmpeg", "-y", "-i", tempPath, finalWavPath], {
        stdout: "ignore",
        stderr: "ignore"
      });
      await proc.exited;
      
      const { unlink } = await import("fs/promises");
      if (existsSync(tempPath)) {
        await unlink(tempPath);
      }
      
      const metaPath = join(VOICES_DIR, "voices_metadata.json");
      let metadata: any[] = [];
      if (existsSync(metaPath)) {
        try {
          metadata = JSON.parse(await readFile(metaPath, "utf-8"));
        } catch(e) {}
      }
      
      metadata = metadata.filter((m: any) => m.filename !== finalWavName);
      metadata.push({
        filename: finalWavName,
        ref_text: ref_text || "",
        gender: gender || "unknown",
        age: age || "unknown",
        traits: traits || ""
      });
      
      await writeFile(metaPath, JSON.stringify(metadata, null, 2), "utf-8");
      
      return { status: "success", message: "Voice uploaded and converted", filename: finalWavName };
    } catch (e) {
      return { status: "error", message: String(e) };
    }
  });
