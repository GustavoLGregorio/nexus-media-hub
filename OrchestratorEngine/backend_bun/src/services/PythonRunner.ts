import { $, Subprocess } from "bun";
import { join } from "path";

export class PythonRunner {
  private static BASE_DIR = join(import.meta.dir, "../../../../");
  private static YT_DIR = join(this.BASE_DIR, "StoryEngine", "YouTube_Stories");

  /**
   * Spawns the story generator and streams its stdout/stderr to the provided WebSocket callback.
   */
  public static async runEngineStream(
    config: { projectName: string; duration: number; dialogueRatio: number; rating: string; localization: string; voice: string; theme: string; isZeroShot: boolean },
    onLog: (msg: string) => void,
    onClose: (code: number | null) => void
  ) {
    const scriptPath = join(this.BASE_DIR, "master_pipeline.py");
    const safeName = config.projectName.replace(/ /g, "_");
    const projectConfigPath = join(this.BASE_DIR, "ProjectVault", safeName, "project_config.json");
    
    // Generate UUID for isolation
    const runId = crypto.randomUUID().split('-')[0];
    const outputDir = join(this.BASE_DIR, "ProjectVault", safeName, "generations", `${safeName}_${runId}`);
    
    onLog(`[FastAPI -> Bun] Firing Master Pipeline: ${scriptPath} for ${config.projectName} (Run ID: ${runId})`);

    try {
      const args = [
        "python", "-u", scriptPath, 
        "--config", projectConfigPath,
        "--output_dir", outputDir,
        "--run_id", runId,
        "--duration", String(config.duration), 
        "--dialogue_ratio", String(config.dialogueRatio), 
        "--rating", config.rating, 
        "--localization", config.localization, 
        "--voice", config.voice, 
      ];
      if (config.theme) {
        args.push("--theme", config.theme);
      }
      if (config.isZeroShot) {
        args.push("--zero_shot");
      }

      const proc = Bun.spawn(args, {
        cwd: this.BASE_DIR,
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
        stdout: "pipe",
        stderr: "pipe"
      });

      // Stream stdout
      if (proc.stdout) {
        const stdoutStream = proc.stdout.getReader();
        const decoder = new TextDecoder("utf-8");
        
        const readStdout = async () => {
          while (true) {
            const { done, value } = await stdoutStream.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split(/\r?\n|\r/);
            for (let line of lines) {
              line = line.trim();
              if (!line) continue;

              // Handle TQDM filtering
              const tqdmMatch = line.match(/(\d+)%\|.*\|/);
              if (tqdmMatch) {
                onLog(`[QWEN3 MOTOR] ${tqdmMatch[1]}% Renderizado...`);
                continue;
              }
              if (line.includes('\x1b[') || (line.includes('|') && line.includes('%'))) {
                continue;
              }

              onLog(line);
            }
          }
        };
        readStdout().catch(console.error);
      }

      // Stream stderr
      if (proc.stderr) {
        const stderrStream = proc.stderr.getReader();
        const decoder = new TextDecoder("utf-8");
        const readStderr = async () => {
          while (true) {
            const { done, value } = await stderrStream.read();
            if (done) break;
            const chunk = decoder.decode(value);
            onLog(`[STDERR]: ${chunk}`);
          }
        };
        readStderr().catch(console.error);
      }

      const exitCode = await proc.exited;
      if (exitCode === 0) {
        onLog("[PIPELINE_COMPLETE]");
      } else {
        onLog("[ERROR] Pipeline failed fatally.");
      }
      onClose(exitCode);

    } catch (e) {
      onLog(`[BUN ERROR] Failed to spawn process: ${e}`);
      onClose(-1);
    }
  }
}
