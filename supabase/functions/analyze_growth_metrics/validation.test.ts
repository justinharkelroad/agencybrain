import {
  MAX_CUSTOM_QUESTION_LENGTH,
  normalizeAndValidateAnalyzeInput,
  validateSelectedReportsAreParsed,
} from "./validation.ts";

function assertEquals<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`Assertion failed.\nExpected: ${String(expected)}\nActual: ${String(actual)}`);
  }
}

Deno.test("normalizeAndValidateAnalyzeInput rejects invalid analysis_type", () => {
  const result = normalizeAndValidateAnalyzeInput({
    agency_id: "agency-1",
    report_ids: ["r-1"],
    analysis_type: "weekly" as "monthly",
  });

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(
      result.error,
      "analysis_type must be one of: monthly, quarterly, custom."
    );
  }
});

Deno.test("normalizeAndValidateAnalyzeInput rejects oversized custom_question", () => {
  const result = normalizeAndValidateAnalyzeInput({
    agency_id: "agency-1",
    report_ids: ["r-1"],
    analysis_type: "monthly",
    custom_question: "a".repeat(MAX_CUSTOM_QUESTION_LENGTH + 1),
  });

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(
      result.error,
      `custom_question exceeds ${MAX_CUSTOM_QUESTION_LENGTH} characters.`
    );
  }
});

Deno.test("validateSelectedReportsAreParsed rejects mixed parsed/unparsed selections", () => {
  const error = validateSelectedReportsAreParsed(
    ["r-1", "r-2"],
    [
      { id: "r-1", parse_status: "parsed" },
      { id: "r-2", parse_status: "pending" },
    ]
  );

  assertEquals(error, "Some selected reports are not parsed yet: r-2");
});

Deno.test("validateSelectedReportsAreParsed accepts fully parsed selections", () => {
  const error = validateSelectedReportsAreParsed(
    ["r-1", "r-2"],
    [
      { id: "r-1", parse_status: "parsed" },
      { id: "r-2", parse_status: "parsed" },
    ]
  );

  assertEquals(error, null);
});
