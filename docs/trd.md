# TRD — Техникийн шаардлага

**Холбоос:** [prd.md](./prd.md) · [architecture.md](./architecture.md) · [backend_schema.md](./backend_schema.md) · [adr/](./adr/)

Энэ баримт PRD-г давтахгүй; хэрэгжүүлэх техникийн хязгаарыг тодорхойлно.

---

## 1. Стек

| Давхарга | Сонголт |
|---|---|
| Frontend | Next.js (App Router) + TypeScript (strict) |
| UI | Tailwind CSS + shadcn/ui |
| Client төлөв | React Server Components; TanStack Query-г зөвхөн шалтгаантай нэмнэ |
| Backend | Next.js Route Handlers (мутаци ба AI); Server Components уншина. Server Actions MVP-д ашиглахгүй (D-02) |
| Өгөгдлийн сан | Supabase PostgreSQL |
| Нэвтрэлт | Supabase Auth — имэйл OTP (6 оронтой код); Google нэвтрэлт 2-р шатанд |
| Validation | Zod |
| LLM | Сервер талын provider adapter (`lib/ai/`), тест/CI-д `mock` провайдер (D-13) |
| i18n | `next-intl` routing-гүй (ганц монгол хэл) |
| Тест | Vitest, React Testing Library, Playwright. MSW-г зөвхөн шалтгаантай нэмнэ (AI-г mock провайдер орлоно) |
| Чанар | ESLint, Prettier |
| Hosting | Vercel + Supabase, хоёулаа хамгийн ойрын Ази бүсэд (§6) |
| 2-р шат | STT / TTS провайдер (adapter-ээр) |

**Хувилбарын дугаар бичихгүй.** Хэрэгжүүлэх үед албан ёсны баримтаар одоогийн тогтвортой хувилбарыг шалгаж, `package.json`-д тэмдэглэнэ. Моделийн нэрийг кодонд биш, орчны хувьсагчид хадгална.

## 2. Аппликэйшний шаардлага

- Default нь server component; client component зөвхөн интерактив хэсэгт.
- Хамгаалагдсан бүх үйлдэл сервер дээр.
- Бүх итгэлгүй оролт ба AI-ийн гаралтыг Zod-оор шалгана.
- Нэгдсэн алдааны формат (`backend_schema.md §5`).
- Провайдерын SDK зөвхөн `lib/ai/` дотор; бусад код зөвхөн adapter интерфейсийг мэднэ.
- DB уншилт: хэрэглэгчийн session-тэй client (SELECT-only RLS). DB бичилт: server-only service модуль эсвэл DB функц (ADR-004, ADR-005).

## 3. AI-тай ажиллах шаардлага

### 3.1 Ярианы ээлж
- Контекст: system prompt (сценарийн `role_context`, хэрэглэгчийн түвшин, word missions, хариултын урт ≤ 3 өгүүлбэр) + `scenarios.intro_en` + сүүлийн N мессеж (default 12).
- Хэрэглэгчийн текстийг тодорхой тэмдэглэгээнд (`<learner_message>`) хийж, system заавраас тусгаарлана.
- Провайдерт хэрэглэгчийн имэйл, нэр илгээхгүй.
- Хариуны шалгалт: `replySchema = z.object({ text: z.string().trim().min(1).max(600) })`; plain text-ээр render.
- Хэрэглэгч монголоор бичсэн үед AI-ийн зан төлөв — **нээлттэй** (`prd.md §10`), prompt ба eval-ээр M6-д тогтооно.
- Streaming хариу (SSE) — эхний хувилбарт заавал биш; нэмбэл adapter-т тусдаа `replyStream` арга нэмнэ.

### 3.2 Feedback
- `complete` үед хэрэглэгчийн мессеж ≥ 3 бол хэрэглэгчийн бүх мессежийг нэг хүсэлтээр шинжилнэ.
- Prompt-д хэрэглэгчийн мессежийг `[0]..[n-1]` индексээр, mission-уудыг `key` (1–3)-аар жагсаана.
- Structured output, Zod схем:

```ts
const errorCategory = z.enum(["grammar", "tense", "article", "preposition",
                              "word_order", "vocabulary", "other"]);

const feedbackSchema = z.object({
  strengths_mn: z.array(z.string().min(1).max(300)).min(2).max(3),
  corrections: z.array(z.object({
    message_index: z.number().int().nonnegative(),   // хэрэглэгчийн мессежийн индекс
    original: z.string().min(1),
    corrected: z.string().min(1),
    explanation_mn: z.string().min(1),
    kind: z.enum(["error", "style"]),
    category: errorCategory,
  })).max(5),
  error_tally: z.array(z.object({                     // бүх алдааны ойролцоо тоо
    category: errorCategory,
    count: z.number().int().positive(),
  })),
  missions: z.array(z.object({
    key: z.number().int().min(1).max(3),
    used: z.boolean(),
    used_correctly: z.boolean(),
  })),
});
```

