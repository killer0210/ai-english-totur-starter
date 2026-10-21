import { describe, expect, it } from "vitest";

import { nextScenario, type PathUnit } from "@/features/path/next-scenario";

const scenario = (id: string, position: number, level: PathUnit["englishLevel"] = "A1") => ({
  id,
  slug: id,
  position,
  titleMn: id,
  goalMn: id,
  englishLevel: level,
});

// Deliberately out of order: the function sorts by unit, then scenario position.
const content: PathUnit[] = [
  {
    id: "a1-u2",
    englishLevel: "A1",
    position: 2,
    titleMn: "Unit 2",
    scenarios: [scenario("a1-u2-s2", 2), scenario("a1-u2-s1", 1)],
  },
  {
    id: "a1-u1",
    englishLevel: "A1",
    position: 1,
    titleMn: "Unit 1",
    scenarios: [scenario("a1-u1-s2", 2), scenario("a1-u1-s1", 1)],
  },
  {
    id: "a2-u1",
    englishLevel: "A2",
    position: 1,
    titleMn: "A2",
    scenarios: [scenario("a2-u1-s1", 1, "A2")],
  },
];

const a1 = { englishLevel: "A1" as const };

describe("nextScenario", () => {
  it("starts with the first scenario of the first unit at the learner's level", () => {
    expect(nextScenario(a1, new Set(), content)?.id).toBe("a1-u1-s1");
    expect(nextScenario({ englishLevel: "A2" }, new Set(), content)?.id).toBe("a2-u1-s1");
  });

  it("skips completed scenarios, in order, across units", () => {
    expect(nextScenario(a1, new Set(["a1-u1-s1"]), content)?.id).toBe("a1-u1-s2");
    expect(nextScenario(a1, new Set(["a1-u1-s1", "a1-u1-s2"]), content)?.id).toBe("a1-u2-s1");
    // Not a lock: a later scenario done out of order does not change the next one.
    expect(nextScenario(a1, new Set(["a1-u2-s1"]), content)?.id).toBe("a1-u1-s1");
  });

  it("ignores completions at other levels", () => {
    expect(nextScenario(a1, new Set(["a2-u1-s1"]), content)?.id).toBe("a1-u1-s1");
  });

  it("returns null when every scenario at the level is done", () => {
    const done = new Set(["a1-u1-s1", "a1-u1-s2", "a1-u2-s1", "a1-u2-s2"]);
    expect(nextScenario(a1, done, content)).toBeNull();
  });

  it("returns null when the learner's level has no content", () => {
    expect(nextScenario({ englishLevel: "B1" }, new Set(), content)).toBeNull();
    expect(nextScenario(a1, new Set(), [])).toBeNull();
  });
});
