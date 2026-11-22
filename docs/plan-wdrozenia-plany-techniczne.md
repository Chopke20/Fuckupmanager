# Plan wdrożenia: dokumenty „Plan sceny” + „Plan LED” (multi-blok / multi-scena)

Dla: model implementujący. Kontekst i stan: `docs/brief-stage-led-documents-planning.md`.  
Zasady projektu: `.cursor/rules/*` (zero `alert/confirm/prompt`, delivery: build → commit → push `main` → weryfikacja `main-<sha>` na obu firmach), `docs/ux-functional-lessons.md`.  
Zakaz zmian: provider Prisma (`postgresql`), izolacja firm, `x-request-id`.

---

## 1. Decyzje (przyjęte, nie pytaj ponownie)

| # | Decyzja |
|---|---------|
| A | Plan sceny: **domyślny PDF = całe zlecenie** (główny wykaz + wszystkie bloki, sekcje z nagłówkami „Blok → Scena”). Opcjonalnie zawężenie: `blockId` (jak dziś) lub `sceneId`. |
| B | Plan LED: ta sama semantyka scope. Zawartość PDF: rzut (siatka kabinetów z etykietami) + tabela parametrów na ekran (rozmiar m, m², kabinety, rozdzielczość px, pitch). **Bez** rozpiski sprzętowej/mapowania (to domena zlecenia, nie dokumentu planu). |
| C | W Dokumentach **dwa przyciski**: `Plan sceny`, `Plan LED`. Przyciski aktywne zawsze gdy zlecenie istnieje (`id`); pusty stan obsługuje strona (CTA), nie martwy przycisk. Każdy `disabled` ma `title` z powodem. |
| D | **Brak auto-save po apply kreatora.** Zamiast tego: `saveAndNavigateToDocument` ma widoczny stan „Zapisuję…” i błąd (inline), a strona planu rozróżnia „brak planu w zapisanym zleceniu”. |
| E | Nowy `documentType`: `LED_PLAN`, numeracja jak `STAGE_PLAN` (`buildDocumentNumber`). |

---

## 2. Kluczowe obserwacje techniczne (nie szukaj ponownie)

- JSON: `Order.stagePlanJson|ledScreenJson` + `OrderOfferBlock.stagePlanJson|ledScreenJson`. Zestawy: `StagePlanSet.scenes[]` (shared-types), `LedScreenSet.entries[]` (**tylko w `apps/web`**).
- PDF sceny: `pdf.controller.ts → generateStagePlanPdf` (`GET /api/pdf/stage-plan/:orderId/generate?blockId=&preview=`), builder `stage-plan-pdf-builder.ts` już renderuje wiele scen (`scenes[]`). Brak `sceneId`, brak trybu „cały order”.
- Snapshot eksportu zapisuje `plan` (pierwsza scena) **i** `scenes` — do ujednolicenia (zostaw `scenes`, `plan` tylko dla wstecznej zgodności).
- **Blokada dla LED PDF:** `calculators/ledScreen.ts`, `ledScreenPlanSet.ts` i renderer rzutu są w web — API ich nie widzi. Trzeba przenieść do `packages/shared-types` (czysta logika, bez React/DOM), a w web zostawić re-eksporty.
- Strona: `OrderStagePlanPage.tsx` (`/orders/:id/stage-plan`), route w `lib/router.tsx`, API klienta w `orders/api/order.api.ts`.
- Dokumenty: `OrderFormPage.tsx` sekcja `#documents`, helper `saveAndNavigateToDocument`.

---

## 3. Slice’y (kolejność obowiązkowa, każdy = osobny commit + push)

### Slice 0 — Hotfix F197 (najpierw, mały)

Cel: po złożeniu sceny „Plan sceny” działa bez ręcznego kombinowania.

