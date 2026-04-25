import { $ } from "bun";
import { mkdir } from "fs/promises";
import { join } from "path";
import { platform } from "os";

const osType = platform();
const isWindows = osType === "win32";

console.log(`[SYSTEM] Starting Bootstrap Installation for MediaHub on ${osType}...`);

// 1. Initialize Submodules
console.log("[SYSTEM] Initializing and updating git submodules...");
try {
    await $`git submodule update --init --recursive`;
} catch (e) {
    console.error("[ERROR] Failed to init submodules. Is git installed and is this a git repo?", e);
}

// 2. Ensure vital directories exist (e.g., models folders so pipelines don't crash)
const dirsToEnsure = [
    "TextEngine/llama.cpp/models",
    "VisualEngine/ComfyUI/models/checkpoints",
    "VisualEngine/ComfyUI/models/loras",
    "VisualEngine/ComfyUI/output",
    "VisualEngine/ComfyUI/temp",
    "SoundEngine/ACE-Step-1.5/models",
    "SoundEngine/outputs",
    "SoundEngine/.cache"
];

for (const dir of dirsToEnsure) {
    try {
        await mkdir(dir, { recursive: true });
        console.log(`[SYSTEM] Ensured directory exists: ${dir}`);
    } catch (e) {
        // Ignore if already exists
    }
}

// 3. Install Python dependencies (Virtual Envs)
// Helper to create and install into a venv
async function setupPythonEnv(enginePath: string, reqFile: string = "requirements.txt") {
    console.log(`\n[SYSTEM] Setting up Python environment for ${enginePath}...`);
    
    const venvPath = join(enginePath, ".venv");
    const pipCmd = isWindows ? join(venvPath, "Scripts", "pip.exe") : join(venvPath, "bin", "pip");

    try {
        // Create venv
        await $`python -m venv ${venvPath}`;
        console.log(`[SYSTEM] Created virtual environment at ${venvPath}`);
        
        // Install requirements if file exists
        const reqPath = join(enginePath, reqFile);
        const file = Bun.file(reqPath);
        if (await file.exists()) {
            console.log(`[SYSTEM] Installing dependencies from ${reqFile}...`);
            await $`${pipCmd} install -r ${reqPath}`;
        } else {
            console.log(`[SYSTEM] No ${reqFile} found in ${enginePath}, skipping pip install.`);
        }
    } catch (error) {
        console.error(`[ERROR] Failed to setup environment for ${enginePath}:`, error);
    }
}

// Setup environments for internal engines that require isolated python dependencies
await setupPythonEnv("TextEngine");
await setupPythonEnv("VisualEngine");
await setupPythonEnv("SoundEngine");
await setupPythonEnv("VoiceEngine");

console.log("\n[SYSTEM] MediaHub Bootstrap Complete! All engines are primed.");
