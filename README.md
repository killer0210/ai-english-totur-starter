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

1. Сонгосон Next.js хувилбарт тохирох Node.js LTS
2. Git
3. Supabase төсөл (эсвэл Supabase CLI + Docker — local)
4. Сервер дээр хадгалах AI провайдерын API түлхүүр
5. `.env.local` нь `.gitignore`-д

## Суулгах

`package.json`, `.env.example` хэрэгжсэний дараа хүчинтэй:

```bash
npm install
cp .env.example .env.local   # утгуудыг бөглө
npm run dev
```

## Шалгах

Скриптүүдийг `package.json`-д нэмсний дараа:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:int
npm run test:e2e
npm run eval
```

Жагсаалт нь [docs/testing.md §6](docs/testing.md)-тэй ижил; скрипт бий болох үед энэ хэсгийг бодит `package.json`-той тулгана.

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
