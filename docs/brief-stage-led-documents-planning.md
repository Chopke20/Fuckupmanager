# Brief: dokumenty Plan sceny + Plan LED (multi-blok / multi-scena)

**Cel briefu:** kontekst + aktualny stan + zakres do zaplanowania (nie implementacja).  
**Trigger:** Spinacz `LAMA-1121-0647-F197` (2026-11-21) + decyzja produktowa o pełniejszym modelu dokumentów.  
**Wersja odniesienia:** `main-fb9d31a` (zgłoszenie) / HEAD lokalny może być nowszy.  
**Firma zgłoszenia:** `main` · trasa: `/orders/:id`

---

## 1. Ticket Spinacza (punkt startu)

**LAMA-1121-0647-F197** · Typ: Nie działa · Pilność: Przeżyję  

> Zrobiłem scenę z planu sceny w ofercie i dodałem, a potem nie mogłem wygenerować planu sceny, bo przycisk był nieaktywny.

Hipoteza (do potwierdzenia w planie / fixie):

1. Po „Dodaj do zlecenia” `stagePlanJson` jest w **dirty form** (blok / zlecenie).
2. Wejście w dokument wymaga zapisu; przycisk PDF na stronie planu jest `disabled={… || !plan}`.
3. Jeśli zapis nie doszedł / API nie widzi JSON / użytkownik wszedł bez udanego save → UI wygląda jak „martwy przycisk”, bez wyjaśnienia.
4. Alternatywnie: sekcja Dokumenty na formularzu — `disabled={!id || updateOrderMutation.isPending}` — bez komunikatu „dlaczego”.

To jest **bug UX/persistencji** i jednocześnie objaw większej luki: dokument „Plan sceny” nie jest dopięty do modelu multi-blok / multi-scena tak, jak użytkownik oczekuje.

---

## 2. Intencja produktowa (co user chce)

1. Naprawić nieaktywne generowanie planu po złożeniu sceny.
2. Przemyśleć **wiele scen w wielu blokach oferty** → jak ma wyglądać dokument „Plan sceny”.
3. **To samo dla ekranów LED** (zestawy per zlecenie i per blok).
4. **Nowy przycisk na dole** w sekcji Dokumenty (obok Oferta / Proposal / Magazyn / Plan sceny) — najpewniej „Plan LED” / podobny dokument.
5. To jest **większe zadanie** — najpierw plan, potem budowa.

---

## 3. Aktualny stan (kod)

### 3.1 Model danych

| Warstwa | Scena (podesty) | LED |
|--------|------------------|-----|
| JSON na zleceniu | `Order.stagePlanJson` | `Order.ledScreenJson` |
| JSON na bloku oferty | `OrderOfferBlock.stagePlanJson` | `OrderOfferBlock.ledScreenJson` |
| Struktura zestawu | `StagePlanSet` (`kind: stage-plan-set`, `scenes[]`) | `LedScreenSet` (`kind: led-screen-set`, `entries[]`) |
| Plik modelu | `packages/shared-types/.../stagePlatformPlanSet.ts` | `apps/web/.../ledScreenPlanSet.ts` |
| Migracja legacy | stary pojedynczy `StagePlan` → 1 scena „Scena 1” | analogicznie dla projektu LED |

Źródło prawdy w UI: JSON w formularzu zlecenia / bloku.  
Dodatkowo (opcjonalnie) projekty toolbox w DB: `stage-plan-projects`, `led-screen-projects` (upsert przy apply, nie zastępują JSON w ofercie).

### 3.2 Edycja w zleceniu

- Panel `OrderPlanProjectsPanel` w bloku oferty **i** w głównym wykazie: listy Sceny / Ekrany LED (dodaj, otwórz, rename inline, duplikuj, usuń).
- Modale: `StagePlatformsOrderModal` + `LedScreensOrderModal` → apply mapuje sprzęt + zapisuje JSON zestawu.
- Po apply: `setValue(..., { shouldDirty: true })` — **nie ma auto-save zlecenia**.

### 3.3 Dokumenty na dole formularza (`OrderFormPage` § Dokumenty)

Obecne przyciski:

| Przycisk | Stan | Ścieżka |
|----------|------|---------|
| Oferta | działa | `/orders/:id/offer` |
| Proposal | działa | `/orders/:id/proposal` |
| Magazyn załadunek | działa | `/orders/:id/warehouse` |
| Brief techniczny | disabled „w przygotowaniu” | — |
| **Plan sceny** | działa (nawigacja) | `/orders/:id/stage-plan` |
| **Plan LED** | **brak** | — |

Wzorzec: `saveAndNavigateToDocument(path)` — jeśli form dirty → `updateOrder` → `navigate`.  
Disable: `!id || updateOrderMutation.isPending` (oraz `!isEditing` ≡ `!id`).