- **Серверийн боловсруулалт** (unit тестээр хамрагдана):
  - `word_count`-ийг LLM биш, сервер тооцно: хэрэглэгчийн мессеж дэх англи үгийн токен (`[A-Za-z]+(['’][A-Za-z]+)?`).
  - `error_count = Σ error_tally.count`. Категори бүрийн тоо нь тухайн категорийн `kind = "error"` засварын тооноос багагүй байхаар дээш тохируулна.
  - `message_index` хүрээнээс гадуур эсвэл `original` нь тухайн мессежид олдохгүй бол засварыг хадгалж `message_id = null`; `original == corrected` бол хаяна; `error_tally`-д ижил категори давхардвал нэгтгэнэ.
  - `missions`: тухайн session-д байхгүй `key`-г хаяна; давхардсан `key`-ийн эхнийхийг авна; `used_correctly = true` бол `used = true`. Үгийн хэлбэр өөрчлөгдөх (go/went)-ийг сервер substring-ээр шалгахгүй — eval dataset хамарна (`testing.md §5`).
  - Засваруудыг prompt-ийн дүрмээр эрэмбэлнэ: `error`-ийг `style`-ээс өмнө, давтагддаг категорийг тэргүүнд.
- Шалгалт амжилтгүй → нэг удаа дахин оролдох (§5-ийн нийт оролдлогын хязгаар дотор) → амжилтгүй бол `feedback_status = 'failed'`. Буруу гаралтыг хадгалах, харуулахгүй; түүхий JSON-ийг хадгалахгүй (D-06).

### 3.3 Hint
- Сценари, сүүлийн мессежүүд, word missions-ийг ашиглан монгол санаа + 1–2 англи жишээ.
- `hintSchema = z.object({ idea_mn: z.string().min(1), examples_en: z.array(z.string().min(1)).min(1).max(2) })`.
- Hint хадгалагдахгүй; өдрийн hint квотод (10) тоологдоно, ээлжийн хязгаарт тоологдохгүй.

### 3.4 Хязгаар
- Оролт: мессеж ≤ 1000 тэмдэгт (хоосон/зөвхөн зай хориотой).
- Гаралт: операц тус бүрийн max tokens env-ээр.
- Хэрэглэгчийн өдрийн хязгаар (Asia/Ulaanbaatar өдөр): AI хариу 40, hint 10. Хариуны квотод хэрэглэгчийн илгээлт ба гар retry тоологдоно; давхардсан хүсэлт, дотоод transport retry тоологдохгүй.
- Feedback: session тутамд 1 + 1 regenerate; өдрийн хязгаарт хаагдахгүй.
- Ээлжийн хязгаар: 20 хэрэглэгчийн мессеж.
- Нийт (global) өдрийн төсвийг M6-д зардлыг хэмжсэний дараа тогтооно (`AI_GLOBAL_DAILY_LIMIT`).
- Хэрэглэгчийн өгөгдлийг сургалт, хоёрдогч зорилгод ашиглахгүй — сонгосон провайдерын тохиргоог **шалгах шаардлагатай**.

## 4. Өгөгдөл ба API

- PostgreSQL — хэрэглэгчийн өгөгдлийн цорын ганц эх сурвалж.
- UUID primary key, `timestamptz` (UTC).
- Foreign key (эзэмшлийн composite FK), constraint, бодит query-д тулгуурласан index.
- Эзэмшлийг сервер дээр шалгана; RLS нь уншилтыг хамгаална.
- Migration-ээр хувилбарлана; агуулгыг `content/` + upsert скриптээр (D-11).
- Ярианы түүх, үгийн жагсаалтыг cursor pagination-тай.
- Client-ээс ирсэн `user_id`-д хэзээ ч итгэхгүй.

## 5. Гүйцэтгэл ба найдвартай байдал

- **Нийт хугацааны төсөв:** reply ≤ 25 сек (`AI_REPLY_DEADLINE_MS`), feedback ≤ 60 сек (`AI_FEEDBACK_DEADLINE_MS`). Нэг дуудлагын timeout `AI_TIMEOUT_MS`.
- **Оролдлого:** операц тутамд нийт ≤ 2 провайдерын дуудлага (transport retry эсвэл схемийн retry — аль нь ч нийлбэрт тоологдоно), төсөв дотор.
- Retry хийх алдаа: timeout, сүлжээ, HTTP 429, 5xx. Бусад 4xx, auth алдаанд retry хийхгүй.
- Оролдлого бүрийг `ai_usage_events`-д (`attempt`) бичнэ — нууцгүй, мессежийн агуулгагүй.
- Ярианы контекстийг хязгаарлана (сүүлийн N).
- Давхар хүсэлтээс сэргийлэх: хэрэглэгчийн мессеж бүр client-ийн үүсгэсэн `client_message_id`-тэй (заавал); давхардлыг квот, rate limit-ээс **өмнө** танина (ADR-003).
- Rate limit: хэрэглэгчээр, DB тоолуураар (`usage_counters`, Redis-гүй). Нэг session-д `pending` мессеж байхад шинэ мессеж хүлээж авахгүй тул хурдан давтан дуудлагыг мөн хязгаарлана. IP-ээр хязгаарлах нь урилгаар pilot-д хүлээн зөвшөөрсөн эрсдэл; нийтэд нээхээс өмнө эргэн харна.
- Хүлээлгийн хугацааны зорилтыг (p50/p95) pilot-ийн хэмжилтийн дараа тогтооно.

