import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

test("calendar page has no unresolved runtime identifiers", () => {
  const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, ".");
  const program = ts.createProgram(parsed.fileNames, { ...parsed.options, incremental: false });
  const missingNames = program.getSemanticDiagnostics().filter(diagnostic =>
    diagnostic.file?.fileName.replaceAll("\\", "/").endsWith("app/page.tsx") &&
    [2304, 2552].includes(diagnostic.code));
  assert.deepEqual(missingNames.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")), []);
});
