import { Elysia, t } from "elysia";
import { PythonRunner } from "../services/PythonRunner";

export const wsRoutes = new Elysia()
  .ws("/ws/pipeline", {
    body: t.Object({
      action: t.String(),
      config: t.Optional(t.Any())
    }),
    open(ws) {
      ws.send(JSON.stringify({ type: "CONNECTION", payload: "Connected to Nexus Orchestrator WS" }));
    },
    message(ws, message) {
      if (message.action === "START_YOUTUBE_ENGINE") {
        ws.send(JSON.stringify({ type: "STATUS", payload: "Starting Engine..." }));
        
        // Start the background python process and bind stdout to this WS connection
        PythonRunner.runEngineStream(
          message.config || { duration: 5, dialogueRatio: 30, rating: "Teen", localization: "Neutro", voice: "pt-BR-AntonioNeural", theme: "", isZeroShot: false },
          (logMsg) => {
            ws.send(JSON.stringify({ type: "LOG", payload: logMsg }));
          },
          (code) => {
            ws.send(JSON.stringify({ type: "STATUS", payload: `Process exited with code ${code}` }));
          }
        );
      }
    }
  });
