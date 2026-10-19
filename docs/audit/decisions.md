# Аудитын шийдвэрийн төлөв

**Огноо:** 2026-10-19 · **Эх сурвалж:** [doc-review.md](./doc-review.md) (өөрчлөгдөөгүй)

Төлөв: **Шийдсэн** — баримтад тусгасан (хаана) · **Хүлээн зөвшөөрсөн эрсдэл** — pilot-д мэдсээр үлдээсэн · **Хойшлуулсан** — MVP/pilot-ийн дараа · **Нээлттэй** — шийдвэр хүлээгдэж буй.

Энэ бол баримтын түвшний төлөв. Аль ч зүйл кодоор хэрэгжиж, тестээр **шалгагдаагүй**.

## Шийдвэрүүд (D) ба асуултын хариу (Q)

| # | Төлөв | Тэмдэглэл |
|---|---|---|
| D-01 | Хүлээн авсан | A1/A2/B1, `english_level` enum |
| D-02 | Хүлээн авсан | Route Handlers + Server Components; Server Actions-гүй |
| D-03 | Өөрчилж хүлээн авсан | SELECT-only RLS; нэг мөр — service role модуль; олон алхам — EXECUTE хаалттай DB функц → ADR-004, ADR-005 |
| D-04 | Хүлээн авсан | ADR-003 |
| D-05 | Хүлээн авсан | `usage_counters`, Asia/Ulaanbaatar; 40 хариу, 10 hint, feedback 1+1 |
| D-06 | Хүлээн авсан | Түүхий JSON хадгалахгүй |
| D-07 | Хүлээн авсан | `session_target_words` хоёр эх сурвалжтай, 3 mission |
| D-08 | Хүлээн авсан | Хүснэгт `backend_schema.md §2.5`; хоёр default-ийг батлах нь нээлттэй (`prd.md §10`) |
| D-09 | Шийдсэн | Vercel + Supabase, Ази бүс (шалгах), staging/production тусдаа |
| D-10 | Хүлээн авсан | `scenarios.intro_en` |
| D-11 | Хүлээн авсан | `content/` + upsert скрипт |
| D-12 | Хүлээн авсан | Хойшлуулсан жагсаалт `prd.md §4` |
| D-13 | Хүлээн авсан | ADR-002 |
| D-14 | Хүлээн авсан | `backend_schema.md §7` |
| Q-01…Q-16 | Хариулсан | Q-12 (провайдер) нээлттэй хэвээр — M6-ийн орох нөхцөл |

## Critical

| # | Асуудал | Төлөв | Хаана |
|---|---|---|---|
| C-01 | RLS `for all` нь серверийн шалгалтыг тойрно | Шийдсэн | `backend_schema.md §1, §4`; `security.md §3`; ADR-004; `testing.md §3 #4–5` |
| C-02 | Аль client-ийг хаана ашиглах тодорхойгүй | Шийдсэн | ADR-004, ADR-005; `architecture.md §3, §7`; `trd.md §2` |
| C-03 | Хүснэгт хоорондын эзэмшлийн тууштай байдал | Шийдсэн | `backend_schema.md §2` (composite FK); `testing.md §3 #6` |
| C-04 | Мессежийн төлөвийн машин дутуу | Шийдсэн | ADR-003; `backend_schema.md §2.3`; `architecture.md §4`; `app_flow.md §4` |
| C-05 | Feedback idempotent биш, төлөвгүй | Шийдсэн | ADR-003; `backend_schema.md §2.3–2.4, §4.1`; `architecture.md §5` |
| C-06 | Шинэ хэрэглэгчид word missions байхгүй | Шийдсэн | `backend_schema.md §2.3`; `prd.md §FR-04` |
| C-07 | "Зөв хэрэглэсэн"-ийг хэмжихгүй, ID буулгалт | Шийдсэн | `trd.md §3.2` (`missions[].key`, `used_correctly`; substring шалгалтгүй); `testing.md §5` (хувирсан хэлбэр) |
| C-08 | RLS асаах, `ai_usage_events` хаах | Шийдсэн | `backend_schema.md §4` (бүх хүснэгт + CI шалгалт); `units.is_active` нэмсэн |

## Important