## 6. Орчин ба deploy

- **Hosting:** Vercel (app) + Supabase (DB, Auth), хоёулаа хамгийн ойрын боломжит Ази бүсэд, нэг бүсэд. Бүсийн боломжийг **шалгах шаардлагатай**.
- Vercel function-ийн хамгийн их хугацаа нь feedback route-ийн 60 сек төсвийг хангах эсэхийг **шалгах шаардлагатай**; хангахгүй бол feedback-ийг `pending` + client polling-оор хэрэгжүүлнэ.
- Орчин: local (Supabase CLI), staging (тусдаа Supabase төсөл, M5-аас), production (тусдаа Supabase төсөл, M13).
- Нууц Git-д болон client bundle-д орохгүй; CI-д secret scanning (M1).
- CI: lint, typecheck, unit/integration тест, build, mock AI-тай E2E.
- Migration-ийг CI-ээр staging-д, гараар батлагдсаны дараа production-д deploy хийнэ. Rollback = forward-fix migration (expand/contract); app-ийг Vercel-ийн өмнөх deployment руу буцаана.
- Имэйл OTP: production-д өөрийн SMTP шаардлагатай эсэх, хязгаар, имэйл template-д 6 оронтой код харуулах тохиргоог **шалгах шаардлагатай**.

### Орчны хувьсагч (`.env.example`)

Эхлэхэд `src/lib/env.ts` Zod-оор шалгана; серверийн ба `NEXT_PUBLIC_` хувьсагчийг тусад нь. `AI_PROVIDER=mock` нь production-д хориотой (эхлэхэд алдаа).

```
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=        # нэр нь Supabase-ийн түлхүүрийн загвараас хамаарна (шалгах)
SUPABASE_SERVICE_ROLE_KEY=            # зөвхөн сервер
AI_PROVIDER=                          # <provider> | mock
AI_API_KEY=                           # зөвхөн сервер
AI_MODEL_CONVERSATION=
AI_MODEL_FEEDBACK=
AI_MODEL_HINT=
AI_MAX_OUTPUT_TOKENS_REPLY=
AI_MAX_OUTPUT_TOKENS_FEEDBACK=
AI_MAX_OUTPUT_TOKENS_HINT=
AI_TIMEOUT_MS=
AI_REPLY_DEADLINE_MS=25000
AI_FEEDBACK_DEADLINE_MS=60000
LIMIT_REPLIES_PER_DAY=40
LIMIT_HINTS_PER_DAY=10
LIMIT_FEEDBACK_ATTEMPTS_PER_SESSION=2
CONVERSATION_MAX_TURNS=20
AI_GLOBAL_DAILY_LIMIT=                # M6-ийн хэмжилтийн дараа
ERROR_MONITORING_DSN=
LOG_LEVEL=info
```

## 7. Fallback

| Үйлчилгээ | Унасан үед |
|---|---|
| LLM (reply) | Төсөв дотор retry → мессеж `reply_failed` → "Таны мессеж хадгалагдсан. Хариу ирсэнгүй." + "Дахин оролдох" |
| Feedback | Session `completed` хэвээр, `feedback_status = 'failed'`; оролдлого үлдсэн бол "Дахин үүсгэх" |
| DB | Амжилттай гэж хэзээ ч хариулахгүй |

## 8. Техникийн хүлээн авах шалгуур

- [ ] `lint`, `typecheck`, тестүүд баримтжуулсан командаар ажиллана.
- [ ] Провайдерын нууц түлхүүр, service role browser bundle-д, `NEXT_PUBLIC_` хувьсагчид байхгүй.
- [ ] Буруу хүсэлт аюулгүй алдаагаар татгалзагдана.
- [ ] AI гаралт схемээр шалгагдсаны дараа л бүтэцтэй feedback болж хадгалагдана.
- [ ] Хэрэглэгч хоорондын хандалтын тест (API ба anon client-ээр шууд) бий.
- [ ] `authenticated` хэрэглэгч хүснэгтэд шууд бичиж, DB функц дуудаж чадахгүй.
- [ ] Давтан илгээлт давхар мессеж, давхар AI дуудлага үүсгэхгүй.
- [ ] Feedback дахин үүсгэхэд үгийн тоолуур давхар нэмэгдэхгүй.
