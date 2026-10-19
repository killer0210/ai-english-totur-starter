# ADR-003 — Мессежийг AI дуудахаас өмнө хадгалах; мессеж ба feedback-ийн төлөвийн машин

**Төлөв:** Батлагдсан · **Огноо:** 2026-10-19 · **Холбоос:** [backend_schema.md §2.3–2.4](../backend_schema.md), [architecture.md §4–5](../architecture.md), D-04, audit C-04, C-05

## Нөхцөл

AI дуудлага удаан, амжилтгүй болж болно. PRD (FR-10) нь хэрэглэгчийн мессеж хадгалагдсан эсэхийг шударгаар харуулж, давтан илгээлт давхар мессеж/AI дуудлага үүсгэхгүй байхыг шаардана. Хуучин загварт `ok`/`reply_failed` гэсэн хоёр төлөв л байсан тул function тасарвал мессеж гацаж, давхар хүсэлтэд юу буцаах нь тодорхойгүй байсан.

## Шийдвэр

**Мессеж:**
- Хэрэглэгчийн мессежийг AI дуудахаас **өмнө** `pending` төлөвтэй хадгална → `ok` | `reply_failed`.
- `client_message_id` хэрэглэгчийн мессежид заавал; `unique (session_id, client_message_id)`.
- Assistant мессеж `reply_to_message_id`-аар хэрэглэгчийн мессежтэй холбогдоно; `unique (reply_to_message_id)`.
- Давхардлыг квот ба rate limit-ээс **өмнө** танина: `ok` → хадгалсан хариу; `pending` → `409 IN_PROGRESS`; `reply_failed` → retryable алдаа.
- Session-д `pending`/`reply_failed` мессеж байвал шинэ мессеж хүлээж авахгүй (`MESSAGE_BLOCKED`); "Дахин оролдох" л боломжтой.
- Хугацаа хэтэрсэн `pending` (`AI_REPLY_DEADLINE_MS × 2`) нь уншихад/бичихэд `reply_failed` болно (lazy, cron-гүй).
- Дараалал `seq` (identity)-аар.

**Feedback** (`practice_sessions.feedback_status`):
- `none` → `skipped` (хэрэглэгчийн мессеж < 3) | `pending` → `ready` | `failed`.
- `complete` idempotent; `claim_feedback` нь нөхцөлт update-аар нэг л LLM дуудлагыг зөвшөөрнө; `feedback_attempts ≤ 2` (1 + 1 regenerate).
- `save_feedback` нэг транзакцаар report, засвар, mission, vocabulary тоолуурыг бичнэ; тоолуур нь зөвхөн `used_correctly`-ийн `false → true` шилжилт дээр нэмэгдэнэ.
- Хугацаа хэтэрсэн `pending` (120 сек) нь `failed` болно (lazy).

## Үр дагавар

- Сүлжээ тасарсан ч хэрэглэгчийн текст алдагдахгүй; client ижил `client_message_id`-тэй дахин илгээж болно.
- Нэг session-д нэг зэрэг нэг л AI хариу явна — давтан дарах нь зардал үүсгэхгүй.
- Олон алхамт бичилт DB функцээр хийгдэнэ (ADR-005).
- Polling (`GET /feedback`) шаардлагатай байж болно (Vercel function-ийн хугацаанаас хамаарна).
