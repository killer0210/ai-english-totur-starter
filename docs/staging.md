# Staging — тохируулах алхмууд (хойшлогдсон)

**Холбоос:** [implementation_plan.md](./implementation_plan.md) M5 · [trd.md §6](./trd.md) · [security.md §4](./security.md) · [audit/decisions.md](./audit/decisions.md) R-04

M5-ийн хүрээнд staging орчныг **үүсгээгүй** — хэрэглэгч Supabase төслийг тусад нь үүсгэнэ. Доорх нь дараа нь хийх алхмууд; аль нь ч одоогоор шалгагдаагүй (**шалгах шаардлагатай**).

## 1. Supabase төсөл

1. Шинэ төсөл (production-оос тусдаа), хамгийн ойрын Ази бүс (`trd.md §6`; бүсийн боломжийг шалгах).
2. **Authentication → Providers → Email:** Email provider **асаалттай (ON)**, OTP 6 оронтой, хүчинтэй хугацаа 3600 сек.
3. **Authentication → Sign In / Providers:** **"Allow new users to sign up" унтраалттай (OFF)** — урилгаар. Local-ийн `[auth.email] enable_signup = false` нь email provider-ийг бүхэлд нь унтраадаг тул hosted дээр хоёр тусдаа унтраалга гэдгийг анхаар.
4. **Email template (Magic Link):** `{{ .Token }}`-ийг агуулна (`supabase/templates/`-тэй ижил).
5. **Auth rate limit:** dashboard-ын default-ыг үлдээнэ (local-ийн 300 нь зөвхөн тестэд).
6. **API Keys:** publishable (`sb_publishable_…`) ба secret (`sb_secret_…`) түлхүүр. Secret түлхүүрийг зөвхөн серверийн env-д.

## 2. Migration ба агуулга

```bash
npx supabase login
npx supabase link --project-ref <staging-ref>
npx supabase db push                      # supabase/migrations/* (хуучныг засахгүй, зөвхөн шинэ)
NEXT_PUBLIC_SUPABASE_URL=https://<staging-ref>.supabase.co \
SUPABASE_SECRET_KEY=<staging secret> \
  npm run content:sync                    # content/ → units, scenarios, scenario_words
```

Дараа нь шалгах: `public`-ийн бүх хүснэгтэд RLS асаалттай; DB функцуудыг (`begin_user_turn` г.м.) `authenticated` дуудаж чадахгүй (publishable түлхүүр + нэвтэрсэн хэрэглэгчээр `rpc` → `42501`).

## 3. Vercel staging

Env (Preview/Staging):

| Хувьсагч | Утга |
|---|---|
| `APP_ENV` | `staging` |
| `AI_PROVIDER` | `mock` (M6 хүртэл; staging-д mock зөвшөөрөгдөнө) |
| `NEXT_PUBLIC_SITE_URL` | staging домэйн (`https://…`) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | staging төсөл |
| `SUPABASE_SECRET_KEY` | staging secret (Sensitive) |

`NEXT_PUBLIC_*` нь build-ийн үед inline болдог тул өөрчилсний дараа дахин build хийнэ. `APP_ENV=staging` үед `upgrade-insecure-requests` CSP-д орно.

## 4. Урилга ба гараар шалгах

```bash
NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SECRET_KEY=… node scripts/invite-users.mjs you@example.com
```

Урсгал: OTP нэвтрэх → 18+ → онбординг → `/path` → "Яриа эхлүүлэх" → 2–3 мессеж (mock хариу) → `[mock:fail-once]` → "Дахин оролдох" → "Дуусгах" → `/history`.

## 5. CI-ээр migration deploy (billing сэргэсний дараа)

`.github/workflows/`-д `main` руу merge хийгдэхэд ажиллах тусдаа job: `supabase link` + `supabase db push`, нууцууд GitHub Environment `staging`-д (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, project ref). Production deploy нь гараар баталгаажсаны дараа (`trd.md §6`).
