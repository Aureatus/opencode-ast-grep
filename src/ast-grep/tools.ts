import { runSg } from "./cli";
import { CLI_LANGUAGES } from "./constants";
import type { CliLanguage } from "./types";
import { formatReplaceResult, formatSearchResult } from "./utils";

const FUNCTION_PATTERN_HINT_REGEX =
  /^(export\s+)?(async\s+)?function\s+\$[A-Z_]+\s*$/iu;

const showOutputToUser = (context: unknown, output: string): void => {
  const ctx = context as {
    metadata?: (input: { metadata: { output: string } }) => void;
  };
  ctx.metadata?.({ metadata: { output } });
};

const getEmptyResultHint = (
  pattern: string,
  lang: CliLanguage
): string | null => {
  const src = pattern.trim();

  if (lang === "python") {
    if (src.startsWith("class ") && src.endsWith(":")) {
      const withoutColon = src.slice(0, -1);
      return `\n\nHint: Remove trailing colon. Try: "${withoutColon}"`;
    }
    if (
      (src.startsWith("def ") || src.startsWith("async def ")) &&
      src.endsWith(":")
    ) {
      const withoutColon = src.slice(0, -1);
      return `\n\nHint: Remove trailing colon. Try: "${withoutColon}"`;
    }
  }

  if (
    ["javascript", "typescript", "tsx"].includes(lang) &&
    FUNCTION_PATTERN_HINT_REGEX.test(src)
  ) {
    return '\n\nHint: Function patterns need params and body. Try "function $NAME($$$) { $$$ }"';
  }

  return null;
};

const asText = (output: string) => ({ content: output });

export const astGrepSearch = {
  name: "ast_grep_search",
  description:
    "Search code patterns across filesystem using AST-aware matching. Supports 25 languages. " +
    "Use meta-variables: $VAR (single node), $$$ (multiple nodes). " +
    "Patterns must be complete AST nodes (valid code). " +
    "For functions, include params and body: 'export async function $NAME($$$) { $$$ }' not 'export async function $NAME'.",
  input: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description:
          "AST pattern with meta-variables ($VAR, $$$). Must be a complete AST node.",
      },
      lang: {
        type: "string",
        enum: [...CLI_LANGUAGES],
        description: "Target language",
      },
      paths: {
        type: "array",
        items: { type: "string" },
        description: "Paths to search (default: ['.'])",
      },
      globs: {
        type: "array",
        items: { type: "string" },
        description: "Include/exclude globs (prefix ! to exclude)",
      },
      context: {
        type: "number",
        description: "Context lines around match",
      },
    },
    required: ["pattern", "lang"],
    additionalProperties: false,
  },
  execute: async (input: unknown, context: unknown) => {
    const args = input as {
      pattern: string;
      lang: CliLanguage;
      paths?: string[];
      globs?: string[];
      context?: number;
    };
    try {
      const result = await runSg({
        pattern: args.pattern,
        lang: args.lang,
        paths: args.paths,
        globs: args.globs,
        context: args.context,
      });

      let output = formatSearchResult(result);

      if (result.matches.length === 0 && !result.error) {
        const hint = getEmptyResultHint(args.pattern, args.lang);
        if (hint) {
          output += hint;
        }
      }

      showOutputToUser(context, output);
      return asText(output);
    } catch (error) {
      const output = `Error: ${error instanceof Error ? error.message : String(error)}`;
      showOutputToUser(context, output);
      return asText(output);
    }
  },
};

export const astGrepReplace = {
  name: "ast_grep_replace",
  description:
    "Replace code patterns across filesystem with AST-aware rewriting. " +
    "Dry-run by default. Use meta-variables in rewrite to preserve matched content. " +
    "Example: pattern='console.log($MSG)' rewrite='logger.info($MSG)'.",
  input: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "AST pattern to match",
      },
      rewrite: {
        type: "string",
        description: "Replacement pattern (can use $VAR from pattern)",
      },
      lang: {
        type: "string",
        enum: [...CLI_LANGUAGES],
        description: "Target language",
      },
      paths: {
        type: "array",
        items: { type: "string" },
        description: "Paths to search",
      },
      globs: {
        type: "array",
        items: { type: "string" },
        description: "Include/exclude globs",
      },
      dryRun: {
        type: "boolean",
        description: "Preview changes without applying (default: true)",
      },
    },
    required: ["pattern", "rewrite", "lang"],
    additionalProperties: false,
  },
  execute: async (input: unknown, context: unknown) => {
    const args = input as {
      pattern: string;
      rewrite: string;
      lang: CliLanguage;
      paths?: string[];
      globs?: string[];
      dryRun?: boolean;
    };
    try {
      const result = await runSg({
        pattern: args.pattern,
        rewrite: args.rewrite,
        lang: args.lang,
        paths: args.paths,
        globs: args.globs,
        updateAll: args.dryRun === false,
      });
      const output = formatReplaceResult(result, args.dryRun !== false);
      showOutputToUser(context, output);
      return asText(output);
    } catch (error) {
      const output = `Error: ${error instanceof Error ? error.message : String(error)}`;
      showOutputToUser(context, output);
      return asText(output);
    }
  },
};


