# Architecture — Системийн бүтэц

**Холбоос:** [trd.md](./trd.md) · [backend_schema.md](./backend_schema.md) · [security.md](./security.md) · [adr/](./adr/)

---

## 1. Ерөнхий

MVP-д **модульчлагдсан monolith** (ADR-001): нэг Next.js кодын сан, дотроо feature логик, өгөгдлийн хандалт, провайдерын холболтыг тусгаарлана. Хэрэгцээ батлагдахаас өмнө microservice нэвтрүүлэхгүй. Deploy: Vercel + Supabase, нэг Ази бүсэд (`trd.md §6`).

```text
Browser (утас / компьютер)
  │
  ▼
Next.js UI (App Router, Server Components уншина)
  │
  ▼
Route Handlers (/api/*)
  ├─ Нэвтрэлт (Supabase session) ба Origin шалгалт
  ├─ Оролт шалгах (Zod)
  ├─ Conversation service
  │    ├─ Context builder (сценари, түвшин, word missions, сүүлийн N мессеж)
  │    ├─ AI provider adapter (+ mock)
  │    └─ Гаралт шалгах (Zod)
  ├─ Feedback service
  ├─ Vocabulary service (төлөв, давталт)
  ├─ Path service ("Өнөөдөр")
  └─ Progress service
  │
  ├──► Supabase PostgreSQL
  │      ├─ Уншилт: хэрэглэгчийн client, SELECT-only RLS (ADR-004)
  │      └─ Бичилт: server-only service role модуль / DB функц (ADR-005)
  └──► Гадны LLM API (зөвхөн сервер)
```

## 2. Давхаргын дүрэм

| Давхарга | Байршил | Үүрэг | Хориг |
|---|---|---|---|
| UI | `src/app/`, `src/components/` | Харуулах, үйлдэл | Бизнес логик, DB хандалт |
| Server entry | `src/app/api/` | Нэвтрэлт → Origin → Zod → service → хариу | Бизнес логик. Server Actions MVP-д ашиглахгүй (D-02) |
| Feature | `src/features/<name>/` | Бизнес логик (service), цэвэр функц, UI хэсэг | Провайдерын SDK |
| AI | `src/lib/ai/` | Adapter, prompt, схем | Feature логик |
| Data | `src/lib/supabase/`, `src/features/*/data.ts` | Query, DB функц дуудах | UI |

## 3. Хавтасны бүтэц

```
src/
├── app/
│   ├── (public)/  page.tsx  login/
│   ├── (app)/     layout.tsx (session шаардлагатай)  age-confirmation/
│   │   └── (gated)/  layout.tsx (18+ шаардлагатай)  onboarding/
│   │       └── (onboarded)/  layout.tsx (онбординг дууссан байх; AppHeader)  home/  settings/  path/  talk/[sessionId]/
│   │                         talk/[sessionId]/feedback/  history/  words/  review/  progress/
│   └── api/       (backend_schema.md §5)
├── components/
│   └── ui/                    # shadcn primitives
├── features/
│   ├── conversation/          # session, messages, hint, context builder
│   ├── feedback/
│   ├── vocabulary/            # хадгалах, төлөвийн машин, давталт
│   ├── path/                  # зам, "Өнөөдөр"
│   └── progress/
├── lib/
│   ├── ai/
│   │   ├── adapter.ts         # AiProvider интерфейс
│   │   ├── providers/         # <provider>.ts, mock.ts
│   │   ├── prompts/           # conversation.v1.ts, feedback.v1.ts, hint.v1.ts
│   │   └── schemas.ts
│   ├── supabase/
│   │   ├── server.ts          # хэрэглэгчийн session-тэй client — Server Component-ийн уншилт
│   │   ├── route.ts           # хүсэлтээс үүсгэсэн session client — Route Handler (OTP, sign-out)
│   │   └── admin.ts           # service role, "server-only" — бичилт, DB функц
│   ├── env.ts                 # Zod-оор шалгасан env (server ба NEXT_PUBLIC тусдаа)
│   ├── errors.ts              # AppError, withErrorHandling
│   ├── logger.ts              # бүтэцтэй JSON лог
│   ├── origin.ts              # Origin шалгалт (M2)
│   ├── security/              # csp.ts (nonce CSP), headers.ts (статик header)
│   └── validation/
├── i18n/request.ts            # next-intl, routing-гүй, locale = mn
└── proxy.ts                   # хүсэлт бүрт CSP nonce (Next.js 16-ийн middleware)
messages/mn.json               # UI текст (repo root)
content/scenarios/*.json       # сценарийн агуулга (D-11)
scripts/                       # upsert-content, invite-users, delete-account
supabase/  config.toml  migrations/  templates/   # local Supabase (auth тохиргоо, OTP имэйл)
tests/     unit/  integration/  e2e/  evals/  factories/
docs/
```

