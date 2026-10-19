# ADR-001 — Модульчлагдсан monolith

**Төлөв:** Батлагдсан · **Огноо:** 2026-10-19 · **Холбоос:** [architecture.md §1–3](../architecture.md), D-02, D-09

## Нөхцөл

MVP нь жижиг баг, урилгаар 20–50 хэрэглэгчийн pilot-д зориулагдсан. Тусдаа backend, microservice нь deploy, тест, эрхийн хилийг олшруулна.

## Шийдвэр

- Нэг Next.js (App Router) кодын сан, Vercel дээр; DB ба Auth нь Supabase, хоёулаа нэг Ази бүсэд (бүсийн боломжийг шалгах шаардлагатай).
- Мутаци ба AI дуудлага — Route Handlers (`src/app/api/`). Уншдаг хуудсууд Server Component-оос service-ийг шууд дуудаж болно. Server Actions MVP-д ашиглахгүй (нэг server entry загвар).
- Бизнес логик `src/features/<name>/` дотор, Next.js-ээс хамааралгүй service ба цэвэр функц.
- Staging ба production нь тусдаа Supabase төсөл.

## Үр дагавар

- Нэг deploy, нэг тестийн pipeline.
- Feature хоорондын хилийг хавтас ба import-ийн дүрмээр сахина (`architecture.md §2`).
- Background ажил (2-р шат) нь pg_cron эсвэл scheduled function-оор, тусдаа сервергүй.
- Хэрэгцээ батлагдвал (ачаалал, баг өсөх) тусдаа service гаргах — шинэ ADR шаардана.
