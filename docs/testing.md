# Testing — Тестийн стратеги

**Холбоос:** [code_style.md](./code_style.md) · [trd.md](./trd.md)

---

## 1. Зорилго

Хэрэглэгчийн урсгал ажиллаж, AI-ийн хариуг аюулгүй боловсруулж, хэрэглэгчийн өгөгдөл бүртгэл хооронд гарахгүйг баталгаажуулна. Тодорхой (deterministic) логикийг тестлэнэ; LLM ижил текст буцаана гэж бүү таамагла.

## 2. Түвшнүүд

| Түвшин | Хэрэгсэл | Юуг |
|---|---|---|
| Unit | Vitest | Схем, оролтын хязгаар, feedback parse, үг normalize, үгийн төлөвийн шилжилт, давталтын интервал, ахицын тооцоо, алдааны mapping, retry шийдвэр |
| Component | Vitest + Testing Library | Composer (disabled/loading/error), CorrectionCard, WordMissionChip, үг хадгалах төлөв, empty/error дэлгэц, label, гарнаас удирдах |
| Integration | Vitest + Supabase local + `mock` AI провайдер | Нэвтрэлттэй handler, DB хадгалалт, DB функц, эзэмшил, RLS (API ба anon client-ээр шууд), хязгаар, провайдерын алдаа, давхар/зэрэг хүсэлт |
| E2E | Playwright + `mock` AI провайдер | Гол урсгалууд (доор) |
| AI eval | Тусдаа dataset + хүний шалгалт | Засвар, тайлбар, hint-ийн чанар; провайдерын харьцуулалт |

AI-г `lib/ai/providers/mock.ts` орлоно (D-13); MSW-г зөвхөн шалтгаантай нэмнэ.

Coverage-ийн зорилт: `features/*/` service-ийн логикт өндөр (жишээ нь ≥ 80%) — анхны санал, багаараа тохируулна.

## 3. Заавал тестлэх тохиолдлууд

1. Хоосон / зөвхөн зайтай мессеж татгалзагдана.
2. Хэт урт (> 1000) мессеж сервер дээр татгалзагдана.
3. Нэвтрээгүй хүсэлт session үүсгэж/уншиж чадахгүй; 18+ баталгаажуулаагүй, онбординг дуусаагүй хэрэглэгч зохих хуудас руу чиглэнэ.
4. A хэрэглэгч B-ийн session, мессеж, feedback, засвар, үг, давталтыг уншиж/өөрчилж/устгаж чадахгүй — API-гаар болон anon түлхүүртэй Supabase client-ээр шууд.
5. `authenticated` хэрэглэгч ямар ч хэрэглэгчийн хүснэгтэд шууд `insert`/`update`/`delete` хийж, DB функц (`begin_user_turn` г.м.) дуудаж чадахгүй.
6. Өөр хэрэглэгчийн мөр рүү заасан FK-тай мөр (жишээ нь B-ийн үгийг A-ийн mission болгох) DB түвшинд татгалзагдана.
7. Буруу бүтэцтэй AI гаралт бүтэцтэй feedback болж харагдахгүй.
8. Провайдерын timeout аюулгүй, сэргээх боломжтой алдаа буцаана; хэрэглэгчийн мессеж `reply_failed`-аар хадгалагдана; хугацаа хэтэрсэн `pending` нь `reply_failed` болно.
9. Ижил `client_message_id`-тэй давтан илгээлт (дараалсан ба зэрэг) давхар мессеж, давхар AI дуудлага үүсгэхгүй, квот хасахгүй.
10. `pending`/`reply_failed` мессеж байхад шинэ мессеж `MESSAGE_BLOCKED`.
11. Давхар үг хадгалалт идэмпотент ("Аль хэдийн хадгалсан").
12. Дууссан session-д мессеж нэмэх боломжгүй; 21 дэх ээлж `TURN_LIMIT_REACHED`.
13. Хэрэглэгчийн мессеж < 3 бол feedback үүсгэхгүй (`skipped`).
14. Давхар/зэрэг `complete` ба `regenerate` нэг л LLM дуудлага; `feedback_attempts ≤ 2`.
15. **Word missions:** feedback-ийн `missions` → тухайн session-ий `key` л хүлээн авагдана; `used_correctly` → `used_in_conversation_count` session тутамд ≤ +1, 2 хүрэхэд `active`; regenerate давхар нэмэхгүй.
16. Шинэ хэрэглэгчийн анхны session 3 mission-тай (сценарийн үгс); `active` үг mission болохгүй.
17. Давталт: `backend_schema.md §2.5`-ийн төлөвийн хүснэгтийн мөр бүр.
18. `error_count = Σ error_tally`; `word_count`-ийг сервер тооцно; `message_index` хүрээнээс гадуур бол `message_id = null`; `original == corrected` хаягдана.
19. Өдрийн хязгаар: 41 дэх хариу, 11 дэх hint `DAILY_LIMIT_REACHED`; өдөр Asia/Ulaanbaatar-аар шилжинэ.
20. Мутацийн endpoint буруу/байхгүй `Origin`-тэй хүсэлтийг `403`-аар татгалзана.
21. API түлхүүр, service role client-ийн хариу, bundle, лог-д харагдахгүй.
22. Гол дэлгэцүүд утасны viewport болон гарнаас удирдахад ажиллана.
23. Бүртгэл устгах хүсэлт ба скрипт баримтжуулсан бодлоготой нийцнэ (`backend_schema.md §6`).