Жижиг MVP-д хэт хийсвэрлэл хийхгүй; Next.js-ийн тухайн үеийн конвенцид тохируулна.

## 4. Ярианы мессежийн урсгал

1. Хүсэлт ирнэ (`clientMessageId`, `content`, `usedHint`).
2. Origin, body, хэмжээг шалгана (Zod).
3. Итгэлтэй session-оос хэрэглэгчийг тодорхойлно.
4. `begin_user_turn` DB функц (нэг транзакц):
   - `clientMessageId` аль хэдийн байвал → `ok` бол хадгалсан хариуг, `pending` бол `409 IN_PROGRESS`, `reply_failed` бол retryable алдааг буцаана. **Квот хасахгүй.**
   - Session-ийн эзэмшил, `active` төлөв.
   - Өөр `pending`/`reply_failed` мессеж байвал `MESSAGE_BLOCKED`.
   - Ээлжийн хязгаар, өдрийн квот.
   - Хэрэглэгчийн мессежийг `pending` төлөвтэй хадгална.
5. Контекст угсарна (сценари + танилцуулга + түвшин + word missions + сүүлийн N).
6. Провайдер дуудна — `AI_REPLY_DEADLINE_MS` төсөв, ≤ 2 оролдлого (`trd.md §5`).
7. Хариуг `replySchema`-аар шалгана; оролдлого бүрт `ai_usage_events`.
8. `finish_user_turn`: хариу хадгалж мессежийг `ok`, эсвэл `reply_failed`.
9. Аюулгүй, хамгийн бага хариу буцаана (`reply_failed` бол `retryable: true`).

Retry (`/messages/:msgId/retry`): `begin_retry` (`reply_failed` → `pending`, квот) → 5–9-р алхам.

## 5. Feedback урсгал

1. `complete` → `complete_session` (idempotent): session `completed`; хэрэглэгчийн мессеж < 3 бол `feedback_status = 'skipped'` ба дуусна.
2. `claim_feedback`: `none`/`failed` → `pending`, `feedback_attempts + 1` (≤ 2). Аль хэдийн `pending`/`ready` бол одоогийн төлөвийг буцаана — шинэ LLM дуудлагагүй.
3. Хэрэглэгчийн мессежүүд (индекстэй) ба mission-уудыг (`key`-тэй) feedback prompt-оор шинжилнэ — `AI_FEEDBACK_DEADLINE_MS` төсөв, ≤ 2 оролдлого.
4. Zod-оор шалгаж, серверийн боловсруулалт хийнэ (`trd.md §3.2`).
5. `save_feedback` (нэг транзакц): report, error counts, corrections, mission `used`/`used_correctly`, vocabulary тоолуур ба төлөв, `feedback_status = 'ready'`.
6. Амжилтгүй бол `fail_feedback` → `failed`; оролдлого үлдсэн бол UI "Дахин үүсгэх".
7. Vercel function-ийн хугацаа хүрэхгүй бол client `GET /feedback`-ээр polling хийнэ (`trd.md §6`).

## 6. AI provider adapter (ADR-002)

```ts
interface AiProvider {
  reply(input: ReplyInput, opts: CallOptions): Promise<ReplyResult>;
  structured<T>(input: StructuredInput, schema: ZodSchema<T>, opts: CallOptions): Promise<T>;
  // Streaming нэмбэл: replyStream(...) — тусдаа арга, одоогийн интерфейсийг эвдэхгүй
}
```

- Feature код провайдерын хариуны хэлбэрээс хамаарахгүй.
- Провайдер, модель, prompt хувилбарыг `ai_usage_events` ба `feedback_reports`-д хадгална.
- `mock` провайдер (`providers/mock.ts`) тодорхой хариу буцаана; unit/integration/E2E, CI, staging-д ашиглана; `APP_ENV=production` үед хориотой.
- Провайдерын failover-ийг нууцлал, зардал, чанарыг ойлгохоос өмнө нэмэхгүй.
- Провайдерыг M6-аас өмнө хоёр провайдерыг 20–30 жишээгээр харьцуулж сонгоно (`prd.md §10`).

