import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type ContentSet, normalizeTerm } from "@/features/path/content-schema";
import { ContentError, loadContent, syncContent } from "@/features/path/content-sync";

import {
  adminClient,
  anonClient,
  createUser,
  deleteUser,
  signedInClient,
} from "./support/supabase";

// Runs the real sync against the local stack. Every test ends by syncing the
// shipped content again, so E2E and later runs see exactly content/. Test
// scenarios use fixed slugs and stay behind as inactive rows (never deleted).

const TABLES = ["units", "scenarios", "scenario_words"] as const;

let shipped: ContentSet;
let user: { id: string; email: string; password: string };
let reader: SupabaseClient;

const testScenario = (slug: string, overrides: Partial<ContentSet["scenarios"][number]> = {}) => ({
  review_status: "draft" as const,
  slug,
  english_level: "A1" as const,
  unit_slug: "a1-everyday-basics",
  position: 99,
  title_mn: `Тест ${slug}`,
  goal_mn: "Тестийн зорилго",
  ai_role: "tester",
  user_role: "learner",
  role_context: "Integration test scenario.",
  intro_en: "Hello from a test.",
  words: ["alpha", "beta", "gamma"].map((term) => ({
    term,
    meaning_mn: `${term} утга`,
    example_en: `Say ${term}.`,
  })),
  ...overrides,
});

const withScenarios = (...extra: ContentSet["scenarios"]): ContentSet => ({
  ...shipped,
  scenarios: [...shipped.scenarios, ...extra],
});

async function visibleSlugs(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client.from("scenarios").select("slug");
  expect(error).toBeNull();
  return (data ?? []).map((row) => row.slug as string);
}

async function scenarioRow(slug: string) {
  const { data, error } = await adminClient()
    .from("scenarios")
    .select("id, is_active, position")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  return data;
}

beforeAll(async () => {
  shipped = await loadContent("content");
  user = await createUser("content");
  reader = await signedInClient(user.email, user.password);
  await syncContent(adminClient(), shipped);
});

afterAll(async () => {
  await syncContent(adminClient(), shipped);
  await deleteUser(user.id);
});