### 3.4 Strona Plan sceny (`OrderStagePlanPage`)

- Zbiera opcje z:
  - `order.stagePlanJson` → „Plan zlecenia (główny wykaz)”
  - każdy `offerBlocks[].stagePlanJson` → „Blok: {title}” (+ nazwa sceny gdy >1 w zestawie)
- Select „Wybierz plan” gdy `planOptions.length > 1`.
- Podgląd SVG: **jedna** wybrana scena.
- PDF / podgląd: przekazuje tylko `blockId` (lub brak = główny JSON zlecenia).
- Przycisk PDF: `disabled={pdfLoading || !plan}` — przy braku planu: tekst „użyj Złóż scenę…”, bez soft-disable explanation na przycisku Dokumenty.

### 3.5 API PDF planu sceny

- `GET /api/pdf/stage-plan/:orderId/generate?blockId=&preview=`
- Wczytuje `order.stagePlanJson` **albo** JSON wskazanego bloku.
- Parsuje `StagePlanSet`; do buildera idzie **`scenes` (cały zestaw)** — PDF umie wiele scen w jednym dokumencie (`buildStagePlanPdfHtml` + `renderSceneSection`).
- **Nie ma** parametru `sceneId`.
- **Nie ma** trybu „wszystkie bloki w jednym PDF”.
- Snapshot exportu zapisuje `plan` (pierwsza scena) + `scenes` (lista) — niespójność do ogarnięcia przy redesignie.

### 3.6 LED — dokumentów brak

- Zestawy i edytor w zleceniu: tak.
- Strona `/orders/:id/…` dla planu LED: **nie**.
- Endpoint PDF LED powiązany ze zleceniem: **nie** (jest tylko toolbox preview PNG / pixel map po stronie klienta; stage ma `preview-pdf` dla toolbox projektu).
- Przycisk w Dokumentach: **nie**.

### 3.7 Magazyn / Oferta jako wzorzec multi-blok

- Magazyn i oferta już grupują pozycje po `offerBlockId` (bloki + „luzem”).
- Plan sceny / LED powinny wizualnie i produktowo **pasować do tej mentalności**: blok = kontekst oferty, zlecenie = całość.

---

## 4. Luki / problemy (do zaadresowania w planie)

1. **Bug F197:** niespójność dirty JSON vs zapisany order → „nieaktywny” PDF / pusta strona planu.
2. **Brak feedbacku** przy disable (pending save, brak planu, błąd walidacji przed navigate).
3. **Multi-blok sceny:** UI preview = jedna scena; PDF = cały set jednego bloku; brak jasnej decyzji „jeden PDF na blok” vs „jeden PDF na całe zlecenie (wszystkie bloki)”.
4. **Select na stronie planu** miesza „jedną scenę do podglądu” z „PDF całego setu bloku” — użytkownik może myśleć, że PDF = tylko wybrana scena.
5. **LED parity:** edycja jest, dokumentu nie ma.
6. **Nowy przycisk Dokumenty** wymaga decyzji: osobna strona jak stage-plan, czy wspólny hub „Plany techniczne”.
7. **Główny wykaz vs bloki:** dwa miejsca JSON (`order.*` vs `block.*`) — kiedy używać którego; czy dokument ma pokazywać oba zawsze.

---

## 5. Decyzje do podjęcia w planie (otwarte pytania)

Odpowiedzi zablokują kształt rozwiązania:

### A. Zakres PDF „Plan sceny”

- **A1** Jeden PDF = jeden blok (lub główny wykaz), wszystkie sceny z setu (jak dziś API).
- **A2** Jeden PDF = jedna scena (wymaga `sceneId` w API + UI).
- **A3** Jeden PDF = całe zlecenie: wszystkie bloki + główny wykaz, sekcje z tytułami bloków/scen.
- **A4** Hub z wyborami (checkboxy: które bloki/sceny) + „Generuj”.

Rekomendacja do dyskusji: **A3 jako domyślny dokument zlecenia** + opcjonalnie filtr/select; podgląd strony może zostać interaktywny (A1/A2 w UI).

### B. Zakres PDF „Plan LED”

- Analogicznie do A (entry zamiast scene).
- Zawartość: rzut CSS/siatka + metryki (m², pitch, px) + rozpiska zmapowana? Czy tylko wizual + wymiary?

### C. Przyciski Dokumenty

- Dwa przyciski: `Plan sceny` | `Plan LED`.
- Albo jeden: `Plany techniczne` → hub z zakładkami Scena / LED.
- Disable rules: aktywny gdy jest ≥1 zapisany plan; inaczej enabled ale strona z CTA „złóż / zapisz”.

### D. Persistencja po apply kreatora

