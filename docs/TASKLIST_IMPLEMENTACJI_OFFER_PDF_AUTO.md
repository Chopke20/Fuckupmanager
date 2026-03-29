# Tasklist wykonawcza 1:1 – Oferta PDF (AUTO)

Ten dokument jest checklistą implementacji na bazie `docs/SPEC_IMPLEMENTACJI_OFERY_PDF_AUTO.md`.

## Zasady wykonania

- Każdy checkbox to gotowy krok do odhaczenia.
- Realizuj kroki w podanej kolejności.
- Po każdym etapie uruchom minimalną weryfikację.
- Preferowany styl commitów: jeden commit na jeden etap.

---

## Etap 1: Prisma + migracja numeracji

### Pliki
- `apps/api/prisma/schema.prisma`
- `apps/api/src/prisma/migrations/*` (nowa migracja)

### Zadania
- [x] Dodać model `OrderYearSequence`:
  - [ ] `year Int @id`
  - [ ] `lastNumber Int @default(0)`
  - [ ] `updatedAt DateTime @updatedAt`
- [ ] Dodać pola do `Order`:
  - [ ] `orderYear Int`
  - [ ] `orderNumber Int`
  - [ ] `offerVersion Int @default(0)`
  - [ ] `offerNumber String? @unique`
  - [ ] `offerValidityDays Int @default(14)`
  - [ ] `projectContactKey String?`
  - [ ] `currency String @default("PLN")`
  - [ ] `exchangeRateEur Float?`
- [ ] Dodać `@@unique([orderYear, orderNumber])` w `Order`.
- [ ] Wygenerować migrację.
- [ ] Dodać SQL backfill dla istniejących rekordów:
  - [ ] przypisać `orderYear = year(createdAt)` (lub `dateFrom` wg ustalenia),
  - [ ] nadać `orderNumber` sekwencyjnie w obrębie roku.

### Weryfikacja
- [ ] `npm run build -w apps/api` przechodzi.
- [ ] Brak kolizji unikalności na danych testowych.

### Commit
- `feat(db): add yearly order numbering and offer version fields`

---

## Etap 2: Shared types + walidacje DTO

### Pliki
- `packages/shared-types/src/schemas/order.schema.ts`

### Zadania
- [ ] Dodać nowe pola `OrderSchema` / `CreateOrderSchema` / `UpdateOrderSchema`:
  - [ ] `orderYear`, `orderNumber`, `offerVersion`, `offerNumber`
  - [ ] `offerValidityDays`
  - [ ] `projectContactKey`
  - [ ] `currency`
  - [ ] `exchangeRateEur`
- [ ] Ograniczyć walidacje:
  - [ ] `vatRate` tylko `0 | 23`,
  - [ ] `currency` tylko `PLN | EUR`,
  - [ ] `projectContactKey` tylko `RAFAL | MICHAL`,
  - [ ] `offerValidityDays` zakres `1..90`.

### Weryfikacja
- [ ] `npm run build -w packages/shared-types` przechodzi.

### Commit
- `feat(types): extend order schema with offer auto fields`

---

## Etap 3: Numeracja roczna w createOrder

### Pliki
- `apps/api/src/modules/orders/orders.service.ts`

### Zadania
- [ ] Dodać helper pobierania roku w strefie `Europe/Warsaw`.
- [ ] W `createOrder`:
  - [ ] uruchomić transakcję na `OrderYearSequence`,
  - [ ] zwiększyć licznik roczny atomowo,
  - [ ] zapisać `orderYear` i `orderNumber` do nowego zlecenia.
- [ ] Ustawić domyślne:
  - [ ] `offerVersion = 0`
  - [ ] `offerValidityDays = 14` (jeśli brak).

### Weryfikacja
- [ ] Dwa szybkie create dają różne `orderNumber`.
- [ ] Numeracja jest rosnąca w ramach roku.

### Commit
- `feat(api-orders): assign yearly order numbers on create`

---

## Etap 4: Endpoint kursu EUR (NBP + cache)

### Pliki
- `apps/api/src/modules/finance/finance.controller.ts` (nowy)
- `apps/api/src/modules/finance/finance.router.ts` (nowy)
- `apps/api/src/app.ts`

### Zadania
- [ ] Dodać endpoint `GET /api/finance/exchange-rate/eur`.
- [ ] Dodać cache in-memory (TTL 12h).
- [ ] Obsłużyć błąd upstream (czytelny komunikat).
- [ ] Podłączyć router w `app.ts`.

### Weryfikacja
- [ ] Endpoint zwraca `{ data: { rate, date, source } }`.
- [ ] Drugi request idzie z cache.

### Commit
- `feat(api-finance): add EUR exchange rate endpoint with cache`

---

## Etap 5: PDF API – preview/generate + auto version

### Pliki
- `apps/api/src/modules/pdf/pdf.router.ts`
- `apps/api/src/modules/pdf/pdf.controller.ts`

### Zadania
- [ ] Zastąpić stary `GET /offer/:orderId` nowymi:
  - [ ] `POST /offer/:orderId/preview`
  - [ ] `POST /offer/:orderId/generate`
- [ ] `preview`:
  - [ ] nie zmienia `offerVersion`,
  - [ ] generuje PDF z aktualnych danych.
