# ADR-005 — Бичих зам: service role модуль ба хаалттай DB функц

**Төлөв:** Батлагдсан (D-03, өөрчилсөн хувилбар) · **Огноо:** 2026-10-19 · **Холбоос:** [backend_schema.md §4.1](../backend_schema.md), [architecture.md §7](../architecture.md), [security.md §3](../security.md), audit C-01, C-02, C-04, C-05

## Нөхцөл

ADR-004-ийн дагуу хэрэглэгчийн client бичих эрхгүй. Бичилтийн хоёр төрөл бий:
1. Нэг мөрийн энгийн бичилт (profile засах, үг хадгалах/устгах, засварыг тэмдэглэх, устгах хүсэлт).
2. Олон алхамт, атомар байх ёстой бичилт (мессежийн idempotency + квот + ээлж; feedback + засвар + mission + үгийн тоолуур; session + mission үүсгэх; давталт + төлөв).

## Шийдвэр

**Нэг мөрийн бичилт:**
- `src/lib/supabase/admin.ts` — service role client, `import "server-only"`; зөвхөн `src/features/*/data.ts`-ээс импортлогдоно (ESLint дүрэм).
- Бичилт бүр `userId`-г зөвхөн баталгаажсан session-оос авч, `where user_id = :userId` (эсвэл `id = :userId`) нөхцөлтэй. Эзэмшлийн шалгалтыг integration тестээр хамарна.

**Олон алхамт бичилт — Postgres функц:**
- `start_session`, `begin_user_turn`, `begin_retry`, `finish_user_turn`, `consume_quota`, `complete_session`, `claim_feedback`, `save_feedback`, `fail_feedback`, `record_review` (`backend_schema.md §4.1`).
- `security invoker`, `set search_path = ''`, эхний параметр `p_user_id`; эзэмшлийг функц дотор шалгана.
- `revoke execute on function ... from public, anon, authenticated; grant execute ... to service_role;` Supabase-ийн default privilege-ийг migration-д хаана (шалгах шаардлагатай).
- Зөвхөн сервер `admin.ts`-ээр (`rpc`) дуудна.

## Үр дагавар

- Service role RLS-ийг тойрох тул эзэмшлийн шалгалт кодын болон функцийн хариуцлага — тест заавал (`testing.md §3 #4–6`).
- Атомар байдал DB транзакцаар хангагдана; давхар/зэрэг хүсэлт давхар бичилт үүсгэхгүй.
- Бизнес дүрмийн нэг хэсэг (квот, ээлж, төлөвийн шилжилт) SQL-д байрлана — цэвэр TS функцтэй (`features/vocabulary`) зөрөхгүйн тулд хоёуланг ижил тестийн хүснэгтээр шалгана.
- Функцийн өөрчлөлт = шинэ migration (`create or replace`), хуучин migration-ийг засахгүй.
