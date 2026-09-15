const { spawn } = require("child_process");
const path = require("path");

const services = [
    { name: "Detail Stock", cwd: path.join(__dirname, "detailStock"), script: "server.js", },
    { name: "Holding", cwd: path.join(__dirname, "holding"), script: "server.js", },
    { name: "Stocks", cwd: path.join(__dirname, "stocks"), script: "server.js", },
    { name: "Watchlist", cwd: path.join(__dirname, "watchlist"), script: "app.js", },
    { name: "Orders", cwd: path.join(__dirname, "orders"), script: "app.js", },
    { name: "Index Market", cwd: path.join(__dirname, "indexMarket"), script: "server.js", },
    { name: "Mutual Funds", cwd: path.join(__dirname, "mutualfunds"), script: "server.js", },
    { name: "Signup", cwd: path.join(__dirname, "signup"), script: "app.js", }
];

const processes = [];

function startService(service) {
    console.log(`\nStarting ${service.name}...`);

    const child = spawn(process.execPath, [service.script], {
        cwd: service.cwd,
        stdio: ["inherit", "pipe", "pipe"],
        shell: false,
    });

    child.stdout.on("data", (data) => { process.stdout.write(`[${service.name}] ${data}`); });

    child.stderr.on("data", (data) => { process.stderr.write(`[${service.name}] ${data}`); });

    child.on("error", (error) => { console.error(`[${service.name}] Failed to start:`, error.message); });

    child.on("exit", (code, signal) => {
        console.log(`[${service.name}] stopped`, {
            code,
            signal,
        });
    });

    processes.push({ name: service.name, process: child, });
}

for (const service of services) {
    startService(service);
}

console.log("\n========================================");
console.log("All backend services started.");
console.log("Press Ctrl+C to stop all services.");
console.log("========================================\n");

function shutdown(signal) {
    console.log(`\nReceived ${signal}. Stopping services...`);

    for (const item of processes) {
        if (!item.process.killed) {
            item.process.kill("SIGINT");
        }
    }

    setTimeout(() => {
        for (const item of processes) {
            if (!item.process.killed) {
                item.process.kill("SIGTERM");
            }
        }

        process.exit(0);
    }, 2000);
}

process.on("SIGINT", () => {
    shutdown("SIGINT");
});

process.on("SIGTERM", () => {
    shutdown("SIGTERM");
});
