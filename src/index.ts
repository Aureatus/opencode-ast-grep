import { Plugin } from "@opencode/plugin";

import { startBackgroundInit } from "./ast-grep/cli";
import { astGrepReplace, astGrepSearch } from "./ast-grep/tools";

export default Plugin.define({
  id: "opencode-ast-grep",
  async setup(ctx) {
    startBackgroundInit();

    await ctx.tool.transform((editor) => {
      editor.add(astGrepSearch);
      editor.add(astGrepReplace);
    });
  },
});
