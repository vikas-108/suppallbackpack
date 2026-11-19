import app from "./app.js";
import { assertRuntimeConfig, env } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { attachRealtimeServer } from "./services/realtimeService.js";
import { startInactiveAccountCleanup } from "./services/inactiveAccountCleanupService.js";

let server;
let closeRealtime;
let stopInactiveAccountCleanup;
let shuttingDown = false;

async function start() {
  try {
    assertRuntimeConfig();
  } catch (error) {
    console.error("Backend runtime configuration is invalid.", {
      message: error?.message || "Check the required environment variables."
    });
    process.exitCode = 1;
    return;
  }
  await connectDatabase(env.mongoUri);
  app.locals.databaseReady = true;
  stopInactiveAccountCleanup = startInactiveAccountCleanup();
  server = app.listen(env.port, () => {
    console.info(`BuildSupply API listening on port ${env.port}.`);
  });
  closeRealtime = attachRealtimeServer(server);
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`Received ${signal}; closing the API server.`);
  if (stopInactiveAccountCleanup) await stopInactiveAccountCleanup();
  if (closeRealtime) await closeRealtime();
  if (server) {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
  app.locals.databaseReady = false;
  await disconnectDatabase();
  process.exit(0);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

start().catch(error => {
  console.error("Backend startup failed. Check required environment variables and MongoDB Atlas network access.", {
    errorName: error?.name || "Error",
    errorCode: error?.code || "STARTUP_FAILED"
  });
  process.exitCode = 1;
});
