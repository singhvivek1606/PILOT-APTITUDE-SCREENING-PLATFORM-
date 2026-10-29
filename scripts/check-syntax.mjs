// Cross-platform `node --check` over the Electron main process and renderer scripts.
import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const files = [
  "electron/main.cjs",
  ...readdirSync("js").filter((f) => f.endsWith(".js")).map((f) => "js/" + f),
];

let failed = false;
for (const file of files) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
  } catch {
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`Syntax OK (${files.length} files)`);