1. **Reprodukcja** (nie zgaduj): zlecenie z id → blok oferty → złóż scenę → Dodaj → Dokumenty → Plan sceny. Sprawdź w Network czy `PATCH/PUT order` niesie `offerBlocks[].stagePlanJson` oraz czy `formState.isDirty` jest `true` po apply (ścieżka `writeStagePlanSetJson` → `setValue(..., { shouldDirty: true })`).
2. Napraw przyczynę (kandydaci: dirty nie ustawiony dla `offerBlocks` mutowanych przez `setValue` na nested; payload gubi JSON; `saveAndNavigate` pomija save przy `!isDirty`).
3. `saveAndNavigateToDocument`: pokaż „Zapisuję…” na klikniętym przycisku; błędy już idą do `submitError` — upewnij się, że baner jest widoczny przy sekcji Dokumenty (scroll/anchor).
4. `OrderStagePlanPage`: gdy `!plan` → wyraźny blok pusty: „Brak złożonej sceny w zapisanym zleceniu” + przycisk **Wróć do zlecenia** (bez martwego PDF). Przycisk PDF zostaje `disabled` tylko z `title`.
5. Test: istniejący test plan-set + ręczny smoke. Deploy.

DoD: scenariusz z ticketu przechodzi; każdy disabled ma powód.

### Slice 1 — API Plan sceny: scope

Kontrakt (rozszerzenie istniejącego endpointu, kompatybilne wstecz):

```
GET /api/pdf/stage-plan/:orderId/generate
  ?scope=order|block|scene     (domyślnie: order)
  &blockId=<id>                (scope=block|scene; brak = główny wykaz)
  &sceneId=<id>                (scope=scene)
  &preview=1
```

- `scope=order`: sekcje w kolejności: główny wykaz (`order.stagePlanJson`) → bloki wg `sortOrder` oferty. Nagłówek sekcji: `Blok: {title}` + nazwa sceny.
- Walidacje 4xx (jasne komunikaty z `requestId`): nieznany `sceneId`/`blockId`, brak jakichkolwiek scen w zakresie.
- Builder: rozszerz wejście o grupy `{ groupTitle, scenes[] }`; `renderSceneSection` bez zmian logiki rzutu.
- Snapshot: zapisz `scope`, `groups`; zachowaj `plan`/`scenes` dla zgodności.
- Zachowaj kompatybilność: stare wywołania `?blockId=` bez `scope` = zachowanie dzisiejsze (traktuj jak `scope=block`).
- Test: unit buildera (wiele grup) + test kontrolera/handlera dla scope.

### Slice 2 — UI strony Plan sceny

- Układ: lewa = drzewo planów (Zlecenie / Blok → Sceny, z checkbox-less wyborem **scope**: `Całe zlecenie` | `Blok` | `Scena`), prawa = podgląd SVG wybranej sceny + CTA.
- Sticky CTA: „Pobierz PDF: {opis zakresu}” (np. „całe zlecenie · 3 bloki · 5 scen”). Podgląd PDF analogicznie z `scope`.
- Usuń niejednoznaczność dzisiejszego selecta (podgląd jednej sceny vs PDF całego setu bloku) — etykieta zakresu zawsze widoczna nad przyciskiem.
- Klient API: `downloadOrderStagePlanPdf(orderId, { scope, blockId, sceneId })`, `getOrderStagePlanPdfPreviewUrl(...)`.
- Bez systemowych dialogów; stan pusty wg Slice 0.

### Slice 3 — Przeniesienie logiki LED do shared-types

- Przenieś do `packages/shared-types/src/utils/`: `ledScreen` (calculators: typy, `calculateLedScreen`, `parseLedScreenProjectJson`, `serializeLedScreenProject`, presety) oraz `ledScreenPlanSet` (`parseLedScreenSetJson`, itd.).
- W `apps/web` zostaw re-eksporty ze starych ścieżek (zero zmian importów w UI poza ewentualnymi typami), żeby diff był mały.
- Przenieś/dodaj testy; `npm run build` w obu workspace’ach (web + api + shared-types).
- Dodaj czysty renderer rzutu LED → SVG (`renderLedScreenSvg(project, { theme: 'print'|'dark', widthPx })`): siatka/obrys ekranów wg `layoutXM/YM`, etykiety „rozmiar · pitch”, skala spójna z `LedScreenCssPreview`.