describe("content:sync", () => {
  it("is idempotent: a second run with the same files writes nothing", async () => {
    expect(await syncContent(adminClient(), shipped)).toEqual([]);
    expect(await syncContent(adminClient(), shipped)).toEqual([]);

    const slugs = await visibleSlugs(reader);
    expect(slugs.toSorted()).toEqual(shipped.scenarios.map((s) => s.slug).toSorted());
  });

  it("stores normalized_term exactly as the TS normalizeTerm() computes it", async () => {
    const { data, error } = await adminClient()
      .from("scenario_words")
      .select("term, normalized_term");
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(36);
    for (const row of data!) expect(row.normalized_term).toBe(normalizeTerm(row.term));
  });

  it("marks a scenario removed from the files inactive instead of deleting it", async () => {
    const slug = "int-removed-scenario";
    const added = await syncContent(adminClient(), withScenarios(testScenario(slug)));
    expect(added.some((line) => line.endsWith(`scenario ${slug}`))).toBe(true);
    expect(await visibleSlugs(reader)).toContain(slug);
    const { id } = await scenarioRow(slug);

    const removed = await syncContent(adminClient(), shipped);
    expect(removed).toEqual([`deactivate scenario ${slug}`]);
    const row = await scenarioRow(slug);
    expect(row).toMatchObject({ id, is_active: false });

    // Inactive rows and their words are invisible to signed-in users.
    expect(await visibleSlugs(reader)).not.toContain(slug);
    const words = await reader.from("scenario_words").select("id").eq("scenario_id", id);
    expect(words.error).toBeNull();
    expect(words.data).toEqual([]);
    const admin = await adminClient().from("scenario_words").select("id").eq("scenario_id", id);
    expect(admin.data).toHaveLength(3);

    expect(await syncContent(adminClient(), shipped)).toEqual([]);
  });

  it("lets a new scenario take the position of a removed one", async () => {
    await syncContent(adminClient(), withScenarios(testScenario("int-removed-scenario")));
    await syncContent(adminClient(), shipped);

    const changes = await syncContent(
      adminClient(),
      withScenarios(testScenario("int-replacement")),
    );
    // "insert" on a fresh database, "update" (reactivate) on later runs.
    expect(changes.some((line) => /^(insert|update) scenario int-replacement$/.test(line))).toBe(
      true,
    );
    expect(await scenarioRow("int-replacement")).toMatchObject({ is_active: true, position: 99 });
    // The removed scenario keeps its old position; uniqueness covers active rows only.
    expect(await scenarioRow("int-removed-scenario")).toMatchObject({
      is_active: false,
      position: 99,
    });

    expect(
      await syncContent(adminClient(), withScenarios(testScenario("int-replacement"))),
    ).toEqual([]);
    await syncContent(adminClient(), shipped);
  });

  it("swaps the positions of two scenarios in one run", async () => {
    const a = testScenario("int-swap-a", { position: 97 });
    const b = testScenario("int-swap-b", { position: 98 });
    await syncContent(adminClient(), withScenarios(a, b));

    const changes = await syncContent(
      adminClient(),
      withScenarios({ ...a, position: 98 }, { ...b, position: 97 }),
    );
    expect(changes.toSorted()).toEqual([
      "update scenario int-swap-a",
      "update scenario int-swap-b",
    ]);
    expect(await scenarioRow("int-swap-a")).toMatchObject({ is_active: true, position: 98 });
    expect(await scenarioRow("int-swap-b")).toMatchObject({ is_active: true, position: 97 });

    await syncContent(adminClient(), shipped);
  });

  it("keys units by slug: a new unit takes a removed unit's position", async () => {
    const extra = (slug: string, title_mn: string) => ({
      slug,
      english_level: "B1" as const,
      position: 98,
      title_mn,
      goal_tags: [],
    });
    const withUnit = (unit: ReturnType<typeof extra>): ContentSet => ({
      units: { ...shipped.units, units: [...shipped.units.units, unit] },
      scenarios: shipped.scenarios,
    });

    await syncContent(adminClient(), withUnit(extra("int-unit-old", "Хуучин")));
    // Same slug, new title: an update, not a second unit.
    expect(await syncContent(adminClient(), withUnit(extra("int-unit-old", "Шинэ нэр")))).toEqual([
      "update unit int-unit-old",
    ]);

    const changes = await syncContent(adminClient(), withUnit(extra("int-unit-new", "Шинэ")));
    expect(changes[0]).toBe("deactivate unit int-unit-old");
    expect(changes[1]).toMatch(/^(insert|update) unit int-unit-new$/);
    const { data, error } = await adminClient()
      .from("units")
      .select("slug, position, is_active")
      .in("slug", ["int-unit-old", "int-unit-new"])
      .order("slug");
    expect(error).toBeNull();
    expect(data).toEqual([
      { slug: "int-unit-new", position: 98, is_active: true },
      { slug: "int-unit-old", position: 98, is_active: false },
    ]);

    await syncContent(adminClient(), shipped);
  });

  it("refuses to drop a word from a scenario already in the database (never deletes)", async () => {
    const [first, ...rest] = shipped.scenarios;
    const fewer = { ...first!, words: first!.words.slice(1) };
    await expect(
      syncContent(adminClient(), { ...shipped, scenarios: [fewer, ...rest] }),
    ).rejects.toBeInstanceOf(ContentError);
    expect(await syncContent(adminClient(), shipped)).toEqual([]);
  });

  it("hides active scenarios and words of an inactive unit", async () => {
    const units = {
      ...shipped.units,
      units: [
        ...shipped.units.units,
        {
          slug: "int-hidden-unit",
          english_level: "B1" as const,
          position: 99,
          title_mn: "Тест бүлэг",
          goal_tags: [],
        },
      ],
    };
    const slug = "int-hidden-unit";
    const scenario = testScenario(slug, {
      english_level: "B1",
      unit_slug: "int-hidden-unit",
      position: 1,
    });
    await syncContent(adminClient(), { units, scenarios: [...shipped.scenarios, scenario] });
    expect(await visibleSlugs(reader)).toContain(slug);
    const { id } = await scenarioRow(slug);

    // Unit inactive, scenario still active: neither the scenario nor its words show.
    const { error } = await adminClient()
      .from("units")
      .update({ is_active: false })
      .eq("slug", "int-hidden-unit");
    expect(error).toBeNull();
    expect(await visibleSlugs(reader)).not.toContain(slug);
    const words = await reader.from("scenario_words").select("id").eq("scenario_id", id);
    expect(words.data).toEqual([]);
    const unitsSeen = await reader.from("units").select("position").eq("english_level", "B1");
    expect(unitsSeen.data).toEqual([{ position: 1 }]);

    const cleanup = await syncContent(adminClient(), shipped);
    expect(cleanup).toEqual([`deactivate scenario ${slug}`]);
    // The unit was already inactive, so only the scenario is reported.
  });
});

