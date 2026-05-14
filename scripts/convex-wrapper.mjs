import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const argv = process.argv.slice(2);
if (argv.length === 0) {
  process.stderr.write("Usage: node scripts/convex-wrapper.mjs <command> [...args]\n");
  process.exit(1);
}

for (const key of Object.keys(process.env)) {
  const upper = key.toUpperCase();
  if (upper === "VERCEL" || upper.includes("VERCEL") || upper.startsWith("NOW_") || upper === "NOW_BUILDER") {
    delete process.env[key];
    continue;
  }
}

delete process.env.CI;
delete process.env.GITHUB_ACTIONS;

const command = argv[0];
const commandArgs = argv.slice(1);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const binPath =
  process.platform === "win32"
    ? join(__dirname, "..", "node_modules", ".bin", "convex.cmd")
    : join(__dirname, "..", "node_modules", ".bin", "convex");

const cwd = join(__dirname, "..");

function quoteWindowsArg(arg) {
  if (arg === "") return '""';
  if (!/[\s"]/g.test(arg)) return arg;
  return `"${arg.replaceAll('"', '""')}"`;
}

let child;
if (process.platform === "win32") {
  const psQuote = (s) => `'${String(s).replaceAll("'", "''")}'`;
  const psCmd = `& ${psQuote(binPath)} ${[command, ...commandArgs].map(psQuote).join(" ")}`;
  child = spawn("powershell.exe", ["-NoProfile", "-Command", psCmd], {
    stdio: "inherit",
    env: process.env,
    cwd,
  });
} else {
  child = spawn(binPath, [command, ...commandArgs], {
    stdio: "inherit",
    env: process.env,
    cwd,
  });
}

child.on("exit", (code) => process.exit(code ?? 1));