- [ ] `generate`:
  - [ ] podbija `offerVersion` o 1,
  - [ ] tworzy `offerNumber = orderNumber.offerVersion.orderYear`,
  - [ ] zapisuje `offerNumber` i `offerVersion`,
  - [ ] zwraca plik `Oferta-{offerNumber}.pdf`.
- [ ] Dopiąć walidację unikalności `offerNumber`.

### Weryfikacja
- [ ] Dwa kolejne `generate` -> kolejne wersje i różne nazwy plików.
- [ ] `preview` nie zmienia numeru.

### Commit
- `feat(api-pdf): add preview and auto versioned offer generation`

---

## Etap 6: Szablon PDF zgodny z ustaleniami

### Pliki
- `apps/api/src/modules/pdf/pdf.controller.ts`

### Zadania
- [ ] Nagłówek:
  - [ ] data/miejsce, ważność 14+,
  - [ ] numer oferty,
  - [ ] dane firmy Lama Stage (stała konfiguracja).
- [ ] Opis: tylko `order.description`.
- [ ] Harmonogram: tylko etapy istniejące.
- [ ] Sprzęt:
  - [ ] grupowanie dynamiczne po `category`,
  - [ ] rabat pozycji + dni + VAT + brutto,
  - [ ] suma sekcji i suma globalna.
- [ ] Produkcja:
  - [ ] wydzielić `Transport`,
  - [ ] obsługa per etap (`stageIds`),
  - [ ] pozycje bez etapu na końcu bez adnotacji.
- [ ] Podsumowanie:
  - [ ] sprzęt/transport/obsługa,
  - [ ] netto przed rabatem, rabat globalny, netto po rabacie, VAT, brutto,
  - [ ] blok cykliczny tylko gdy `isRecurring = true`.
- [ ] Waluta:
  - [ ] dla `EUR` pokazywać wyłącznie EUR.
- [ ] Stopka:
  - [ ] opiekun wg `projectContactKey`.

### Weryfikacja
- [ ] 1 PDF PLN + VAT 23 poprawny.
- [ ] 1 PDF EUR + VAT 0 poprawny.
- [ ] Pozycje bez etapu są na końcu sekcji obsługi.

### Commit
- `feat(pdf-template): implement lama style with media complexity blocks`

---

## Etap 7: UI – panel dokumentów + editor PDF + podgląd

### Pliki
- `apps/web/src/modules/orders/pages/OrderFormPage.tsx`
- `apps/web/src/modules/orders/api/order.api.ts` lub `pdf.api.ts` (nowy)
- `apps/web/src/shared/api/client.ts` (jeśli helper blob)
- `apps/web/src/modules/orders/components/*` (nowy modal)

### Zadania
- [ ] Dodać sekcję `Dokumenty` w zleceniu:
  - [ ] Oferta PDF (aktywna),
  - [ ] Oferta proposal (disabled, `w przygotowaniu`),
  - [ ] Magazyn załadunek (disabled, `w przygotowaniu`),
  - [ ] Brief techniczny (disabled, `w przygotowaniu`).
- [ ] Dodać modal `Editor generowania oferty`:
  - [ ] `offerValidityDays`,
  - [ ] `projectContactKey`,
  - [ ] `currency`,
  - [ ] `exchangeRateEur` (dla EUR),
  - [ ] `vatRate` (23/0).
- [ ] Przy otwarciu modala:
  - [ ] pobrać kurs EUR z API (prefill).
- [ ] Dodać akcje:
  - [ ] `Podgląd PDF` -> `/preview`,
  - [ ] `Generuj PDF` -> zapis zlecenia + `/generate`.
- [ ] Pokazać:
  - [ ] ostatni numer oferty,
  - [ ] następny numer (predykcja).

### Weryfikacja
- [ ] Zmiany z modala zapisują się do zlecenia.
- [ ] Podgląd działa bez podbijania wersji.
- [ ] Generowanie podbija wersję.

### Commit
- `feat(web): add documents panel and offer pdf generation editor`

---

## Etap 8: Lint/build/smoke + odbiór

### Zadania
- [ ] `npm run build` (root).
- [ ] `npm run smoke` (API uruchomione).
- [ ] Kontrola lintera dla zmienionych plików.
- [ ] Manualny scenariusz akceptacyjny:
  - [ ] utworz zlecenie -> numer roczny,
  - [ ] generate #1 -> `N.1.RRRR`,
  - [ ] zmiana zlecenia -> generate #2 -> `N.2.RRRR`,
  - [ ] nazwy plików unikalne,
  - [ ] preview nie podbija wersji,
  - [ ] EUR + VAT 0 działa.

### Commit
- `chore: verify build, smoke and acceptance flow for offer auto numbering`

---

## Dodatkowe notatki wykonawcze

- Jeśli chcesz zachować kompatybilność wsteczną, stary endpoint `GET /api/pdf/offer/:orderId` może tymczasowo wywoływać logikę `preview` i być oznaczony jako deprecated.
- Logikę kalkulacji kwot warto wydzielić do jednego helpera używanego przez:
  - PDF,
  - podsumowanie w formularzu (spójność wartości).