describe("content RLS", () => {
  it("a signed-in user reads active content", async () => {
    const units = await reader
      .from("units")
      .select("slug, english_level, position")
      .order("english_level");
    expect(units.error).toBeNull();
    expect(units.data).toEqual([
      { slug: "a1-everyday-basics", english_level: "A1", position: 1 },
      { slug: "a2-daily-life", english_level: "A2", position: 1 },
      { slug: "b1-expressing-ideas", english_level: "B1", position: 1 },
    ]);
    const words = await reader.from("scenario_words").select("id, scenarios!inner(slug)");
    expect(words.error).toBeNull();
    const expected = shipped.scenarios.reduce((sum, s) => sum + s.words.length, 0);
    expect(words.data).toHaveLength(expected);
  });

  it("a signed-in user cannot insert, update or delete any content table", async () => {
    const { data: unit } = await adminClient()
      .from("units")
      .select("id, title_mn")
      .eq("slug", "a1-everyday-basics")
      .single();
    const { data: scenario } = await adminClient()
      .from("scenarios")
      .select("id, title_mn")
      .eq("slug", shipped.scenarios[0]!.slug)
      .single();
    const { data: word } = await adminClient()
      .from("scenario_words")
      .select("id, meaning_mn")
      .eq("scenario_id", scenario!.id)
      .limit(1)
      .single();

    type Row = Record<string, unknown>;
    const rows: Record<(typeof TABLES)[number], { row: Row; id: string; patch: Row }> = {
      units: {
        row: { slug: "int-rls-insert", english_level: "A1", position: 50, title_mn: "x" },
        id: unit!.id,
        patch: { title_mn: "hacked" },
      },
      scenarios: {
        row: {
          unit_id: unit!.id,
          position: 50,
          slug: "int-rls-insert",
          title_mn: "x",
          goal_mn: "x",
          ai_role: "x",
          user_role: "x",
          role_context: "x",
          intro_en: "x",
          english_level: "A1",
        },
        id: scenario!.id,
        patch: { title_mn: "hacked" },
      },
      scenario_words: {
        row: { scenario_id: scenario!.id, position: 9, term: "hacked", meaning_mn: "x" },
        id: word!.id,
        patch: { meaning_mn: "hacked" },
      },
    };

    for (const table of TABLES) {
      const { row, id, patch } = rows[table];
      const insert = await reader.from(table).insert(row);
      expect(insert.error?.code, `${table} insert`).toBe("42501");
      const update = await reader.from(table).update(patch).eq("id", id).select("id");
      expect(update.error?.code, `${table} update`).toBe("42501");
      const del = await reader.from(table).delete().eq("id", id).select("id");
      expect(del.error?.code, `${table} delete`).toBe("42501");
    }

    // Nothing changed.
    expect(await syncContent(adminClient(), shipped)).toEqual([]);
    const after = await adminClient().from("units").select("title_mn").eq("id", unit!.id).single();
    expect(after.data!.title_mn).toBe(unit!.title_mn);
  });

  it("anon (not signed in) cannot read any content table", async () => {
    for (const table of TABLES) {
      const { data, error } = await anonClient().from(table).select("id");
      expect(error?.code, table).toBe("42501");
      expect(data).toBeNull();
    }
  });
});