| # | Асуудал | Төлөв | Хаана |
|---|---|---|---|
| I-01 | Түвшний хүрээ (B2) | Шийдсэн | `prd.md §3`; `backend_schema.md §2.0` |
| I-02 | Strengths 2–3 vs 1–3 | Шийдсэн | `trd.md §3.2` (`.min(2)`); `backend_schema.md §2.4` check |
| I-03 | "Өнөөдөр" дараалал, чөлөөт яриа | Шийдсэн | `prd.md §FR-03`; `app_flow.md §3`; чөлөөт яриа хойшлогдсон |
| I-04 | Үгийн төлөвийн шилжилт | Шийдсэн | `backend_schema.md §2.5`; `prd.md §FR-06–07`; `app_flow.md §6` (default-ууд `prd.md §10`-д батлуулахаар) |
| I-05 | Шууд засвар тодорхойгүй | Хойшлуулсан | Багана хасагдсан; `prd.md §4` |
| I-06 | AI мессежийн орчуулга | Хойшлуулсан | `app_flow.md §10`; `design_system.md §5` |
| I-07 | `CLAUDE.md` AGENTS.md руу заадаггүй | Шийдсэн | `CLAUDE.md` = `@AGENTS.md` |
| I-08 | Нэвтрэлтийн арга | Шийдсэн | Имэйл OTP: `prd.md §FR-01`; `security.md §2`. Production SMTP — шалгах шаардлагатай |
| I-09 | Насны хязгаар | Шийдсэн (pilot) / Хойшлуулсан (насанд хүрээгүй) | 18+: `prd.md §3, §FR-01`; `backend_schema.md §2.1`; хуулийн review хойшлогдсон |
| I-10 | Бүртгэл устгах процесс | Шийдсэн | `backend_schema.md §2.7, §6`; `prd.md §FR-09` (7 хоног, гараар) |
| I-11 | Rate limit тодорхойлолт | Шийдсэн; IP limit — Хүлээн зөвшөөрсөн эрсдэл | `trd.md §3.4, §5`; `backend_schema.md §2.6`; `security.md §7` |
| I-12 | Олон бүртгэлээр зардал шавхах | Хүлээн зөвшөөрсөн эрсдэл (бага) | Урилгаар pilot, нийтийн бүртгэл хаалттай; нийт өдрийн төсөв — Нээлттэй (M6-ийн дараа) |
| I-13 | Агуулга ба "дараагийн сценари" | Шийдсэн | `prd.md §FR-03` (12 сценари, алгоритм); `backend_schema.md §2.2` |
| I-14 | LLM-ийн тоо, засварын хязгаар хэмжүүрийг эвддэг | Шийдсэн | `trd.md §3.2` (`error_tally`, серверийн `word_count`); `prd.md §FR-08` |
| I-15 | `message_index`-ийн утга | Шийдсэн | `trd.md §3.2` |
| I-16 | Retry давхцал | Шийдсэн | `trd.md §5` (төсөв, ≤ 2 оролдлого); ADR-002 |
| I-17 | Үгийн утгын эх сурвалж | Шийдсэн | `prd.md §FR-06`; `backend_schema.md §2.5` |
| I-18 | Дутуу endpoint | Шийдсэн | `backend_schema.md §5` (`GET /api/sessions`, onboarding, age-confirmation; abandon — lazy) |
| I-19 | Profile үүсэх | Шийдсэн | `backend_schema.md §2.1` (trigger) |
| I-20 | Reply шалгалт, хэлний зан төлөв, moderation | Хэсэгчлэн шийдсэн | `replySchema`: `trd.md §3.1`. Монгол оролт — Нээлттэй (M6). Moderation — Хүлээн зөвшөөрсөн эрсдэл (18+ pilot) |
| I-21 | Production агуулга (seed) | Шийдсэн | `architecture.md §3`; `backend_schema.md §2.2` |
| I-22 | Hosting, функцийн хугацаа, бүс | Шийдсэн; шалгах шаардлагатай | `trd.md §6` |
| I-23 | Env ба тохиргоо | Шийдсэн | `trd.md §6` |
| I-24 | Pilot хэмжүүрийн өгөгдөл | Нээлттэй | `prd.md §10`; M13-ийн checklist |

## Minor

| # | Асуудал | Төлөв | Хаана |
|---|---|---|---|
| M-01 | `corrections.category` check | Шийдсэн | `error_category` enum, `backend_schema.md §2.0` |
| M-02 | `lib/services` vs `features/` | Шийдсэн | `backend_schema.md §2.5` → `src/features/vocabulary/` |
| M-03 | `messages/mn.json` байршил | Шийдсэн | Repo root: `architecture.md §3` |
| M-04 | README-ийн скрипт | Шийдсэн | `README.md` ("Шалгах") |
| M-05 | FK index дутуу | Шийдсэн | `backend_schema.md §2` |
| M-06 | `(select auth.uid())` | Шийдсэн; шалгах шаардлагатай | `backend_schema.md §4` |
| M-07 | `normalized_term` зөрөх | Шийдсэн | Generated column + `normalize_term()`, `backend_schema.md §2.5` |
| M-08 | `ai_usage_events` талбарууд | Шийдсэн | `backend_schema.md §2.6` |
| M-09 | `used_target_words` давхардал | Шийдсэн | Хасагдсан, `backend_schema.md §2.4` |
| M-10 | Rate limit idempotency-ээс өмнө | Шийдсэн | `architecture.md §4`; ADR-003 |
| M-11 | Streaming интерфейс | Шийдсэн | `architecture.md §6`; ADR-002 |
| M-12 | Нэмэлт хамаарал | Шийдсэн | `trd.md §1` (`next-intl` routing-гүй; TanStack Query, MSW — зөвхөн шалтгаантай) |
| M-13 | `docs/adr/` байхгүй | Шийдсэн | `docs/adr/ADR-001…005` |
| M-14 | `MobileNav` | Шийдсэн | `design_system.md §5` |
| M-15 | Dark contrast | Нээлттэй — шалгах шаардлагатай | `design_system.md §3`; M1 |
| M-16 | Засварын эрэмбэ | Шийдсэн | `trd.md §3.2`; `prd.md §FR-05` |
