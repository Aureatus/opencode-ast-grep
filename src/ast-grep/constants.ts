import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { getCachedBinaryPath } from "./downloader";

const requireFromHere = createRequire(import.meta.url);

const MIN_BINARY_SIZE_BYTES = 10_000;
const BYTES_PER_KIB = 1024;
const BYTES_PER_MIB = BYTES_PER_KIB * BYTES_PER_KIB;

const isValidBinary = (filePath: string): boolean => {
  try {
    return statSync(filePath).size > MIN_BINARY_SIZE_BYTES;
  } catch {
    return false;
  }
};

const getPlatformPackageName = (): string | null => {
  const platform = process.platform;
  const arch = process.arch;

  const platformMap: Record<string, string> = {
    "darwin-arm64": "@ast-grep/cli-darwin-arm64",
    "darwin-x64": "@ast-grep/cli-darwin-x64",
    "linux-arm64": "@ast-grep/cli-linux-arm64-gnu",
    "linux-x64": "@ast-grep/cli-linux-x64-gnu",
    "win32-x64": "@ast-grep/cli-win32-x64-msvc",
    "win32-arm64": "@ast-grep/cli-win32-arm64-msvc",
    "win32-ia32": "@ast-grep/cli-win32-ia32-msvc",
  };

  return platformMap[`${platform}-${arch}`] ?? null;
};

const resolveFromCache = (): string | null => {
  const cachedPath = getCachedBinaryPath();
  if (cachedPath && isValidBinary(cachedPath)) {
    return cachedPath;
  }

  return null;
};

const resolveFromCliPackage = (): string | null => {
  try {
    const cliPkgPath = requireFromHere.resolve("@ast-grep/cli/package.json");
    const cliDir = dirname(cliPkgPath);
    const binaryName = process.platform === "win32" ? "sg.exe" : "sg";
    const sgPath = join(cliDir, binaryName);

    if (existsSync(sgPath) && isValidBinary(sgPath)) {
      return sgPath;
    }
  } catch {
    /* @ast-grep/cli not installed */
  }

  return null;
};

const resolveFromPlatformPackage = (): string | null => {
  const platformPkg = getPlatformPackageName();
  if (!platformPkg) {
    return null;
  }

  try {
    const pkgPath = requireFromHere.resolve(`${platformPkg}/package.json`);
    const pkgDir = dirname(pkgPath);
    const astGrepName =
      process.platform === "win32" ? "ast-grep.exe" : "ast-grep";
    const binaryPath = join(pkgDir, astGrepName);

    if (existsSync(binaryPath) && isValidBinary(binaryPath)) {
      return binaryPath;
    }
  } catch {
    /* platform-specific package not installed */
  }

  return null;
};

const resolveFromHomebrew = (): string | null => {
  if (process.platform !== "darwin") {
    return null;
  }

  const homebrewPaths = ["/opt/homebrew/bin/sg", "/usr/local/bin/sg"];
  for (const path of homebrewPaths) {
    if (existsSync(path) && isValidBinary(path)) {
      return path;
    }
  }

  return null;
};

export const findSgCliPathSync = (): string | null => {
  const fromCache = resolveFromCache();
  if (fromCache) {
    return fromCache;
  }

  const fromCliPackage = resolveFromCliPackage();
  if (fromCliPackage) {
    return fromCliPackage;
  }

  const fromPlatformPackage = resolveFromPlatformPackage();
  if (fromPlatformPackage) {
    return fromPlatformPackage;
  }

  const fromHomebrew = resolveFromHomebrew();
  if (fromHomebrew) {
    return fromHomebrew;
  }

  return null;
};

let resolvedCliPath: string | null = null;

export const getSgCliPath = (): string => {
  if (resolvedCliPath !== null) {
    return resolvedCliPath;
  }

  const syncPath = findSgCliPathSync();
  if (syncPath) {
    resolvedCliPath = syncPath;
    return syncPath;
  }

  return "sg";
};

export const setSgCliPath = (path: string): void => {
  resolvedCliPath = path;
};

export const SG_CLI_PATH = getSgCliPath();

