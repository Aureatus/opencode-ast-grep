import type { Plugin } from "@opencode-ai/plugin";

import { startBackgroundInit } from "./ast-grep/cli";
import { ast_grep_replace, ast_grep_search } from "./ast-grep/tools";

export const AstGrepPlugin: Plugin = () => {
  startBackgroundInit();

  return Promise.resolve({
    tool: {
      ast_grep_search,
      ast_grep_replace,
    },
  });
};

export default AstGrepPlugin;
