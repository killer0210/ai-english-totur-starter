import type { SupabaseClient } from "@supabase/supabase-js";

import type { EnglishLevel } from "@/features/profile/schemas";
import { AppError, defaultMessageMn } from "@/lib/errors";
import { logger } from "@/lib/logger";

import type { PathUnit } from "./next-scenario";

type UnitRow = {
  id: string;
  english_level: EnglishLevel;
  position: number;
  title_mn: string;
  scenarios: {
    id: string;
    slug: string;
    position: number;
    title_mn: string;
    goal_mn: string;
    english_level: EnglishLevel;
  }[];
};

/**
 * The learning path for one level, read through the user-session client:
 * RLS returns active units and scenarios only (ADR-004).
 */
export async function getPath(supabase: SupabaseClient, level: EnglishLevel): Promise<PathUnit[]> {
  const { data, error } = await supabase
    .from("units")
    .select(
      "id, english_level, position, title_mn, scenarios(id, slug, position, title_mn, goal_mn, english_level)",
    )
    .eq("english_level", level)
    .order("position")
    .order("position", { referencedTable: "scenarios" })
    .returns<UnitRow[]>();
  if (error) {
    logger.error("path_read_failed", { level, code: error.code });
    throw new AppError("INTERNAL", defaultMessageMn("INTERNAL"), 500);
  }
  return data.map((unit) => ({
    id: unit.id,
    englishLevel: unit.english_level,
    position: unit.position,
    titleMn: unit.title_mn,
    scenarios: unit.scenarios.map((s) => ({
      id: s.id,
      slug: s.slug,
      position: s.position,
      titleMn: s.title_mn,
      goalMn: s.goal_mn,
      englishLevel: s.english_level,
    })),
  }));
}