export const CLI_LANGUAGES = [
  "bash",
  "c",
  "cpp",
  "csharp",
  "css",
  "elixir",
  "go",
  "haskell",
  "html",
  "java",
  "javascript",
  "json",
  "kotlin",
  "lua",
  "nix",
  "php",
  "python",
  "ruby",
  "rust",
  "scala",
  "solidity",
  "swift",
  "typescript",
  "tsx",
  "yaml",
] as const;

export const NAPI_LANGUAGES = [
  "html",
  "javascript",
  "tsx",
  "css",
  "typescript",
] as const;

export const DEFAULT_TIMEOUT_MS = 300_000;
export const DEFAULT_MAX_OUTPUT_BYTES = BYTES_PER_MIB;
export const DEFAULT_MAX_MATCHES = 500;

export const LANG_EXTENSIONS: Record<string, string[]> = {
  bash: [".bash", ".sh", ".zsh", ".bats"],
  c: [".c", ".h"],
  cpp: [".cpp", ".cc", ".cxx", ".hpp", ".hxx", ".h"],
  csharp: [".cs"],
  css: [".css"],
  elixir: [".ex", ".exs"],
  go: [".go"],
  haskell: [".hs", ".lhs"],
  html: [".html", ".htm"],
  java: [".java"],
  javascript: [".js", ".jsx", ".mjs", ".cjs"],
  json: [".json"],
  kotlin: [".kt", ".kts"],
  lua: [".lua"],
  nix: [".nix"],
  php: [".php"],
  python: [".py", ".pyi"],
  ruby: [".rb", ".rake"],
  rust: [".rs"],
  scala: [".scala", ".sc"],
  solidity: [".sol"],
  swift: [".swift"],
  typescript: [".ts", ".cts", ".mts"],
  tsx: [".tsx"],
  yaml: [".yml", ".yaml"],
};

export interface EnvironmentCheckResult {
  cli: {
    available: boolean;
    path: string;
    error?: string;
  };
  napi: {
    available: boolean;
    error?: string;
  };
}

export const checkEnvironment = (): EnvironmentCheckResult => {
  const cliPath = getSgCliPath();

  const result: EnvironmentCheckResult = {
    cli: {
      available: false,
      path: cliPath,
    },
    napi: {
      available: false,
    },
  };

  if (existsSync(cliPath)) {
    result.cli.available = true;
  } else if (cliPath === "sg") {
    try {
      const whichResult = spawnSync(
        process.platform === "win32" ? "where" : "which",
        ["sg"],
        {
          encoding: "utf8",
          timeout: 5000,
        }
      );
      result.cli.available =
        whichResult.status === 0 && Boolean(whichResult.stdout?.trim());
      if (!result.cli.available) {
        result.cli.error = "sg binary not found in PATH";
      }
    } catch {
      result.cli.error = "Failed to check sg availability";
    }
  } else {
    result.cli.error = `Binary not found: ${cliPath}`;
  }

  try {
    requireFromHere("@ast-grep/napi");
    result.napi.available = true;
  } catch (error) {
    result.napi.available = false;
    const err = error as Error;
    result.napi.error = `@ast-grep/napi not installed: ${err.message}`;
  }

  return result;
};

export const formatEnvironmentCheck = (
  result: EnvironmentCheckResult
): string => {
  const lines: string[] = ["ast-grep Environment Status:", ""];

  if (result.cli.available) {
    lines.push(`CLI: Available (${result.cli.path})`);
  } else {
    lines.push("CLI: Not available");
    if (result.cli.error) {
      lines.push(`  Error: ${result.cli.error}`);
    }
    lines.push("  Install: bun add -D @ast-grep/cli");
  }

  if (result.napi.available) {
    lines.push("NAPI: Available");
  } else {
    lines.push("NAPI: Not available");
    if (result.napi.error) {
      lines.push(`  Error: ${result.napi.error}`);
    }
    lines.push("  Install: bun add -D @ast-grep/napi");
  }

  lines.push("");
  lines.push(`CLI supports ${CLI_LANGUAGES.length} languages`);
  lines.push(
    `NAPI supports ${NAPI_LANGUAGES.length} languages: ${NAPI_LANGUAGES.join(", ")}`
  );

  return lines.join("\n");
};
