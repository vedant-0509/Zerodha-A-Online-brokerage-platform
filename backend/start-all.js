// const { spawn } = require("child_process");
// const net = require("net");
// const path = require("path");

// const backendRoot = __dirname;

// const services = [
//   { name: "Detail Stock", cwd: "detailStock", script: "server.js", port: 3021, env: { PORT: "3021" } },
//   { name: "Holding", cwd: "holding", script: "server.js", port: 3006, env: { PORT: "3006" } },
//   { name: "Stocks", cwd: "stocks", script: "server.js", port: 3001, env: { PORT: "3001" } },
//   { name: "Watchlist", cwd: "watchlist", script: "app.js", port: 3008, env: { PORT: "3008" } },
//   { name: "Orders", cwd: "orders", script: "app.js", port: 3007, env: { PORT: "3007" } },
//   { name: "Index Market", cwd: "indexMarket", script: "server.js", port: 3020, env: { PORT: "3020" } },
//   { name: "Mutual Funds", cwd: "mutualfunds", script: "server.js", port: 5000, env: { PORT: "5000" } },
//   { name: "Signup", cwd: "signup", script: "app.js", port: 3010, env: { AUTH_PORT: "3010" } },
// ];

// const children = [];
// let gatewayStarted = false;
// let shuttingDown = false;

// function startService(service) {
//   console.log(`[Launcher] Starting ${service.name} on ${service.port}...`);

//   const child = spawn(process.execPath, [service.script], {
//     cwd: path.join(backendRoot, service.cwd),
//     env: { ...process.env, ...service.env },
//     stdio: ["inherit", "pipe", "pipe"],
//     shell: false,
//   });

//   child.stdout.on("data", (data) =>
//     process.stdout.write(`[${service.name}] ${data}`),
//   );

//   child.stderr.on("data", (data) =>
//     process.stderr.write(`[${service.name}] ${data}`),
//   );

//   child.on("error", (error) =>
//     console.error(`[${service.name}] failed:`, error.message),
//   );

//   child.on("exit", (code, signal) => {
//     console.log(`[${service.name}] stopped`, { code, signal });

//     if (!shuttingDown && !gatewayStarted && code !== 0) {
//       console.error(
//         `[Launcher] ${service.name} exited before Central API started.`,
//       );
//     }
//   });

//   children.push({ name: service.name, child });
// }

// function isPortOpen(port, host = process.env.INTERNAL_HOST || "127.0.0.1") {
//   return new Promise((resolve) => {
//     const socket = new net.Socket();
//     let settled = false;

//     const finish = (result) => {
//       if (settled) return;
//       settled = true;
//       socket.destroy();
//       resolve(result);
//     };

//     socket.setTimeout(750);
//     socket.once("connect", () => finish(true));
//     socket.once("timeout", () => finish(false));
//     socket.once("error", () => finish(false));
//     socket.connect(port, host);
//   });
// }

// async function waitForService(service, timeoutMs = 60000) {
//   const startedAt = Date.now();

//   while (!shuttingDown && Date.now() - startedAt < timeoutMs) {
//     if (await isPortOpen(service.port)) {
//       console.log(
//         `[Launcher] ${service.name} is ready on port ${service.port}.`,
//       );
//       return true;
//     }

//     await new Promise((resolve) => setTimeout(resolve, 500));
//   }

//   return false;
// }

// async function startGatewayWhenReady() {
//   console.log("[Launcher] Waiting for internal services before Central API...");

//   const readiness = await Promise.all(
//     services.map(async (service) => ({
//       service,
//       ready: await waitForService(service),
//     })),
//   );

//   if (shuttingDown) return;

//   const failed = readiness.filter((item) => !item.ready);

//   if (failed.length > 0) {
//     console.error(
//       "[Launcher] Central API was not started because these services did not become ready:",
//       failed.map((item) => `${item.service.name}:${item.service.port}`).join(", "),
//     );

//     shutdown("READINESS_TIMEOUT");
//     return;
//   }

//   startGateway();
// }

// function startGateway() {
//   if (gatewayStarted || shuttingDown) return;

//   gatewayStarted = true;

//   console.log("[Launcher] All internal services are ready. Starting Central API...");

//   const gateway = spawn(process.execPath, [path.join(backendRoot, "server.js")], {
//     cwd: backendRoot,
//     env: { ...process.env, PORT: process.env.PORT || "3000" },
//     stdio: ["inherit", "pipe", "pipe"],
//     shell: false,
//   });

//   gateway.stdout.on("data", (data) => process.stdout.write(`[Central API] ${data}`));
//   gateway.stderr.on("data", (data) => process.stderr.write(`[Central API] ${data}`));
//   gateway.on("error", (error) =>
//     console.error("[Central API] failed:", error.message),
//   );
//   gateway.on("exit", (code, signal) => {
//     console.log(`[Central API] stopped`, { code, signal });
//   });

//   children.push({ name: "Central API", child: gateway });
// }

// function shutdown(signal) {
//   if (shuttingDown) return;
//   shuttingDown = true;

//   console.log(`\n[Launcher] Received ${signal}. Stopping all backend processes...`);

//   for (const { child } of children) {
//     if (!child.killed) child.kill("SIGINT");
//   }

//   setTimeout(() => {
//     for (const { child } of children) {
//       if (!child.killed) child.kill("SIGTERM");
//     }
//     process.exit(0);
//   }, 2500).unref();
// }

