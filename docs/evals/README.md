# AI провайдерын харьцуулалт (Q-12)

**Төлөв:** хэрэгсэл бэлэн, бодит ажиллуулалт хийгдээгүй · **Огноо:** 2026-10-21 · **Холбоос:** [testing.md §5](../testing.md), [ADR-002](../adr/ADR-002-ai-provider-adapter.md), [implementation_plan.md M6](../implementation_plan.md)

M6-ийн орох нөхцөл: хоёр провайдерыг 20–30 жишээгээр (монгол тайлбарын чанар, зардал, хурд) харьцуулж сонгох. Нэр дэвшигч: **Anthropic** ба **OpenAI**.

## Бүрэлдэхүүн

| Файл | Үүрэг |
|---|---|
| `tests/evals/cases.json` | 30 зохиомол яриа (3–5 мессеж), хүлээгдэж буй засвар, `error`/`style`, mission-ий хариу. `review_status: "draft"` — багш шалгаагүй |
| `tests/evals/config.json` | Моделийн нэр, effort, max tokens, deadline; үнэ (эх сурвалжийн URL, уншсан огноо) |
| `src/lib/ai/prompts/conversation.v1.ts`, `feedback.v1.ts` | Хоёр провайдерт ижил prompt |
| `src/lib/ai/providers/anthropic.ts`, `openai.ts` | `AiProvider`-ийн adapter. **Зөвхөн eval скриптэд** — ESLint апп кодоос импортлохыг хориглоно; апп mock хэвээр |
| `scripts/eval-providers.mts`, `scripts/eval/` | Ажиллуулагч, оноо, сохор A/B, тайлан |

Сонгосон моделиуд (2026-10-21, албан ёсны баримтаас): `claude-opus-5-5` ($4 / $20 per 1M) ба `gpt-6.1-sol` ($2 / $10). Үнийн түвшин ялгаатай тул ижил үнийн хослол хэрэгтэй бол `EVAL_ANTHROPIC_MODEL=claude-sonnet-5-5` ($2 / $10) — `config.json`-д үнэтэй модель л ажиллана.

## Ажиллуулах

```bash
npm run eval:providers -- --dry-run      # mock, түлхүүргүй → test-results/eval-dry-run/
npm run eval:providers                   # бодит → docs/evals/ (зардалтай)
npm run eval:providers -- --only a1-cafe-correct,b1-meeting-injection-mn   # цөөн кейс
npm run eval:providers -- --seed 1234    # A/B хуваарилалтыг давтах
```

`.env.local`-д `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` (серверийн нууц; `NEXT_PUBLIC_` нэртэй бол скрипт зогсоно). Кейс бүрт хэрэглэгчийн мессеж бүрд нэг reply (провайдерын өөрийн хариу түүх болно), дараа нь бүх мессежид нэг feedback дуудлага. Кейсүүд дараалан, хоёр провайдер зэрэг.

## Гаралт

- `provider-comparison.md` — провайдер тус бүрийн schema-valid %, reply/feedback p50/p95 хугацаа, ярианы дундаж зардал, injection кейс давсан тоо, засварын recall, `error`/`style` шошго, хуурамч алдаа, mission, `error_tally` муж, англиар хариулсан %.
- `blind-review.csv` — кейс бүрт A, B мөр; провайдерын нэргүй. Хүн бөглөх багана: `correctness_1_5`, `mongolian_clarity_1_5`, `labelling_ok_yes_no`, `reviewer_notes`.
- `blind-review.key.json` — A/B → провайдер. **Gitignored**; үнэлгээ дуусахаас өмнө бүү нээ.
- `provider-results.json` — дуудлага бүр: хугацаа, token, зардал, schema-valid, алдаа, гаралт.

## Хүний үнэлгээ

1. CSV-г хүснэгтээр нээж (`=`, `+`, `-`, `@`-ээр эхэлсэн нүдэнд `'` нэмсэн), A/B мөр бүрийг бие даан үнэл.
2. `correctness` — засвар, mission-ий шийдвэр зөв эсэх (5 = бүгд зөв). `mongolian_clarity` — тайлбар ойлгомжтой, эелдэг, "буруу" гэх үггүй эсэх. `labelling_ok` — `style`-ийг `error` гэж хэлээгүй, зөв өгүүлбэрийг засаагүй эсэх.
3. Дууссаны дараа key-гээр провайдер тус бүрийн дунджийг гарга; автомат хэмжүүртэй хамт `decisions.md`-д Q-12-ийн шийдвэрийг бич.

## Анхаарах зүйл

- Автомат оноо ойролцоо (тааруулалт нь хэллэгийн давхцал); шийдвэр хүний оноонд тулгуурлана.
- Гаралт өөрийгөө танилцуулбал ("As Claude…") сохор байдал алдагдана — тэмдэглэлд бич.
- SDK retry унтраалттай (нэг дуудлага = нэг хэмжилт). Амжилтгүй дуудлагын token тоологдохгүй тул тэр провайдерын зардал "–" болно.
- Anthropic-ийн server-side refusal fallback-ийг санаатайгаар асаагаагүй (өөр модель хариулж харьцуулалт гажина); refusal нь `provider_error: refusal` болж бүртгэгдэнэ. M6-д сонгосон бол production adapter-т шийднэ.
- OpenAI дуудлага `store: false`. Провайдерын өгөгдөл хадгалах/сургалтын тохиргоо (`prd.md §10`) **шалгах шаардлагатай** хэвээр.
- Монгол оролтын зан төлөв (`conversation.v1`): англиар хариулж, англи хувилбарыг өгч, англиар оролдохыг урина — нэр дэвшигч, eval-ийн дараа батлана.
