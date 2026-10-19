# Code Style — Код бичих дүрэм

**Холбоос:** [architecture.md](./architecture.md) · [testing.md](./testing.md)

---

## 1. Ерөнхий

- TypeScript strict (`noUncheckedIndexedAccess`-тэй).
- Ухаалаг хийсвэрлэлээс илүү энгийн, уншигдахуйц код.
- Репозиторын тогтсон конвенцийг дагана.
- Шаардлагагүй хамаарал, давхар хэрэгжүүлэлт нэмэхгүй.
- Код, нэр, коммент — **англиар**; хэрэглэгчид харагдах текст — **монголоор**, `messages/mn.json`-д.

## 2. Нэрлэх

| Зүйл | Хэлбэр | Жишээ |
|---|---|---|
| Компонент, төрөл | PascalCase | `CorrectionCard`, `FeedbackReport` |
| Функц, хувьсагч | camelCase | `startSession`, `dueWords` |
| Модулийн тогтмол | UPPER_SNAKE_CASE | `MAX_MESSAGE_LENGTH` |
| Компонент файл | PascalCase.tsx | `WordMissionChip.tsx` |
| Бусад файл | kebab-case.ts | `context-builder.ts` |
| DB | snake_case | `vocabulary_items.next_review_at` |
| Boolean | `is/has/should` | `isSending`, `hasUsedHint` |
| Zod схем | `xxxSchema` | `sendMessageSchema` |
| Prompt | `<name>.v<N>.ts` | `feedback.v1.ts` |

## 3. TypeScript

- `any` хориотой → `unknown` + шалгалт. Зайлшгүй бол шалтгааныг бичиж, хүрээг нарийсга.
- Итгэлийн хил давж ирсэн өгөгдлийг (network, DB, AI) runtime-д шалгана; TS төрөл шалгалт биш.
- Service-ийн чухал хилд тодорхой return type.
- `null`, алдааны тохиолдлыг зориуд боловсруул.

## 4. React / Next.js

- Default нь server component; `"use client"` зөвхөн state, event, browser API хэрэгтэй хэсэгт.
- Presentational компонент бизнес логикгүй.
- Semantic HTML, хүртээмжтэй.
- Loading, empty, error, disabled төлөвтэй.
- Өнгө, зайг hard-code хийхгүй — design token ([design_system.md](./design_system.md)).
- Компонент 200 мөрөөс давбал хуваах.

```tsx
type CorrectionCardProps = {
  correction: Correction;
  onSaveWord: (term: string) => void;
};

export function CorrectionCard({ correction, onSaveWord }: CorrectionCardProps) {
  const t = useTranslations("feedback");
  // ...
}
```

## 5. Server ба service

- Route handler: нэвтрэлт → Zod → service → хариу. Бизнес логик бичихгүй.
- Service нь Next.js-ээс хамааралгүй, хамаарлыг параметрээр авна (тестлэхэд хялбар).
- DB хандалт серверийн тодорхой модульд.
- AI дуудлага зөвхөн adapter-ээр; провайдерын хариуны төрөл UI-д орохгүй.
- Устгах үйлдэл тодорхой, шаардлагатай бол баталгаажуулалттай.

```ts
export const POST = withErrorHandling(async (req, { params }) => {
  const user = await requireUser();
  const input = sendMessageSchema.parse(await req.json());
  const result = await conversationService.sendMessage({ userId: user.id, sessionId: params.id, ...input });
  return Response.json(result);
});
```

## 6. Алдаа

- Дотоод алдааг `AppError(code, messageMn, status, retryable)`-ээр.
- `withErrorHandling()`: `AppError` → JSON; бусад → 500 + алдааны хяналт.
- Хэрэглэгчид аюулгүй мессеж; stack trace, провайдерын дотоод мэдээлэл хэзээ ч.
- Алдааг чимээгүй залгихгүй; хоосон `catch` хориотой.
- Логт ашигтай мета өгөгдөл, нууц болон мессежийн агуулгагүй.

## 7. AI prompt

- Prompt-ийг код дунд string-ээр бичихгүй — `lib/ai/prompts/`-д.
- Prompt бүр `version`, `build(input)` экспортлоно; модель нь тохиргооноос.
- Structured output бүр Zod схемтэй.
- Өөрчлөлт = шинэ хувилбар + eval.

## 8. Import

- Alias: `@/components`, `@/features`, `@/lib`.
- Дараалал: гадны → `@/` → харьцангуй (ESLint-ээр).

## 9. Чанарын шалгалт

ESLint, Prettier, typecheck, unit/integration тест, Playwright тохируулна. Скриптүүдийг `package.json`-д нэмсний **дараа** л баримтад бичнэ. CI шалгалт унавал merge хийхгүй.

## 10. Git

- Branch: `feat/word-missions`, `fix/review-interval`.
- Conventional Commits: `feat(conversation): add hint sheet`.
- Жижиг, review хийхэд хялбар PR; UI бол дэлгэцийн зурагтай.

## 11. Коммент ба баримт

- "Юу"-г биш "яагаад"-ыг тайлбарла.
- Өөрчлөлтийн дараа коммент үнэн зөв хэвээр байх.
- Бүтээгдэхүүн, архитектурын шийдвэр өөрчлөгдвөл холбогдох баримтыг шинэчил.

## 12. Хориотой

- `console.log` production кодод (→ logger)
- Тайлбаргүй `any`, `@ts-ignore`
- Client кодод нууц
- Hard-code UI текст
- Хэрэглэгчийн хэлний алдааг улаанаар / "Буруу" гэж харуулах
- Ажилладаггүй товч, хуурамч функцийг дууссан мэт харуулах
