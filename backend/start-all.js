const { spawn } = require("child_process");
const path = require("path");

const backendRoot = __dirname;

const services = [
  { name: "Detail Stock", cwd: "detailStock", script: "server.js", env: { PORT: "3021" } },
  { name: "Holding", cwd: "holding", script: "server.js", env: { PORT: "3006" } },
  { name: "Stocks", cwd: "stocks", script: "server.js", env: { PORT: "3001" } },
  { name: "Watchlist", cwd: "watchlist", script: "app.js", env: { PORT: "3008" } },
  { name: "Orders", cwd: "orders", script: "app.js", env: { PORT: "3007" } },
  { name: "Index Market", cwd: "indexMarket", script: "server.js", env: { PORT: "3020" } },
  { name: "Mutual Funds", cwd: "mutualfunds", script: "server.js", env: { PORT: "5000" } },
  { name: "Signup", cwd: "signup", script: "app.js", env: { AUTH_PORT: "3010" } },
];

const children = [];

function startService(service) {
  console.log(`Starting ${service.name}...`);
  const child = spawn(process.execPath, [service.script], {
    cwd: path.join(backendRoot, service.cwd),
    env: { ...process.env, ...service.env },
    stdio: ["inherit", "pipe", "pipe"],
    shell: false,
  });

  child.stdout.on("data", (data) => process.stdout.write(`[${service.name}] ${data}`));
  child.stderr.on("data", (data) => process.stderr.write(`[${service.name}] ${data}`));
  child.on("error", (error) => console.error(`[${service.name}] failed:`, error.message));
  child.on("exit", (code, signal) => console.log(`[${service.name}] stopped`, { code, signal }));
  children.push({ name: service.name, child });
}

for (const service of services) startService(service);

// Give the internal services a moment to bind before exposing the public API.
setTimeout(() => {
  const gateway = spawn(process.execPath, [path.join(backendRoot, "server.js")], {
    cwd: backendRoot,
    env: { ...process.env, PORT: process.env.PORT || "3000" },
    stdio: ["inherit", "pipe", "pipe"],
    shell: false,
  });

  gateway.stdout.on("data", (data) => process.stdout.write(`[Central API] ${data}`));
  gateway.stderr.on("data", (data) => process.stderr.write(`[Central API] ${data}`));
  gateway.on("exit", (code, signal) => console.log(`[Central API] stopped`, { code, signal }));
  children.push({ name: "Central API", child: gateway });
}, 1500);

function shutdown(signal) {
  console.log(`\nReceived ${signal}. Stopping all backend processes...`);
  for (const { child } of children) {
    if (!child.killed) child.kill("SIGINT");
  }
  setTimeout(() => {
    for (const { child } of children) {
      if (!child.killed) child.kill("SIGTERM");
    }
    process.exit(0);
  }, 2500).unref();
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

console.log("\n========================================");
console.log("Starting internal services + Central API");
console.log("Public API: http://localhost:3000");
console.log("Internal services bind to 127.0.0.1 only.");
console.log("========================================\n");