- Auto-save zlecenia po udanym apply sceny/LED?
- Czy tylko twardszy `saveAndNavigate` + toast „zapisuję…” + powód disable?

### E. Numeracja dokumentów

- `STAGE_PLAN` już ma `OrderDocumentExport`.
- LED: nowy `documentType` (np. `LED_PLAN`) vs wspólny bucket — ustalić.

---

## 6. Proponowany zakres prac (epiki dla planu Claude)

### Epic 0 — Hotfix F197 (mały, osobno albo pierwszy slice)

- Po apply: upewnić się, że JSON jest w payloadzie save.
- `saveAndNavigateToDocument`: loading / błąd widoczny przy Dokumentach.
- `OrderStagePlanPage`: jeśli `!plan`, nie tylko disabled PDF — jasny CTA + „zapisz zlecenie jeśli scena jest tylko lokalnie”.
- Smoke: złóż scenę w bloku → Dokumenty → Plan sceny → PDF działa bez ręcznego „Zapisz” poza flow przycisku.

### Epic 1 — Model dokumentu Plan sceny (multi)

- Spec: co wchodzi do jednego PDF (decyzja A).
- API: query `blockId` / `sceneId` / `scope=order|block` / lista id.
- UI strony: spójność select vs zawartość PDF; ewentualnie outline wszystkich planów zlecenia.
- Snapshot export zgodny z wieloma scenami/blokami.

### Epic 2 — Plan LED (parity)

- `LedScreenSet` już jest — dodać stronę dokumentu + builder PDF + route + przycisk Dokumenty.
- Te same reguły scope co scena (decyzja B/C).
- Mapowanie ról LED nie blokuje samego PDF podglądu (PDF ≠ apply do oferty).

### Epic 3 — UX Dokumenty na dole formularza

- Nowy przycisk(i).
- Stany: brak planu / dirty / saving / error.
- Spójne z Ofertą/Magazynem (save-then-open).

### Epic 4 — (opcjonalnie) Hub „Plany techniczne”

- Jedna strona, dwie sekcje, zbiorczy lub rozdzielony export.
- Tylko jeśli A/C wybiorą hub zamiast dwóch przycisków.

---

## 7. Pliki / miejsca kotwiczne

```
apps/web/src/modules/orders/pages/OrderFormPage.tsx          # Dokumenty, saveAndNavigate, apply handlers
apps/web/src/modules/orders/pages/OrderStagePlanPage.tsx     # UI planu sceny
apps/web/src/modules/orders/components/OrderPlanProjectsPanel.tsx
apps/web/src/modules/orders/api/order.api.ts                 # download/preview stage plan
apps/web/src/lib/router.tsx                                  # /orders/:id/stage-plan
apps/api/src/modules/pdf/pdf.controller.ts                   # generateStagePlanPdf
apps/api/src/modules/pdf/stage-plan-pdf-builder.ts
packages/shared-types/src/utils/stagePlatformPlanSet.ts
apps/web/src/modules/toolbox/utils/ledScreenPlanSet.ts
apps/web/src/modules/orders/components/LedScreensOrderModal.tsx
apps/web/src/modules/orders/components/StagePlatformsOrderModal.tsx
```

Wzorce UX do zachowania: `docs/ux-functional-lessons.md` (wynik = pozycje/dokument, sticky CTA, bez system dialogs).  
Delivery: build → commit → push `main` → verify `main-<sha>` (reguły Lama).

---

## 8. Kryteria sukcesu (dla planu)

1. Po złożeniu sceny w bloku oferty użytkownik generuje Plan sceny **bez wrażenia martwego przycisku**.
2. Przy scenach w **kilku blokach** dokument ma zdefiniowane, przewidywalne zachowanie (opisane w UI).
3. LED ma **równoważną ścieżkę dokumentu** + przycisk w Dokumentach.
4. Multi-scena / multi-entry nie gubi danych przy save/PDF.
5. Brak regresji Oferta / Magazyn / numeracja STAGE_PLAN.

---

## 9. Poza zakresem (chyba że plan świadomie rozszerzy)

- Brief techniczny (już stub „w przygotowaniu”).
- Redesign kreatorów sceny/LED (już po UX lessons).
- Zmiana mapowania ról / BOM apply.
- Publiczny kalkulator LED (`/tools/ekran-led`).

---

## 10. Sugerowany output od Claude (planującego)

1. Wybrane odpowiedzi na decyzje A–E.
2. User flows (1–2 happy path + empty/dirty).
3. Slice’y implementacyjne (Epic 0 najpierw).
4. Kontrakt API PDF (query/body).
5. Szkic UI Dokumenty + strony planu.
6. Test plan / smoke.
7. Estymata ryzyka (persistencja JSON, snapshot export, multi-company bez zmian schematu firm).