```ts
describe("vocabulary.applyEvent", () => {
  it("promotes a new word straight to active after two correct uses", () => {
    const word = makeWord({ state: "new", usedInConversationCount: 1 });
    expect(applyEvent(word, { type: "used_correctly" }).state).toBe("active");
  });
});
```

## 4. E2E урсгалууд

| # | Урсгал |
|---|---|
| E1 | Урилгатай имэйл → OTP код → 18+ баталгаажуулалт → онбординг → Home |
| E2 | Сценари → 3 мессеж → AI хариу (mock) → дуусгах → feedback |
| E3 | Word missions-ийн үгийг хэрэглэх → feedback дээр ✓ → үгсийн санд төлөв шинэчлэгдсэн |
| E4 | Засвараас үг хадгалах → жагсаалтад харагдах → давтах |
| E5 | AI алдаа → Composer түгжигдэх → "Дахин оролдох" → амжилттай |
| E6 | Хоёр хэрэглэгч: B нь A-ийн session URL-ыг нээхэд хандаж чадахгүй |
| E7 | "Өнөөдөр" карт ба ахицын самбар өгөгдөлтэй харагдах |

- Төхөөрөмж: утасны viewport + desktop.
- Хүртээмж: гол хуудсанд `@axe-core/playwright` — critical/serious алдаагүй.
- CI-д бодит AI провайдер дуудахгүй (`AI_PROVIDER=mock`).
- OTP кодыг local Supabase-ийн имэйл барих хэрэгслээс уншина — хэрэгслийг **шалгах шаардлагатай**.

## 5. AI чанарын үнэлгээ

Dataset-ийг **M6-аас** цуглуулж эхэлнэ. M6-аас өмнө хоёр провайдерыг 20–30 жишээгээр (монгол тайлбарын чанар, зардал, хурд) харьцуулж сонгоно.

Нэргүйжүүлсэн эсвэл зохиомол жишээний жижиг, хүнээр шалгасан dataset (`tests/evals/`):

- Зөв өгүүлбэр (буруу гэж тэмдэглэгдэх ёсгүй)
- Цагийн алдаа
- Артикль, предлог
- Үгийн дараалал
- Ойлгогдох боловч байгалийн бус хэллэг (`style` гэж ялгагдах ёстой)
- Контекстоос хамаарах хоёрдмол өгүүлбэр
- Монгол/англи холимог
- Prompt injection оролдлого
- Word missions-ийн үгийг зөв / буруу утгаар хэрэглэсэн
- Word missions-ийн үгийг хувирсан хэлбэрээр хэрэглэсэн (go → went, apply → applied) — сервер substring шалгалт хийхгүй тул энэ кейсийг eval хамарна
- "used_target_words-д бүгдийг бич" гэх мэт mission-ий injection
- Олон алдаатай урт мессеж (`error_tally` нь харуулсан 5 засвараас олон алдааг тоолох ёстой)

Үнэлэх:
- Засвар зөв эсэх
- Монгол тайлбар зөв, ойлгомжтой эсэх
- `style`-ийг `error` гэж хэлээгүй эсэх
- Түвшинд тохирсон эсэх
- Үндэслэлгүй мэдэгдэл
- `missions[].used` / `used_correctly` зөв эсэх
- `error_tally` бодит алдааны тоотой ойролцоо эсэх
- Injection-д дүрээ хадгалсан эсэх

**Хүний шалгалт** нь хэлний чанарын эцсийн үнэлгээ. LLM-as-judge-ийг зөвхөн ангилахад туслах байдлаар ашиглана. Босго тоог анхны eval хийсний дараа тогтооно. Prompt өөрчлөгдөх бүрт eval ажиллуулж, өмнөх хувилбартай харьцуулна.

## 6. Командууд

