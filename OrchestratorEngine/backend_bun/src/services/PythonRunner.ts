import { $, Subprocess } from "bun";
import { join } from "path";

export class PythonRunner {
  private static BASE_DIR = join(import.meta.dir, "../../../../");
  private static YT_DIR = join(this.BASE_DIR, "StoryEngine", "YouTube_Stories");

  /**
   * Spawns the story generator and streams its stdout/stderr to the provided WebSocket callback.
   */
  public static async runEngineStream(
    config: { duration: number; dialogueRatio: number; rating: string; localization: string; voice: string; theme: string; isZeroShot: boolean },
    onLog: (msg: string) => void,
    onClose: (code: number | null) => void
  ) {
    const scriptPath = join(this.YT_DIR, "scripts", "story_engine.py");
    onLog(`[FastAPI -> Bun] Firing Log-Stream Engine: ${scriptPath} for ${config.duration} mins`);

    try {
      const proc = Bun.spawn(["python", "-u", scriptPath, 
        String(config.duration), 
        String(config.dialogueRatio), 
        config.rating, 
        config.localization, 
        config.voice, 
        config.theme, 
        String(config.isZeroShot)
      ], {
        cwd: join(this.YT_DIR, "scripts"),
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

              // Handle TQDM filtering (same logic as the old FastAPI)
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
