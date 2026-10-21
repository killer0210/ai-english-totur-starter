// Writes docs/content_review.md from content/: every scenario and target word
// in one table for the English teacher's review (docs/prd.md FR-03).
// Usage: npm run content:review   (re-run after any content change)
import { writeFile } from "node:fs/promises";

import { loadContent } from "../src/features/path/content-sync.ts";

const content = await loadContent("content");
const cell = (value: string) => value.replaceAll("|", "\\|").replaceAll("\n", " ");
const levels = ["A1", "A2", "B1"] as const;

const lines = [
  "# Агуулгын хяналт — багшид",
  "",
  '`content/`-оос `npm run content:review`-ээр үүсгэсэн; гараар бүү засварла. Засварыг `content/scenarios/<slug>.json`-д хийж, дахин үүсгэнэ. Хянаж дууссан файлын `review_status`-ийг `"approved"` болгоно.',
  "",
  "Шалгах зүйл: англи хэл түвшиндээ тохирсон эсэх (`intro_en`, жишээ өгүүлбэр), монгол утга зөв ба ойлгомжтой эсэх, зорилго (`goal_mn`) сценаритэй нийцэж буй эсэх.",
  "",
];

for (const level of levels) {
  for (const unit of content.units.units.filter((u) => u.english_level === level)) {
    lines.push(
      `## ${level} · Бүлэг ${unit.position}. ${unit.title_mn} (\`${content.units.review_status}\`)`,
      "",
    );
    const scenarios = content.scenarios
      .filter((s) => s.unit_slug === unit.slug)
      .toSorted((a, b) => a.position - b.position);
    for (const s of scenarios) {
      lines.push(
        `### ${s.position}. ${s.title_mn} — \`${s.slug}\` (\`${s.review_status}\`)`,
        "",
        "| Талбар | Утга |",
        "|---|---|",
        `| Зорилго (goal_mn) | ${cell(s.goal_mn)} |`,
        `| AI-ийн дүр / хэрэглэгчийн дүр | ${cell(s.ai_role)} / ${cell(s.user_role)} |`,
        `| Танилцуулга (intro_en) | ${cell(s.intro_en)} |`,
        `| Нөхцөл (role_context, LLM-д) | ${cell(s.role_context)} |`,
        "",
        "| # | Үг / хэллэг | Монгол утга | Жишээ (example_en) | Хянасан |",
        "|---|---|---|---|---|",
        ...s.words.map(
          (w, i) =>
            `| ${i + 1} | ${cell(w.term)} | ${cell(w.meaning_mn)} | ${cell(w.example_en)} | ☐ |`,
        ),
        "",
      );
    }
  }
}

await writeFile("docs/content_review.md", `${lines.join("\n").trimEnd()}\n`);
console.log(`docs/content_review.md: ${content.scenarios.length} scenarios`);
