import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  contentSetSchema,
  normalizeTerm,
  scenarioFileSchema,
} from "@/features/path/content-schema";
import { ContentError, loadContent } from "@/features/path/content-sync";

const word = (term: string) => ({
  term,
  meaning_mn: `${term} — утга`,
  example_en: `I use ${term} here.`,
});

const scenario = {
  review_status: "draft",
  slug: "order-at-a-cafe",
  english_level: "A1",
  unit_position: 1,
  position: 1,
  title_mn: "Кафед захиалах",
  goal_mn: "Уух юм захиалах.",
  ai_role: "barista",
  user_role: "customer",
  role_context: "You are a barista.",
  intro_en: "Hello! What would you like?",
  words: [word("coffee"), word("tea"), word("large")],
};

const units = {
  review_status: "draft",
  units: [{ english_level: "A1", position: 1, title_mn: "Анхны яриа", goal_tags: ["daily"] }],
};

function omit<T extends object>(value: T, key: keyof T): Partial<T> {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

function issuesOf(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  expect(result.success).toBe(false);
  return result.error!.issues.map((issue) => issue.path.join("."));
}

describe("scenarioFileSchema", () => {
  it("accepts a valid scenario file", () => {
    expect(scenarioFileSchema.parse(scenario)).toEqual(scenario);
  });

  it("accepts A1, A2 and B1 and rejects any other level", () => {
    for (const level of ["A1", "A2", "B1"]) {
      expect(scenarioFileSchema.safeParse({ ...scenario, english_level: level }).success).toBe(
        true,
      );
    }
    for (const level of ["B2", "C1", "a1", ""]) {
      expect(issuesOf(scenarioFileSchema.safeParse({ ...scenario, english_level: level }))).toEqual(
        ["english_level"],
      );
    }
  });

  it("needs 3–6 target words", () => {
    const words = ["a", "b", "c", "d", "e", "f", "g"].map(word);
    expect(scenarioFileSchema.safeParse({ ...scenario, words: words.slice(0, 6) }).success).toBe(
      true,
    );
    expect(
      issuesOf(scenarioFileSchema.safeParse({ ...scenario, words: words.slice(0, 2) })),
    ).toEqual(["words"]);
    expect(issuesOf(scenarioFileSchema.safeParse({ ...scenario, words }))).toEqual(["words"]);
  });

  it("needs meaning_mn and example_en on every word", () => {
    const noMeaning = omit(word("tea"), "meaning_mn");
    const noExample = omit(word("tea"), "example_en");
    const cases = [
      [noMeaning, "words.1.meaning_mn"],
      [{ ...word("tea"), meaning_mn: "  " }, "words.1.meaning_mn"],
      [noExample, "words.1.example_en"],
      [{ ...word("tea"), example_en: "" }, "words.1.example_en"],
    ] as const;
    for (const [bad, issuePath] of cases) {
      const words = [word("coffee"), bad, word("large")];
      expect(issuesOf(scenarioFileSchema.safeParse({ ...scenario, words }))).toEqual([issuePath]);
    }
  });

  it("needs intro_en and the other scenario texts", () => {
    for (const field of [
      "intro_en",
      "title_mn",
      "goal_mn",
      "role_context",
      "ai_role",
      "user_role",
    ]) {
      expect(issuesOf(scenarioFileSchema.safeParse({ ...scenario, [field]: "" }))).toEqual([field]);
      const rest = omit(scenario, field as keyof typeof scenario);
      expect(issuesOf(scenarioFileSchema.safeParse(rest))).toEqual([field]);
    }
  });

  it("rejects the same word twice (after normalization), a bad slug, unknown fields and a missing review_status", () => {
    const words = [word("Coffee"), word("tea"), word(" coffee ")];
    expect(issuesOf(scenarioFileSchema.safeParse({ ...scenario, words }))).toEqual([
      "words.2.term",
    ]);
    expect(issuesOf(scenarioFileSchema.safeParse({ ...scenario, slug: "Order at cafe" }))).toEqual([
      "slug",
    ]);
    expect(issuesOf(scenarioFileSchema.safeParse({ ...scenario, extra: 1 }))).toEqual([""]);
    const noStatus = omit(scenario, "review_status");
    expect(issuesOf(scenarioFileSchema.safeParse(noStatus))).toEqual(["review_status"]);
  });
});

describe("contentSetSchema", () => {
  it("accepts a consistent set", () => {
    expect(contentSetSchema.safeParse({ units, scenarios: [scenario] }).success).toBe(true);
  });

  it("rejects duplicate slugs", () => {
    const other = { ...scenario, position: 2 };
    expect(issuesOf(contentSetSchema.safeParse({ units, scenarios: [scenario, other] }))).toEqual([
      "scenarios.1.slug",
    ]);
  });

  it("rejects two scenarios at the same position in a unit", () => {
    const other = { ...scenario, slug: "other" };
    expect(issuesOf(contentSetSchema.safeParse({ units, scenarios: [scenario, other] }))).toEqual([
      "scenarios.1.position",
    ]);
  });

  it("allows the same position in different units", () => {
    const set = {
      units: { ...units, units: [...units.units, { ...units.units[0]!, english_level: "A2" }] },
      scenarios: [scenario, { ...scenario, slug: "other", english_level: "A2" }],
    };
    expect(contentSetSchema.safeParse(set).success).toBe(true);
  });

  it("rejects a scenario whose unit does not exist and duplicate unit positions", () => {
    expect(
      issuesOf(
        contentSetSchema.safeParse({ units, scenarios: [{ ...scenario, english_level: "B1" }] }),
      ),
    ).toEqual(["scenarios.0.unit_position"]);
    const twice = { ...units, units: [units.units[0]!, units.units[0]!] };
    expect(issuesOf(contentSetSchema.safeParse({ units: twice, scenarios: [] }))).toEqual([
      "units.units.1.position",
    ]);
  });
});

describe("normalizeTerm", () => {
  it("matches the SQL normalize_term rules", () => {
    expect(normalizeTerm("  I’m  Looking   For ")).toBe("i'm looking for");
    expect(normalizeTerm("Check-Out\ttime")).toBe("check-out time");
  });
});

describe("shipped content", () => {
  it("all 12 files in content/ pass the schema: 4 scenarios per level", async () => {
    const content = await loadContent("content");
    expect(content.scenarios).toHaveLength(12);
    for (const level of ["A1", "A2", "B1"]) {
      const positions = content.scenarios
        .filter((s) => s.english_level === level)
        .map((s) => s.position)
        .sort();
      expect(positions).toEqual([1, 2, 3, 4]);
    }
    expect(content.units.units.map((u) => u.english_level)).toEqual(["A1", "A2", "B1"]);
  });

  it("names the file after its slug and reports the file of an invalid scenario", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "content-"));
    await mkdir(path.join(root, "scenarios"));
    await writeFile(path.join(root, "units.json"), JSON.stringify(units));
    await writeFile(path.join(root, "scenarios", "wrong-name.json"), JSON.stringify(scenario));
    await expect(loadContent(root)).rejects.toThrow(/wrong-name\.json: file name must be/);

    await writeFile(
      path.join(root, "scenarios", "wrong-name.json"),
      JSON.stringify({ ...scenario, slug: "wrong-name", words: [] }),
    );
    await expect(loadContent(root)).rejects.toBeInstanceOf(ContentError);
    await expect(loadContent(root)).rejects.toThrow(/wrong-name\.json: words/);
  });
});
