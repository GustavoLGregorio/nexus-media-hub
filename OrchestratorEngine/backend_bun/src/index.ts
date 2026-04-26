import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { apiRoutes } from "./routes/api";
import { wsRoutes } from "./routes/ws";

const app = new Elysia()
  .use(cors())
  .use(apiRoutes)
  .use(wsRoutes)
  .listen(8000);

console.log(`🦊 Nexus Orchestrator is running at ${app.server?.hostname}:${app.server?.port}`);