### Prompt удирдлага
- `lib/ai/prompts/<name>.v<N>.ts` — `version`, `build(input)` экспортлоно.
- Prompt өөрчлөх = шинэ хувилбар + eval (`testing.md §5`).

## 7. Өгөгдлийн эзэмшил ба эрх (ADR-004, ADR-005)

- Хэрэглэгчийн мөр бүр `auth.users`-тай шууд эсвэл composite FK-тай эцгээр холбогдоно — өөр хэрэглэгчийн мөр рүү заах боломжгүй.
- **Нэвтрэлт:** browser-т Supabase client байхгүй. OTP илгээх/шалгах, гарах нь Route Handler-ээр (`lib/supabase/route.ts`) — session cookie-г сервер бичнэ (HttpOnly).
- **Уншилт:** `lib/supabase/server.ts` (хэрэглэгчийн session) — RLS зөвхөн өөрийн мөрийг харуулна. Session-ийг `getClaims()`-ээр баталгаажуулна (`getSession()`-д серверт итгэхгүй).
- **Бичилт:** `lib/supabase/admin.ts` (service role) зөвхөн `features/*/data.ts`-ээс импортлогдоно. Нэг мөрийн бичилт `user_id`-аар шүүнэ; олон алхамт бичилт DB функцээр (`backend_schema.md §4.1`).
- `userId` зөвхөн баталгаажсан session-оос; client-ийн ID нь зөвхөн сонголт, эрхийн нотолгоо биш.
- `admin.ts` browser bundle-д орохгүйг (`server-only`) build-ийн шалгалтаар баталгаажуулна.

## 8. Ажиглалт (observability)

- Хүсэлтийн үр дүн, хүлээлгийн хугацаа, провайдер/модель, token, ойролцоо зардал (`ai_usage_events`, 12 сар).
- Алдааны хяналт (`ERROR_MONITORING_DSN`) — хэрэгслийн сонголт хойшлогдсон; бодит AI алдаа гарч эхлэхээс өмнө (M6-аас өмнө) сонгоно. Түр зуур `src/lib/logger.ts` бүтэцтэй JSON лог бичнэ.
- Мессежийн бүрэн агуулга, имэйл, токеныг логлохгүй.
- Логийн хадгалах хугацаа, хандалтын эрхийг нууцлалын бодлогод тодорхойлно.

## 9. 2-р шатны өргөтгөл

- **Дуу хоолой:** `lib/speech/` дотор `SpeechToText`, `TextToSpeech` adapter; урсгал: бичлэг → текст → одоогийн conversation service → TTS. `messages`-д `input_mode` багана нэмэх migration.
- **Google нэвтрэлт:** Supabase OAuth; 18+ баталгаажуулалтын урсгал хэвээр.
- **Түвшний тест:** `features/placement/`
- **FSRS:** `vocabulary` service доторх интервал тооцоог солино; `vocabulary_reviews`-ийн түүх ашиглагдана, үнэлгээний сонголтыг өргөтгөх migration.
- **Background ажил:** долоо хоногийн тайлан, streak сануулга, `ai_usage_events` цэвэрлэгээ (pg_cron эсвэл scheduled function).
- **Багшийн самбар (3-р шат):** байгууллага/гишүүнчлэлийн загвар ба нэмэлт SELECT policy — одоогийн "зөвхөн өөрийн мөр" загварыг нэмэлтээр өргөтгөнө.

## 10. Архитектурын шийдвэрүүд (ADR)

| ADR | Сэдэв |
|---|---|
| [ADR-001](./adr/ADR-001-modular-monolith.md) | Модульчлагдсан monolith |
| [ADR-002](./adr/ADR-002-ai-provider-adapter.md) | AI provider adapter ба mock провайдер |
| [ADR-003](./adr/ADR-003-persist-before-ai.md) | Мессежийг AI дуудахаас өмнө хадгалах, мессежийн төлөвийн машин |
| [ADR-004](./adr/ADR-004-rls-read-only.md) | RLS: хэрэглэгчийн client зөвхөн уншина |
| [ADR-005](./adr/ADR-005-server-write-path.md) | Бичих зам: service role модуль ба хаалттай DB функц |
