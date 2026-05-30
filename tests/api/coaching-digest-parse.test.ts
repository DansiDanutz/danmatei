/**
 * Unit tests for parseTip — pulls {title, body, source} out of the LLM's reply
 * in the daily coaching digest (api/cron/coaching-digest).
 *
 * Why this matters: a model may wrap JSON in prose or a code fence, or return
 * junk. parseTip must extract a valid tip, REJECT incomplete/garbage ones (so
 * the cron cleanly falls back to the curated library), and never throw.
 */
import { describe, it, expect } from "vitest";
import { parseTip } from "../../api/cron/coaching-digest";

describe("parseTip", () => {
  it("parses a clean JSON object", () => {
    expect(parseTip('{"title":"T","body":"B","source":"S"}')).toEqual({
      title: "T",
      body: "B",
      source: "S",
    });
  });
  it("extracts JSON wrapped in a ```json code fence", () => {
    expect(
      parseTip('```json\n{"title":"T","body":"B","source":"S"}\n```')
    ).toEqual({ title: "T", body: "B", source: "S" });
  });
  it("extracts JSON embedded in surrounding prose", () => {
    expect(
      parseTip('Sigur! {"title":"T","body":"B","source":"S"} sper că ajută')
    ).toEqual({ title: "T", body: "B", source: "S" });
  });
  it("defaults a missing source to an empty string", () => {
    expect(parseTip('{"title":"T","body":"B"}')).toEqual({
      title: "T",
      body: "B",
      source: "",
    });
  });
  it("returns null when title or body is missing/empty (forces fallback)", () => {
    expect(parseTip('{"title":"","body":"B"}')).toBeNull();
    expect(parseTip('{"body":"B","source":"S"}')).toBeNull();
    expect(parseTip('{"title":"T"}')).toBeNull();
  });
  it("returns null for non-JSON / malformed input without throwing", () => {
    expect(parseTip("no json here")).toBeNull();
    expect(parseTip('{"title":"T","body":"B"')).toBeNull(); // no closing brace
    expect(parseTip("")).toBeNull();
    expect(parseTip("{ not json }")).toBeNull();
  });
  it("trims whitespace in the extracted fields", () => {
    expect(parseTip('{"title":"  T  ","body":"  B  ","source":"  S  "}')).toEqual(
      { title: "T", body: "B", source: "S" }
    );
  });
});
