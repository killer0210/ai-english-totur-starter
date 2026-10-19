# ADR-002 — AI provider adapter ба mock провайдер

**Төлөв:** Батлагдсан · **Огноо:** 2026-10-19 · **Холбоос:** [architecture.md §6](../architecture.md), [trd.md §3, §5](../trd.md), D-13

## Нөхцөл

LLM провайдер ба модель хараахан сонгогдоогүй (M6-аас өмнө хоёр провайдерыг 20–30 жишээгээр харьцуулна). Тест, CI-д бодит провайдер дуудахгүй. Провайдерын SDK-ийн хэлбэр feature код руу нэвчих ёсгүй.

## Шийдвэр

- `src/lib/ai/adapter.ts` дахь `AiProvider` интерфейс (`reply`, `structured`). Провайдерын SDK зөвхөн `src/lib/ai/providers/` дотор.
- `AI_PROVIDER` env-ээр сонгоно; моделийн нэр env-д (`AI_MODEL_CONVERSATION`, `AI_MODEL_FEEDBACK`, `AI_MODEL_HINT`).
- `providers/mock.ts`: тодорхой (deterministic) хариу, алдаа/timeout/буруу гаралтыг тохируулж болно. Unit, integration, E2E, CI, staging-д ашиглана. `APP_ENV=production` үед `AI_PROVIDER=mock` бол апп эхлэхгүй (`src/lib/env.ts`). `NODE_ENV`-ийг ашиглахгүй — `next build`/`next start` үргэлж `NODE_ENV=production` тул CI-ийн E2E mock ажиллах боломжгүй болно.
- Бүх гаралтыг Zod-оор шалгана (`replySchema`, `feedbackSchema`, `hintSchema`).
- Нийт хугацааны төсөв (reply 25 сек, feedback 60 сек), операц тутамд ≤ 2 оролдлого; retry зөвхөн timeout, сүлжээ, 429, 5xx.
- Prompt: `src/lib/ai/prompts/<name>.v<N>.ts`; өөрчлөлт = шинэ хувилбар + eval.
- Оролдлого бүрийг `ai_usage_events`-д (провайдер, модель, prompt хувилбар, token, хугацаа, төлөв) — агуулгагүй.

## Үр дагавар

- Провайдер солиход зөвхөн `providers/` ба env өөрчлөгдөнө.
- Streaming нэмбэл тусдаа `replyStream` арга — одоогийн интерфейс эвдрэхгүй.
- Failover (олон провайдер) нууцлал, зардал, чанарыг ойлгохоос өмнө нэмэхгүй.
- Mock нь бодит загварын чанарыг хэмжихгүй — чанарыг eval dataset (M6-аас) хариуцна.
