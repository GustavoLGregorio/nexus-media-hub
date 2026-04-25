import { $ } from "bun";
import { mkdir } from "fs/promises";
import { join } from "path";
import { platform } from "os";
import chalk from "chalk";

const osType = platform();
const isWindows = osType === "win32";

console.log(chalk.cyan.bold(`\n[SYSTEM] Starting Bootstrap Installation for MediaHub on ${osType}...\n`));

// 1. Initialize Submodules
console.log(chalk.blueBright("[1/3] Initializing and updating git submodules..."));
try {
    await $`git submodule update --init --recursive`.quiet();
    console.log(chalk.green("  ✓ Submodules ready (ComfyUI, ACE-Step)."));
} catch (e) {
    console.error(chalk.red("  ✗ Failed to init submodules."), e);
}

// 2. Ensure vital directories exist
const dirsToEnsure = [
    "TextEngine/llama.cpp", // Ensure base dir exists for extraction
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
    } catch (e) {
        // Ignore if already exists
    }
}
console.log(chalk.green("  ✓ Directory scaffolding complete."));

// 3. Download LLaMA.cpp Pre-Compiled if missing
const llamaPath = join("TextEngine", "llama.cpp");
const llamaServerExe = join(llamaPath, isWindows ? "llama-server.exe" : "llama-server");

const fileExists = async (path: string) => {
    const file = Bun.file(path);
    return await file.exists();
};

if (!(await fileExists(llamaServerExe))) {
    console.log(chalk.yellowBright(`\n[SYSTEM] LLaMA.cpp binary not found. Downloading pre-compiled release...`));
    
    // Fallback direct URL for the pre-compiled CUDA 12 binaries 
    // Uses Windows cu122 by default or generic ubuntu binary for Linux
    const downloadUrl = isWindows 
        ? "https://github.com/ggerganov/llama.cpp/releases/download/b4120/llama-b4120-bin-win-cu1220-x64.zip"
        : "https://github.com/ggerganov/llama.cpp/releases/download/b4120/llama-b4120-bin-ubuntu-x64.zip"; 
    
    const zipPath = join(llamaPath, "llama.zip");
    
    try {
        console.log(chalk.dim(`  Downloading from: ${downloadUrl}`));
        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        await Bun.write(zipPath, response);
        
        console.log(chalk.dim(`  Extracting binary...`));
        if (isWindows) {
            await $`tar -xf ${zipPath} -C ${llamaPath}`.quiet();
        } else {
            await $`unzip -o ${zipPath} -d ${llamaPath}`.quiet();
        }
        
        // Cleanup zip
        if (isWindows) {
            await $`del ${zipPath}`.quiet();
        } else {
            await $`rm ${zipPath}`.quiet();
        }
        console.log(chalk.green("  ✓ LLaMA.cpp successfully installed."));
    } catch (error) {
        console.error(chalk.red("  ✗ Failed to download/extract LLaMA.cpp:"), error);
    }
} else {
    console.log(chalk.green("  ✓ LLaMA.cpp binaries already present."));
}

// 4. Install Python dependencies (Virtual Envs) in PARALLEL
console.log(chalk.blueBright("\n[2/3] Setting up Python environments (Parallel Execution)..."));

async function setupPythonEnv(enginePath: string, reqFile: string = "requirements.txt") {
    const venvPath = join(enginePath, ".venv");
    const pipCmd = isWindows ? join(venvPath, "Scripts", "pip.exe") : join(venvPath, "bin", "pip");

    try {
        // Create venv
        await $`python -m venv ${venvPath}`.quiet();
        
        // Install requirements if file exists
        const reqPath = join(enginePath, reqFile);
        if (await fileExists(reqPath)) {
            await $`${pipCmd} install -r ${reqPath}`.quiet();
            console.log(chalk.green(`  ✓ ${enginePath}: Dependencies installed.`));
        } else {
            console.log(chalk.dim(`  - ${enginePath}: No ${reqFile} found, skipped pip install.`));
        }
    } catch (error) {
        console.error(chalk.red(`  ✗ ${enginePath}: Failed to setup environment:`), error);
    }
}

const engines = [
    { path: "TextEngine", req: "requirements.txt" },
    { path: "VisualEngine", req: "requirements.txt" },
    { path: "SoundEngine", req: "requirements.txt" },
    { path: "VoiceEngine", req: "requirements.txt" }
];

// Execute all Python installations simultaneously
await Promise.all(
    engines.map(engine => setupPythonEnv(engine.path, engine.req))
);

console.log(chalk.cyan.bold("\n[3/3] MediaHub Bootstrap Complete! All engines are primed.\n"));