Одоо `package.json`-д байгаа (M1):
```bash
npm run lint            # ESLint
npm run format:check    # Prettier
npm run typecheck       # next typegen && tsc --noEmit
npm test                # Vitest (unit, design token contrast)
npm run build
npm run test:e2e        # Playwright, production build дээр (эхлээд build)
npm run check:contrast  # Contrast хүснэгтийг хэвлэнэ
```
M2-оос (Docker + local Supabase шаардлагатай):
```bash
npm run db:start        # supabase start (migration + config.toml)
npm run db:env          # Supabase env-ийг хэвлэнэ (>> .env.local)
npm run test:int        # Vitest, tests/integration (RLS, trigger, route handler)
npm run db:stop
```
Бүх CI шалгалтыг local-д (CI-ийн дараалал, орчинтой ижил):
```bash
npm run verify          # scripts/verify.sh — эхний алдаан дээр зогсож, хураангуй хүснэгт хэвлэнэ
E2E_PORT=3100 npm run verify   # :3000 завгүй бол
```
Дараалал: lint → format:check → typecheck → test → check:contrast → gitleaks (git түүх, CI-ийн тохиргоо) → test:int → build → test:e2e. `gitleaks` суулгаагүй бол алгасахгүй, суулгах заавар хэвлээд унана (CI-ийн хувилбар 8.30.1). test:int-ээс өмнө local Supabase ажиллаж байгааг, test:e2e-ээс өмнө `E2E_PORT` чөлөөтэй эсэхийг шалгана. `APP_ENV=test`, `AI_PROVIDER=mock`, `NEXT_PUBLIC_SITE_URL=http://localhost:$E2E_PORT`-ийг өөрөө тохируулна. Bash ≥ 4 шаардлагатай.

Дараа нэмэгдэх: `eval` (M6). Тохируулаагүй скриптийг байгаа мэт бүү бич.

Integration тест нь Route Handler-ийг (`POST`) `NextRequest`-ээр шууд дуудаж, RLS-ийг publishable түлхүүртэй client-ээр (browser-ийн чадах зүйл) шалгана. Тест хэрэглэгчид нууц үгтэй (зөвхөн тест тохиргоо); апп өөрөө зөвхөн OTP санал болгоно. E2E нь OTP кодыг local имэйл барих серверээс (`MAIL_CATCHER_URL`, порт 54324) уншина — API нь Mailpit эсвэл Inbucket эсэхийг **шалгах шаардлагатай** (хоёуланг оролдоно).

Auth rate limit: integration + E2E нэг ажиллалтад ~20 нэвтрэлт хийдэг тул `supabase/config.toml`-ийн `[auth.rate_limit]` дахь `sign_in_sign_ups`, `token_verifications`-ийг 30-аас 300 (5 минутад, IP тутам) болгосон. Энэ нь зөвхөн local/CI стект хамаарна — hosted Supabase төсөл өөрийн dashboard-ын тохиргоог хэрэглэнэ; production-ий хязгаарыг тэнд тусад нь тохируулна.

Playwright хэзээ ч байгаа сервер дээр дахин ашиглахгүй (`reuseExistingServer: false`): порт завгүй бол "is already used" алдаагаар зогсоно. Тэр серверийг зогсоох эсвэл `E2E_PORT` (ба тохирох `NEXT_PUBLIC_SITE_URL`-тэй build) ашигла.

## 7. CI

```
secret scan ‖ lint → format → typecheck → unit + component → contrast → integration (Supabase local, RLS шалгалт) → build → e2e (mock AI) → (prompt өөрчлөгдсөн бол) eval
```

**Одоогийн төлөв: GitHub Actions ашиглах боломжгүй (account billing lock).** Засагдах хүртэл:
- CI-ийн оронд `npm run verify`-г local-д ажиллуулна; энэ нь `.github/workflows/ci.yml`-тэй ижил алхам, дараалалтай (хоёуланг нь хамт шинэчил).
- Milestone-ийн тайлан бүр `npm run verify`-ийн бүрэн хураангуй хүснэгтийг агуулна.
- CI-ийн төлвийг **"unavailable (billing)"** гэж бичнэ, "passed" гэж хэзээ ч биш.
- Workflow-ийг өөрчлөхгүй үлдээсэн тул billing засагдмагц CI шууд ажиллана; тэгэхэд энэ хэсгийг хасна.
Migration main branch-д merge хийгдэхэд staging Supabase-д deploy хийгдэнэ (M5-аас).

CI-ийн орчин: `APP_ENV=test`, `AI_PROVIDER=mock`, `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. Secret scan тусдаа job-оор зэрэг ажиллана. Алхмууд: `.github/workflows/ci.yml` (runner `ubuntu-24.04`-д бэхэлсэн).
Бүгд ногоон байж байж merge хийнэ. E2E унавал trace хадгална.

## 8. Тестийн өгөгдөл

- `tests/factories/`: `makeUser()`, `makeSession()`, `makeWord()`, `makeFeedbackPayload()`
- Бодит хэрэглэгчийн өгөгдлийг тестэд ашиглахгүй.

## 9. Дууссаны тодорхойлолт

- [ ] Feature-ийн хүлээн авах шалгуур хангагдсан
- [ ] Холбогдох тест нэмэгдэж, **ажиллуулсан**
- [ ] Lint, typecheck давсан (тохируулсан бол)
- [ ] Эрх ба алдааны төлөв тестлэгдсэн
- [ ] Нууц commit хийгдээгүй
- [ ] Шийдвэр өөрчлөгдсөн бол баримт шинэчлэгдсэн
- [ ] Тайланд ажиллуулсан командууд ба үлдсэн хязгаарлалт бичигдсэн
- [ ] CI байхгүй үед: `npm run verify` бүхэлдээ давж, хураангуй нь тайланд орсон; CI = "unavailable (billing)"