### Slice 4 — API + PDF Plan LED

- `documentType: LED_PLAN` w enumie / `buildDocumentNumber` (sprawdź definicję i `OrderDocumentExport.documentType` — Prisma: jeśli enum, dodaj migrację w `apps/api/prisma/migrations/`, potem `npx prisma generate`; jeśli string — bez migracji).
- Endpoint: `GET /api/pdf/led-plan/:orderId/generate` z tym samym kontraktem scope (`scope`, `blockId`, `entryId`, `preview`).
- Builder `led-plan-pdf-builder.ts` wzorowany na `stage-plan-pdf-builder.ts`: sekcja na ekran/entry = SVG rzutu + tabela parametrów (nazwa, m×m, m², kabinety kol×wiersz, px, pitch, proporcja). Nagłówek dokumentu jak plan sceny (nr zlecenia, miejsce, data).
- Router: `pdf.router.ts`. Snapshot jak scena.
- Test: unit buildera + walidacje 4xx.

### Slice 5 — UI strony Plan LED + route

- Nowa strona `OrderLedPlanPage.tsx` (wspólne komponenty ze stage page: drzewo scope + sticky CTA — wyciągnij współdzielony komponent, np. `PlanScopeTree`, żeby nie duplikować).
- Route `/orders/:id/led-plan` w `router.tsx`; klient w `order.api.ts` (`downloadOrderLedPlanPdf`, `getOrderLedPlanPdfPreviewUrl`).
- Podgląd: `LedScreenCssPreview`/SVG dla wybranego ekranu.

### Slice 6 — Przycisk w Dokumentach

- Obok `Plan sceny` dodaj `Plan LED` (ikona np. `Monitor`/`Tv2` z lucide), ten sam wzorzec `saveAndNavigateToDocument('/orders/${id}/led-plan')`.
- Reguły disabled/title z decyzji C. Opcjonalnie badge z liczbą (np. „3 sceny”, „2 ekrany”) jeśli tanie z danych formularza.

### Slice 7 — Domknięcie

- Smoke end-to-end: zlecenie z 2 blokami × (1–2 sceny, 1–2 ekrany LED) → PDF `scope=order`, `block`, `scene/entry` oba dokumenty.
- Regresja: Oferta, Proposal, Magazyn, numeracja `STAGE_PLAN`, istniejące eksporty.
- Dopisz wnioski do `docs/ux-functional-lessons.md` jeśli pojawią się nowe (np. „disabled zawsze z powodem”).

---

## 4. Ryzyka / uwagi

1. **Persistencja JSON (Slice 0)** — najważniejsze ryzyko; nie buduj reszty na niezweryfikowanej hipotezie.
2. **Przeniesienie LED do shared-types** — pilnuj braku zależności od DOM/React w przenoszonych plikach (`ledPixelMap` PNG export zostaje w web).
3. **Prisma enum `documentType`** — migracja tylko jeśli enum; po zmianie schematu: `generate`, `db:migrate`, smoke.
4. **Multi-company** — endpointy bez zmian modelu firm; zero surowych URL/DB z klienta.
5. **Rozmiar PDF** przy dużej liczbie scen — jedna scena na sekcję, `page-break-inside: avoid` na sekcji (jak dziś w stage builderze).

---

## 5. Checklist akceptacji

- [ ] Scenariusz F197 działa bez ręcznego obejścia; brak martwych przycisków bez powodu.
- [ ] Plan sceny: PDF `order` / `block` / `scene`; zakres opisany w CTA.
- [ ] Plan LED: strona + PDF `order` / `block` / `entry`; przycisk w Dokumentach.
- [ ] Testy (builder, scope, shared-types LED) zielone; `npm run build` OK.
- [ ] Brak regresji istniejących dokumentów.
- [ ] Każdy slice: commit → push `main` → `main-<short_sha>` na UI; `GET /api/auth/public-companies` zwraca `main` i `studioted`.
