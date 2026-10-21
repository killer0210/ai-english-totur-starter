# Implementation Plan — Хэрэгжүүлэх төлөвлөгөө

**Холбоос:** [prd.md](./prd.md) · [audit/doc-review.md §6](./audit/doc-review.md) · [audit/decisions.md](./audit/decisions.md)
**Огноо:** 2026-10-19

Аудитын §6-ийн төлөвлөгөөг шийдвэрүүдийн дагуу шинэчилсэн хувилбар. Зарчим: нэг milestone = нэг босоо зүсэлт (`AGENTS.md §3`), тус бүр бие даан тестлэгдэнэ. Доорх "Тест" нь **бичиж ажиллуулах ёстой** тестүүд — одоогоор нэг нь ч ажиллаагүй.

## Тойм

| # | Milestone | Pilot-оос өмнө заавал |
|---|---|---|
| M0 | Шийдвэр ба баримт | ✅ |
| M1 | Суурь, CI, security header, secret scanning | ✅ |
| M2 | Нэвтрэлт (OTP, урилга, 18+), Origin шалгалт | ✅ |
| M3 | Онбординг ба тохиргоо | ✅ |
| M4 | Агуулга (12 сценари) ба зам | ✅ |
| M5 | Яриа (mock AI) + staging Supabase | ✅ |
| M6 | Бодит LLM, хязгаар, ажиглалт, eval dataset эхлэх | ✅ |
| M7 | Feedback | ✅ |
| M8 | Үгсийн сан | ✅ |
| M9 | Word missions | ✅ |
| M10 | Hint | ✅ |
| M11 | Давталт | ✅ |
| M12 | "Өнөөдөр" ба ахиц | ✅ |
| M13 | Бүртгэл устгах, нууцлалын бодлого, launch checklist | ✅ |
| P1 | Pilot-ийн дараах ажлууд | ❌ (доор) |

Бүх M0–M13 нь PRD-ийн 1-р шатны FR-ийг хэрэгжүүлдэг тул урилгаар pilot-оос өмнө заавал. Pilot-д шаардлагагүй ажлыг P1-д салгасан. Хуваарь хоцорвол хүрээг багасгах эсэх нь бүтээгдэхүүний шийдвэр (`AGENTS.md §9`).

---

### M0 — Шийдвэр ба баримт
- **Зорилго:** Аудитын Critical асуудлуудыг баримтын түвшинд хаах.
- **Хүрээ:** Шийдвэрүүдийг баримтад тусгах (дууссан — [audit/decisions.md](./audit/decisions.md)); `prd.md §10`-ийн нээлттэй асуултуудыг хянах.
- **Хүлээн авах шалгуур:** Critical бүр шийдсэн эсвэл хүлээн зөвшөөрсөн эрсдэл гэж тэмдэглэгдсэн; баримтууд хоорондоо зөрчилгүй (дахин review).
- **Тест:** Баримтын review.