// process.once("SIGINT", () => shutdown("SIGINT"));
// process.once("SIGTERM", () => shutdown("SIGTERM"));

// console.log("\n========================================");
// console.log("Starting internal services + Central API");
// console.log("Public API: http://localhost:3000");
// console.log("Central API waits for every internal service to bind before starting.");
// console.log("========================================\n");

// for (const service of services) startService(service);
// startGatewayWhenReady().catch((error) => {
//   console.error("[Launcher] Startup orchestration failed:", error);
//   shutdown("STARTUP_ERROR");
// });





























const { spawn } = require("child_process");
const path = require("path");

const backendRoot = __dirname;

// Internal services are deliberately started without blocking the public
// gateway. Render must be able to reach PORT immediately after process start.
const services = [
  { name: "Signup", cwd: "signup", script: "app.js", env: { AUTH_PORT: "3010" } },
  { name: "Stocks", cwd: "stocks", script: "server.js", port: 3001, env: { PORT: "3001" } },
  { name: "Holding", cwd: "holding", script: "server.js", port: 3006, env: { PORT: "3006" } },
  { name: "Orders", cwd: "orders", script: "app.js", port: 3007, env: { PORT: "3007" } },
  { name: "Watchlist", cwd: "watchlist", script: "app.js", port: 3008, env: { PORT: "3008" } },
  { name: "Index Market", cwd: "indexMarket", script: "server.js", port: 3020, env: { PORT: "3020" } },
  { name: "Detail Stock", cwd: "detailStock", script: "server.js", port: 3021, env: { PORT: "3021" } },
  { name: "Mutual Funds", cwd: "mutualfunds", script: "server.js", port: 5000, env: { PORT: "5000" } },
];

const children = [];
let gatewayStarted = false;
let gatewayChild = null;
let shuttingDown = false;

function startService(service) {
  console.log(
    `[Launcher] Starting ${service.name}${service.port ? ` on ${service.port}` : ""}...`,
  );

  const child = spawn(process.execPath, [service.script], {
    cwd: path.join(backendRoot, service.cwd),
    env: { ...process.env, ...service.env },
    stdio: ["inherit", "pipe", "pipe"],
    shell: false,
  });

  child.stdout.on("data", (data) =>
    process.stdout.write(`[${service.name}] ${data}`),
  );

  child.stderr.on("data", (data) =>
    process.stderr.write(`[${service.name}] ${data}`),
  );

  child.on("error", (error) =>
    console.error(`[${service.name}] failed:`, error.message),
  );

  child.on("exit", (code, signal) => {
    console.log(`[${service.name}] stopped`, { code, signal });

    if (!shuttingDown && code !== 0) {
      console.error(
        `[Launcher] ${service.name} exited unexpectedly with code=${code}, signal=${signal}.`,
      );
    }
  });

  children.push({ name: service.name, child });
  return child;
}

function startGateway() {
  if (gatewayStarted || shuttingDown) return;

  gatewayStarted = true;

  const publicPort = process.env.PORT || "3000";

  console.log(
    `[Launcher] Starting Central API immediately on Render PORT ${publicPort}...`,
  );

  gatewayChild = spawn(process.execPath, [path.join(backendRoot, "server.js")], {
    cwd: backendRoot,
    env: { ...process.env, PORT: publicPort },
    stdio: ["inherit", "pipe", "pipe"],
    shell: false,
  });

  gatewayChild.stdout.on("data", (data) =>
    process.stdout.write(`[Central API] ${data}`),
  );

  gatewayChild.stderr.on("data", (data) =>
    process.stderr.write(`[Central API] ${data}`),
  );

  gatewayChild.on("error", (error) => {
    console.error("[Central API] failed:", error.message);
    if (!shuttingDown) shutdown("CENTRAL_API_ERROR");
  });

  gatewayChild.on("exit", (code, signal) => {
    console.log(`[Central API] stopped`, { code, signal });

    // The public process is the Render service. If the gateway exits,
    // terminate the launcher so Render can restart the service cleanly.
    if (!shuttingDown) {
      console.error(
        `[Launcher] Central API exited unexpectedly. Shutting down children so Render can restart the service.`,
      );
      shutdown("CENTRAL_API_EXIT");
    }
  });

  children.push({ name: "Central API", child: gatewayChild });
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(
    `\n[Launcher] Received ${signal}. Stopping all backend processes...`,
  );

  for (const { child } of children) {
    if (!child || child.killed) continue;
    try {
      child.kill("SIGINT");
    } catch (_) {}
  }

  setTimeout(() => {
    for (const { child } of children) {
      if (!child || child.killed) continue;
      try {
        child.kill("SIGTERM");
      } catch (_) {}
    }
    process.exit(0);
  }, 5000).unref();
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

console.log("\n========================================");
console.log("Starting Central API + internal services");
console.log(`Public API: http://localhost:${process.env.PORT || "3000"}`);
console.log("Render readiness: Central API starts immediately; internal services start independently.");
console.log("========================================\n");

// IMPORTANT: Start the public gateway FIRST so Render detects PORT quickly.
startGateway();

// Start internal services independently. They may take longer because of
// MongoDB/Redis/Upstox startup and do not block the public health endpoint.
for (const service of services) {
  startService(service);
}
