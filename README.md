# SpeakMate (Ярилцъя)

Монгол хэлтэй хүмүүст англиар **ярьж** сурахад туслах AI дасгалжуулагч. Нэр түр зуурынх.

- **AI ярилцагч** — хэн ч сонсохгүй орчинд бодит нөхцөлд дасгал
- **Аюулгүй засвар** — ярианы дараа, монгол тайлбартай, шүүмжлэлгүй
- **Word missions** — цээжилсэн үгээ ярианд хэрэглэх даалгавар
- **Сургалтын зам** — түвшин, зорилгод тохирсон сценарийн дараалал
- **Ахиц** — идэвхтэй үг, 100 үг тутмын алдаа, давтагддаг алдааны төрөл

> **Одоогийн төлөв:** энэ багц нь шаардлага ба төлөвлөлтийн баримт бичиг. Ажилладаг аппын код хараахан байхгүй. Хэрэгжүүлэх дараалал: [docs/implementation_plan.md](docs/implementation_plan.md).

---

## Үе шат

| Шат | Агуулга |
|---|---|
| Pilot | Урилгаар, 20–50 хэрэглэгч, 18+ |
| 1 — MVP | Текстэн яриа, feedback, word missions, үгсийн сан, энгийн давталт, сургалтын зам, ахиц |
| 2 | Дуу хоолой, Google нэвтрэлт, түвшин тогтоох тест, FSRS, streak, долоо хоногийн тайлан |
| 3 | Дуудлагын үнэлгээ, хүнтэй ярилцах, багшийн самбар |

## Стек

Next.js (App Router) · TypeScript · Tailwind + shadcn/ui · Supabase (PostgreSQL, Auth — имэйл OTP) · Zod · серверийн AI provider adapter · Vitest · Testing Library · Playwright · ESLint · Prettier · Vercel

Хувилбарын дугаарыг хэрэгжүүлэх үед албан ёсны баримтаар шалгана; таамаглаж бүү бич.

## Урьдчилсан нөхцөл

1. Node.js 24 LTS (`.nvmrc`) ба npm
2. Git
3. Docker (local Supabase-д; M2-оос заавал) — Supabase CLI нь `npm ci`-ээр devDependency болж суугдана
4. M6-аас: AI провайдерын API түлхүүр

## Суулгах

```bash
npm ci
cp .env.example .env.local
npm run db:start              # local Supabase (migration, auth тохиргоо)
npm run --silent db:env >> .env.local
npm run content:sync          # content/ → units, scenarios, scenario_words (idempotent)
```

`.env.local`-д дараах M1 утгуудыг нэмнэ (Supabase-ийн утгуудыг дээрх тушаал бичнэ):

```
APP_ENV=local
AI_PROVIDER=mock
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Урилгатай хэрэглэгч нэмэх (нийтийн бүртгэл хаалттай), дараа нь http://localhost:3000/login-оор нэвтэрнэ. Нэвтрэх кодыг http://127.0.0.1:54324 (local имэйл барих сервер) дээрээс харна:

```bash
npm run invite -- you@example.com
npm run dev                   # http://localhost:3000
```

Тохиргоо дутуу эсвэл буруу бол (жишээ нь `APP_ENV` байхгүй, эсвэл `APP_ENV=production` + `AI_PROVIDER=mock`) `dev`, `build`, `start` нь хувьсагчийн нэрийг заасан `EnvValidationError`-оор зогсоно.

## Шалгах

```bash
npm run lint
npm run format:check
npm run typecheck
npm test                          # unit
npm run test:int                  # integration — local Supabase ажиллаж байх ёстой
npm run build
npx playwright install chromium   # нэг удаа (Linux-д системийн сан дутвал: --with-deps)
npm run test:e2e                  # production build + local Supabase
                                  # :3000 завгүй бол: NEXT_PUBLIC_SITE_URL=http://localhost:3100 npm run build && E2E_PORT=3100 npm run test:e2e
npm run check:contrast            # design token-ийн contrast хүснэгт
npm run content:review            # docs/content_review.md-г content/-оос дахин үүсгэнэ
npm run db:reset                  # DB-г цэвэрлээд агуулгыг дахин sync хийнэ
npm run db:stop
```

`eval` (M6) скрипт тухайн milestone-д нэмэгдэнэ. CI (`.github/workflows/ci.yml`): secret scan (gitleaks) ‖ Supabase start → lint → typecheck → test → contrast → integration → build → e2e. GitHub Actions одоогоор billing-ээр түгжигдсэн тул ижил шалгалтыг `npm run verify`-гаар local-д ажиллуулна (`docs/testing.md §6–7`).

## Баримт бичиг

| Файл | Агуулга |
|---|---|
| [docs/prd.md](docs/prd.md) | Бүтээгдэхүүн: асуудал, хүрээ, шаардлага, хэмжүүр |
| [docs/trd.md](docs/trd.md) | Техникийн шаардлага, AI-ийн дүрэм |
| [docs/app_flow.md](docs/app_flow.md) | Дэлгэц, урсгал, алдааны төлөв |
| [docs/architecture.md](docs/architecture.md) | Модуль, хавтас, хүсэлтийн урсгал |
| [docs/backend_schema.md](docs/backend_schema.md) | DB схем, RLS, API |
| [docs/design_system.md](docs/design_system.md) | Өнгө, фонт, компонент, UX бичвэр |
| [docs/security.md](docs/security.md) | Аюулгүй байдал, нууцлал |
| [docs/code_style.md](docs/code_style.md) | Код бичих дүрэм |
| [docs/testing.md](docs/testing.md) | Тест, AI eval |
| [docs/implementation_plan.md](docs/implementation_plan.md) | Milestone-ууд, pilot-оос өмнө заавал хийх ажил |
| [docs/adr/](docs/adr/) | Архитектурын шийдвэрүүд (ADR-001…005) |
| [docs/audit/](docs/audit/) | Баримтын аудит ба шийдвэрийн төлөв |
| [AGENTS.md](AGENTS.md) | AI кодлогч агентын заавар |

## Бүтээх зарчим

- Шаардлага бүрийг тестээр баталгаажуул.
- Тестийг ажиллуулаагүй бол амжилттай гэж бүү мэдэгд.
- AI-ийн засварыг алдаагүй гэж бүү үз.
- Баримтууд зөрчилдвөл зогсож, тодруул.
