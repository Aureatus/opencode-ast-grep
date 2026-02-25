import { expect, test } from "bun:test";

import AstGrepPlugin from "../src/index";

test("exports a plugin factory", () => {
  expect(typeof AstGrepPlugin).toBe("function");
});
