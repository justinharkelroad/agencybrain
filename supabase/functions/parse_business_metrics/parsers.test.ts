import {
  asString,
  parseAgent,
  parseInteger,
  parseMoneyCents,
  parsePercentDecimal,
  safeAddress,
} from "./parsers.ts";

function assertEquals<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`Assertion failed.\nExpected: ${String(expected)}\nActual: ${String(actual)}`);
  }
}

Deno.test("parseMoneyCents handles currency strings and negatives", () => {
  assertEquals(parseMoneyCents("$1,234.56"), 123456);
  assertEquals(parseMoneyCents("($1,234.56)"), -123456);
  assertEquals(parseMoneyCents("--"), null);
});

Deno.test("parsePercentDecimal normalizes numeric and percent strings", () => {
  assertEquals(parsePercentDecimal("55.2%"), 0.552);
  assertEquals(parsePercentDecimal("(4.5%)"), -0.045);
  assertEquals(parsePercentDecimal(55.2), 0.552);
  assertEquals(parsePercentDecimal(0.552), 0.552);
});

Deno.test("parseInteger handles commas and accounting negatives", () => {
  assertEquals(parseInteger("1,204"), 1204);
  assertEquals(parseInteger("(302)"), -302);
  assertEquals(parseInteger("N/A"), null);
});

Deno.test("parseAgent parses standard code-name strings", () => {
  const parsed = parseAgent("12345 - Jane Doe");
  assertEquals(parsed.agentCode, "12345");
  assertEquals(parsed.agentName, "Jane Doe");
});

Deno.test("safeAddress and asString handle null/blank cases", () => {
  assertEquals(safeAddress("B", 12), "B12");
  assertEquals(safeAddress("", 12), null);
  assertEquals(asString("  hi "), "hi");
  assertEquals(asString("  "), null);
});