### M1 — Суурь, CI, security header, secret scanning
- **Зорилго:** Хоосон ч ажилладаг, шалгагддаг, үндсэн хамгаалалттай апп.
- **Хүрээ:** Next.js App Router, TS strict (`noUncheckedIndexedAccess`), Tailwind, shadcn/ui, ESLint (service role import-ийн хязгаарлалт), Prettier, Vitest, Playwright, `src/lib/env.ts` (Zod, `mock`-ийг production-д хориглох), `AppError` + `withErrorHandling`, `messages/mn.json`, нүүр хуудас (S01), **security header** (CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`), **CI-д secret scanning**, design token-ийн contrast шалгалт, `.env.example`. Алдааны хяналтын хэрэгслийн сонголт **хойшлогдсон** (M6-аас өмнө).
- **Хүлээн авах шалгуур:** `lint`, `typecheck`, `test`, `test:e2e` README-д бичигдэж CI-д ажиллана; дутуу env-тэй үед апп тодорхой алдаагаар эхлэхгүй; `APP_ENV=production` + `AI_PROVIDER=mock` үед эхлэхгүй; header-ууд хариунд байна; CI-д нууц илэрвэл унана.
- **Тест:** Unit — env схем, `AppError` → JSON, CSP builder, contrast. E2E — нүүр хуудас утас/desktop-д хэвтээ гүйлгээгүй, axe critical/serious алдаагүй (light, dark), security header ба nonce, CSP зөрчилгүй, Ө/Ү-г агуулсан фонт. CI — туршилтын хуурамч нууцаар secret scan унахыг шалгах.
- **Төлөв:** Хэрэгжсэн (2026-10-19). Тушаал ба үр дүн — M1-ийн тайланд.

### M2 — Нэвтрэлт (OTP, урилга, 18+), Origin шалгалт
- **Зорилго:** FR-01.
- **Хүрээ:** Supabase local; `profiles` migration (+ `auth.users` trigger, SELECT-only RLS); `lib/supabase/{server,route,admin}.ts` (browser client-гүй); имэйл OTP (6 оронтой) нэвтрэх/гарах; нийтийн бүртгэл хаалттай, `scripts/invite-users`; `/age-confirmation` + `POST /api/age-confirmation`; middleware чиглүүлэлт; **мутацийн Route Handler-уудын Origin шалгалт** (`lib/origin.ts`); cookie тохиргоо.
- **Төлөв (2026-10-19):** Код бичигдсэн; lint, typecheck, unit (70), build давсан; migration-ийг PGlite (Supabase stub) дээр шалгасан. **Integration ба E2E ажиллаагүй** — машинд Docker байхгүй. Docker суулгасны дараа эсвэл анхны CI ажиллалтаар баталгаажуулна; тэр болтол M2 дуусаагүй. Шинэчлэл: Docker суусны дараа M2-ийн integration ба E2E (M3-ын хамт) local Supabase дээр давсан; CI-ийн баталгаа хүлээгдэж байна.
- **Хүлээн авах шалгуур:** Урилгагүй имэйлд код очихгүй, мессеж нь урилга байгаа эсэхийг илчлэхгүй; нэвтрээгүй → `/login`; 18+ баталгаажуулаагүй → `/age-confirmation`; буруу `Origin` → `403`.
- **Тест:** Integration — нэвтрээгүй хүсэлт 401; profile автоматаар үүсэх; A нь B-ийн profile-ийг anon client-ээр уншиж чадахгүй, өөрийн profile-ийг шууд засаж чадахгүй; Origin шалгалт. Unit — чиглүүлэлтийн шийдвэр. E2E — OTP-ээр нэвтрэх → 18+ → гарах (local имэйл барих хэрэгслээр — шалгах шаардлагатай).

### M3 — Онбординг ба тохиргоо
- **Зорилго:** FR-02, FR-09-ийн тохиргоо.
- **Хүрээ:** 4 алхамт онбординг (default утгатай), `POST /api/onboarding`, `/settings`, `PATCH /api/profile` (service модуль), redirect дүрэм.
- **Хүлээн авах шалгуур:** Онбординг дуусаагүй бол онбординг руу, давталтгүй; бүх утга тохиргооноос засагдана; B2 сонголт байхгүй.
- **Тест:** Unit — онбордингийн Zod схем (5/10/20, A1/A2/B1, 1–5, зорилгын жагсаалт). Integration — зөвхөн зөвшөөрсөн талбар шинэчлэгдэнэ. E2E — E1.
- **Шийдвэр (2026-10-19):** Тохиргоо онбордингийн 4 утгыг бүгдийг (итгэлийг оруулаад) засна; default — зорилго сонгоогүй, итгэл 3. Migration шаардлагагүй (`profiles` M2-д бэлэн). Тохиргоо руу толгойн профайл icon-оор; MobileNav зорилтот хуудсуудтайгаа хамт нэмэгдэнэ.
- **Төлөв (2026-10-19):** Хэрэгжсэн; lint, typecheck, unit, integration, build, E2E (production build + local Supabase) local дээр давсан. CI-ийн үр дүн — M3-ийн тайланд. Түвшний монгол тайлбар ба UI бичвэрийг багш/бүтээгдэхүүн хянах шаардлагатай.

### M4 — Агуулга ба сургалтын зам
- **Зорилго:** FR-03 (Өнөөдөр картгүй).
- **Хүрээ:** `units`, `scenarios`, `scenario_words` migration + SELECT RLS; `content/scenarios/*.json` + Zod + `scripts/upsert-content` (idempotent, `slug`-аар); **12 сценари (түвшин тутамд 4), багшийн хянасан** (агуулга бичих ажил энэ milestone-тэй зэрэг); `/path`, `ScenarioCard`; `nextScenario()` цэвэр функц.
- **Хүлээн авах шалгуур:** Хэрэглэгч өөрийн түвшний зам ба бүх сценарийг харна; түгжээгүй; скриптийг хоёр удаа ажиллуулахад өөрчлөлтгүй.
- **Тест:** Unit — агуулгын схем (3–6 үг, утга заавал, `intro_en`), `nextScenario()` (бүгд дууссан тохиолдол). Integration — хэрэглэгч агуулга бичиж чадахгүй; `is_active = false` харагдахгүй; upsert idempotent.
- **Төлөв (2026-10-21):** Хэрэгжсэн; `npm run verify` local дээр давсан (CI: unavailable (billing)). **Агуулга `review_status: "draft"`** — багшийн хяналт (`docs/content_review.md`) хүлээгдэж байна; хянагдах хүртэл "багшийн хянасан" шалгуур биелээгүй. Түвшин тутамд 1 бүлэг. "Хийсэн" төлөв M5-ийн `practice_sessions`-оос хойш харагдана; `GET /api/path` хэрэгжээгүй (хуудас Server Component-оос уншина, D-02).

### M5 — Яриа (mock AI) + staging Supabase
- **Зорилго:** FR-04-ийн өгөгдөл ба төлөвийн суурь, бодит AI-гүйгээр; staging орчин.
- **Хүрээ:** `practice_sessions`, `messages`, `session_target_words` (missions-гүйгээр хоосон), `usage_counters`, `ai_usage_events` migration; DB функц `start_session`, `begin_user_turn`, `begin_retry`, `finish_user_turn`, `complete_session` (EXECUTE хаалттай); `AiProvider` интерфейс + `mock`; API (`/api/sessions*`, messages, retry, complete); `/talk/[sessionId]`, `/history` UI (Composer түгжээ, бүх төлөв); **staging Supabase төсөл + Vercel staging, CI-ээр migration deploy**; staging Supabase-ийн Auth тохиргоо: **Email provider асаалттай (ON)**, **"Allow new users to sign up" унтраалттай (OFF)** — `[auth.email] enable_signup = false` нь email provider-ийг бүхэлд нь унтрааж OTP-г хаадаг тул ялгаатай хоёр унтраалга.
- **Хүлээн авах шалгуур:** Ижил `clientMessageId` давхар мессеж/дуудлага үүсгэхгүй; `pending`/`reply_failed` үед шинэ мессеж блоклогдоно; хугацаа хэтэрсэн `pending` гацахгүй; 20 ээлжийн хязгаар; staging дээр mock-оор урсгал ажиллана.
- **Тест:** Unit — `sendMessageSchema`. Integration — `testing.md §3` #1–6, #8–10, #12; зэрэг давхар хүсэлт; `authenticated`-аар DB функц дуудах оролдлого унах. Component — Composer disabled/loading/blocked/error.

### M6 — Бодит LLM, хязгаар, ажиглалт, eval dataset
- **Орох нөхцөл:** Хоёр провайдерыг 20–30 жишээгээр (монгол тайлбарын чанар, зардал, хурд) харьцуулж сонгосон (`prd.md §10`); алдааны хяналтын хэрэгслийг сонгосон (M1-ээс хойшлогдсон).
- **Зорилго:** FR-04 AI хариу, FR-10.
- **Хүрээ:** Сонгосон провайдерын adapter; `conversation.v1`; context builder (`<learner_message>`, танилцуулга, сүүлийн 12); нийт хугацааны төсөв + ≤ 2 оролдлого; `replySchema`; `ai_usage_events`; өдрийн 40 хариуны квот (Asia/Ulaanbaatar); алдааны төлөв UI; **eval dataset цуглуулж эхлэх** (`tests/evals/`, injection, монгол оролт); зардлыг хэмжиж нийт өдрийн төсвийг санал болгох.
- **Хүлээн авах шалгуур:** Провайдер унахад мессеж хадгалагдсан гэж харагдаж "Дахин оролдох" ажиллана; 41 дэх хариу `DAILY_LIMIT_REACHED`; провайдерын түүхий алдаа client-д хүрэхгүй; монгол оролтын зан төлөв шийдэгдсэн.
- **Тест:** Unit — context builder, retry шийдвэр, төсөв. Integration (mock) — timeout → `reply_failed`, квот, `ai_usage_events`-д агуулга байхгүй. E2E — E5. Eval — анхны багц, гараар үнэлэх.

### M7 — Feedback
- **Зорилго:** FR-05.
- **Хүрээ:** `feedback_reports`, `feedback_error_counts`, `corrections` migration; `feedbackSchema` (2–3 strengths, ≤ 5 засвар, `error_tally`, `missions`); серверийн боловсруулалт (`trd.md §3.2`); `feedback.v1`; `claim_feedback`, `save_feedback`, `fail_feedback`; complete/regenerate/GET API; polling (шаардлагатай бол); `/talk/[id]/feedback`, `StrengthCard`, `CorrectionCard`, "Буруу засвар"; eval-д feedback кейсүүд.
- **Хүлээн авах шалгуур:** < 3 мессеж → `skipped`; буруу гаралт хэзээ ч бүтэцтэй feedback болж харагдахгүй; давхар `complete` нэг л LLM дуудлага; 1 + 1 regenerate.
- **Тест:** Unit — схем, `word_count`, `error_count = Σ tally`, индекс буулгалт, `original == corrected`. Integration — `testing.md §3` #7, #13, #14, #18. E2E — E2.

### M8 — Үгсийн сан
- **Зорилго:** FR-06 (missions-гүй).
- **Хүрээ:** `vocabulary_items` (generated `normalized_term`, `meaning_mn` заавал), `vocabulary_reviews` migration; `GET/POST/DELETE /api/words` (cursor, хайлт, төлөв); сценари/засвар/яриа/гараар хадгалах (утгын дүрэм); `/words`, `WordItem`.
- **Хүлээн авах шалгуур:** Давхар хадгалалт "Аль хэдийн хадгалсан"; гараар/ярианаас утгагүй хадгалах боломжгүй.
- **Тест:** Unit — `normalize_term` (TS ба SQL ижил үр дүн). Integration — `testing.md §3` #11, бусдын үгийг устгаж чадахгүй. E2E — E4-ийн хадгалах хэсэг.

### M9 — Word missions
- **Зорилго:** FR-04 missions, PRD-ийн гол ялгарах шинж.
- **Хүрээ:** `start_session` дахь mission сонголт (≤ 2 хэрэглэгчийн үг + сценарийн үг = 3); `save_feedback`-ийн mission ба тоолуурын хэсэг; `WordMissionChip`; feedback дэлгэцийн mission хэсэг.
- **Хүлээн авах шалгуур:** Шинэ хэрэглэгчийн анхны ярианд 3 mission; regenerate давхар тоолохгүй; session-д байхгүй key нөлөөлөхгүй; `active` үг mission болохгүй.
- **Тест:** Unit — сонголтын функц, `applyEvent`. Integration — `testing.md §3` #6, #15, #16. E2E — E3. Eval — хувирсан хэлбэр, mission injection.

### M10 — Hint
- **Зорилго:** FR-04 Hint.
- **Хүрээ:** `hint.v1`, `hintSchema`, `POST .../hint`, `consume_quota` (10/өдөр), `HintSheet`, `used_hint`.
- **Хүлээн авах шалгуур:** Монгол санаа + 1–2 англи жишээ, word missions-ийг ашиглана; 11 дэх hint `DAILY_LIMIT_REACHED`; ээлжийн хязгаарт тоологдохгүй.
- **Тест:** Unit — `hintSchema`. Integration — квот, бусдын session-д hint авч чадахгүй. Component — HintSheet focus. Eval — hint-ийн кейсүүд.

### M11 — Давталт
- **Зорилго:** FR-07.
- **Хүрээ:** `record_review`; `GET /api/review/due` (≤ 10), `POST /api/review/:wordId`; `/review`, `ReviewCard`.
- **Хүлээн авах шалгуур:** Төлөв ба интервал `backend_schema.md §2.5`-ийн хүснэгтийн дагуу; хугацаа болсон үггүй бол empty төлөв.
- **Тест:** Unit — хүснэгтийн мөр бүр (TS). Integration — ижил хүснэгтээр SQL функц; бусдын үгийг давтаж чадахгүй. E2E — E4-ийн давтах хэсэг.

### M12 — "Өнөөдөр" ба ахиц
- **Зорилго:** FR-03 Өнөөдөр карт, FR-08.
- **Хүрээ:** `GET /api/today` (дуусаагүй < 24 цаг → давталт → дараагийн сценари; `abandoned` lazy), `GET /api/progress` (Asia/Ulaanbaatar долоо хоног, feedback-тэй 3+ яриа босго, ойролцоо алдааны тооноос топ 3), `/home`, `/progress`.
- **Хүлээн авах шалгуур:** Өгөгдөл хангалтгүй үед "100 үг тутмын алдаа" нуугдана; "ойролцоо" шошго; CEFR ахисан гэж зарлахгүй.
- **Тест:** Unit — `todaySuggestion()`, progress тооцоо (долоо хоногийн зааг, босго). E2E — E7.

### M13 — Бүртгэл устгах, нууцлалын бодлого, launch checklist
- **Зорилго:** FR-09 устгал; pilot эхлүүлэх бэлэн байдал.
- **Хүрээ:** `account_deletion_requests`, `POST /api/account/deletion-request`, `scripts/delete-account` (7 хоногийн дотор, admin); монгол хэлээр нууцлалын бодлого (хадгалах хугацаа, backup — шалгасан утгаар); launch checklist: production Supabase төсөл (Ази бүс; Auth тохиргоо: **Email provider асаалттай (ON)**, **"Allow new users to sign up" унтраалттай (OFF)** — `[auth.email] enable_signup = false` нь email provider-ийг бүхэлд нь унтрааж OTP-г хаадаг тул ялгаатай хоёр унтраалга), Vercel production, production SMTP, нийт өдрийн AI төсөв тохируулсан, провайдерын зардлын alert, урилгын жагсаалт, **агуулгын файл бүр (`content/units.json`, `content/scenarios/*.json`) `"review_status": "approved"`** ([R-03](./audit/decisions.md)), `prd.md §7` ба `trd.md §8`-ийн шалгуурыг бодитоор шалгаж тайлагнах, pilot хэмжүүрийн өгөгдөл цуглуулах арга шийдэгдсэн.
- **Хүлээн авах шалгуур:** Устгалын дараа хэрэглэгчийн мөр үлдээгүй, `ai_usage_events.user_id = null`; `completed` болохоос өмнө "устгагдсан" гэж харуулахгүй; checklist-ийн бүх мөр шалгагдсан.
- **Тест:** Integration — `testing.md §3` #23. E2E — E6, гол дэлгэцүүдийн axe. Гараар — bundle ба network хариунд нууц байхгүй, production header-ууд. Бүгд **шалгах шаардлагатай**.

---

### P1 — Pilot-ийн дараах ажлууд (pilot-оос өмнө заавал биш)
- `ai_usage_events`-ийн 12 сараас хуучин мөрийг устгах ажил (pilot эхэлснээс 12 сар дотор).
- AI endpoint-ийн IP-д суурилсан rate limit (нийтэд нээхээс өмнө).
- Насанд хүрээгүйчүүд, хуулийн review, нэмэлт moderation.
- Google нэвтрэлт (2-р шат).
- Хойшлуулсан функцууд: шууд засвар, AI мессежийн орчуулга, чөлөөт яриа, LLM-ээр үгийн утга.
- Хүлээлгийн хугацааны (p50/p95) зорилтыг pilot-ийн хэмжилтээр тогтоох.
