import { existsSync } from "node:fs";
import { spawn } from "bun";
import {
  DEFAULT_MAX_MATCHES,
  DEFAULT_MAX_OUTPUT_BYTES,
  DEFAULT_TIMEOUT_MS,
  findSgCliPathSync,
  getSgCliPath,
  setSgCliPath,
} from "./constants";
import { ensureAstGrepBinary } from "./downloader";
import type { CliLanguage, CliMatch, SgResult } from "./types";

export interface RunOptions {
  pattern: string;
  lang: CliLanguage;
  paths?: string[];
  globs?: string[];
  rewrite?: string;
  context?: number;
  updateAll?: boolean;
}

let resolvedCliPath: string | null = null;
let initPromise: Promise<string | null> | null = null;

export const getAstGrepPath = async (): Promise<string | null> => {
  if (resolvedCliPath !== null && existsSync(resolvedCliPath)) {
    return resolvedCliPath;
  }

  if (initPromise) {
    return await initPromise;
  }

  initPromise = (async () => {
    const syncPath = findSgCliPathSync();
    if (syncPath && existsSync(syncPath)) {
      resolvedCliPath = syncPath;
      setSgCliPath(syncPath);
      return syncPath;
    }

    const downloadedPath = await ensureAstGrepBinary();
    if (downloadedPath) {
      resolvedCliPath = downloadedPath;
      setSgCliPath(downloadedPath);
      return downloadedPath;
    }

    return null;
  })();

  return await initPromise;
};

export const startBackgroundInit = (): void => {
  if (!initPromise) {
    initPromise = getAstGrepPath();
    initPromise.catch(() => {
      // ignore
    });
  }
};

const buildRunArgs = (options: RunOptions): string[] => {
  const args = [
    "run",
    "-p",
    options.pattern,
    "--lang",
    options.lang,
    "--json=compact",
  ];

  if (options.rewrite) {
    args.push("-r", options.rewrite);
    if (options.updateAll) {
      args.push("--update-all");
    }
  }

  if (options.context && options.context > 0) {
    args.push("-C", String(options.context));
  }

  if (options.globs) {
    for (const glob of options.globs) {
      args.push("--globs", glob);
    }
  }

  const paths =
    options.paths && options.paths.length > 0 ? options.paths : ["."];
  args.push(...paths);

  return args;
};

interface SpawnOutputs {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

const runWithTimeout = async (
  cliPath: string,
  args: string[]
): Promise<SpawnOutputs> => {
  const proc = spawn([cliPath, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  let timedOut = false;

  const timeoutId = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, DEFAULT_TIMEOUT_MS);

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  clearTimeout(timeoutId);

  return { stdout, stderr, exitCode, timedOut };
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: CLI wrapper needs explicit branch handling for robust tool output
export const runSg = async (options: RunOptions): Promise<SgResult> => {
  const args = buildRunArgs(options);

  let cliPath = getSgCliPath();
  if (!existsSync(cliPath) || cliPath === "sg") {
    const resolvedPath = await getAstGrepPath();
    if (resolvedPath) {
      cliPath = resolvedPath;
    }
  }

  let outputs: SpawnOutputs;
  try {
    outputs = await runWithTimeout(cliPath, args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      matches: [],
      totalMatches: 0,
      truncated: false,
      error: `Failed to run ast-grep: ${message}`,
    };
  }

  const { stdout, stderr, exitCode, timedOut } = outputs;

  if (timedOut) {
    return {
      matches: [],
      totalMatches: 0,
      truncated: true,
      truncatedReason: "timeout",
      error: `Search timeout after ${DEFAULT_TIMEOUT_MS}ms`,
    };
  }

  if (exitCode !== 0 && stdout.trim() === "") {
    if (stderr.includes("No files found")) {
      return { matches: [], totalMatches: 0, truncated: false };
    }

    if (stderr.trim()) {
      return {
        matches: [],
        totalMatches: 0,
        truncated: false,
        error: stderr.trim(),
      };
    }

    return { matches: [], totalMatches: 0, truncated: false };
  }

  if (!stdout.trim()) {
    return { matches: [], totalMatches: 0, truncated: false };
  }

  const outputTruncated = stdout.length >= DEFAULT_MAX_OUTPUT_BYTES;
  const jsonText = outputTruncated
    ? stdout.substring(0, DEFAULT_MAX_OUTPUT_BYTES)
    : stdout;

  let rawMatches: CliMatch[];

  try {
    rawMatches = JSON.parse(jsonText) as CliMatch[];
  } catch {
    const result: SgResult = {
      matches: [],
      totalMatches: 0,
      truncated: outputTruncated,
    };

    if (outputTruncated) {
      result.truncatedReason = "max_output_bytes";
      result.error = "Output too large and could not be parsed";
    }

    return result;
  }

  const totalMatches = rawMatches.length;
  const matchesTruncated = totalMatches > DEFAULT_MAX_MATCHES;
  const matches = matchesTruncated
    ? rawMatches.slice(0, DEFAULT_MAX_MATCHES)
    : rawMatches;

  let truncatedReason: SgResult["truncatedReason"];
  if (outputTruncated) {
    truncatedReason = "max_output_bytes";
  } else if (matchesTruncated) {
    truncatedReason = "max_matches";
  } else {
    truncatedReason = undefined;
  }

  return {
    matches,
    totalMatches,
    truncated: outputTruncated || matchesTruncated,
    truncatedReason,
  };
};

export const isCliAvailable = (): boolean => {
  const path = findSgCliPathSync();
  return path !== null && existsSync(path);
};

export const ensureCliAvailable = async (): Promise<boolean> => {
  const path = await getAstGrepPath();
  return path !== null && existsSync(path);
};
