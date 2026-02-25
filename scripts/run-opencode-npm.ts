import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const SANDBOX_DIRECTORY = path.join(
  os.homedir(),
  ".cache",
  "opencode-ast-grep",
  "npm-plugin-sandbox"
);

const CONFIG_CONTENT = JSON.stringify({
  plugin: ["opencode-ast-grep"],
  permission: {
    external_directory: {
      "~/.cache/opencode/plugins/ast-grep/**": "allow",
    },
  },
});

async function main(): Promise<void> {
  await mkdir(SANDBOX_DIRECTORY, { recursive: true });

  const forwardedArgs = process.argv.slice(2);
  const args = forwardedArgs.length > 0 ? forwardedArgs : [SANDBOX_DIRECTORY];

  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn("opencode", args, {
      cwd: SANDBOX_DIRECTORY,
      env: {
        ...process.env,
        OPENCODE_CONFIG_CONTENT: CONFIG_CONTENT,
      },
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });

  process.exit(exitCode);
}

await main();
