// The browser and the owner-auth function must apply the same rules. This test fails
// if the two copies of rules.js differ, so a change can only land in both.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

test("web/src/owner-rules.js is an exact copy of the function's rules.js", () => {
  const server = readFileSync(path.join(here, "../../supabase/functions/owner-auth/rules.js"), "utf8");
  const browser = readFileSync(path.join(here, "../src/owner-rules.js"), "utf8");
  assert.equal(browser, server, "copy supabase/functions/owner-auth/rules.js to web/src/owner-rules.js");
});
