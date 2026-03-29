# Twarda specyfikacja wdrożenia: Oferta PDF (model AUTO)

## 1) Zakres i decyzje zamrożone

Ta specyfikacja dotyczy tylko generatora `oferta PDF` i trybu numeracji `AUTO`.

Ustalone reguły:
- Każde kliknięcie `Generuj` tworzy nowy numer oferty (nowa wersja).
- Numer zlecenia powstaje przy utworzeniu zlecenia.
- Numeracja zleceń resetuje się co rok.
- Format numeru oferty: `orderNumber.offerVersion.orderYear` (np. `16.1.2026`).
- Nazwa pliku: `Oferta-{offerNumber}.pdf`.
- Oferta ważna: domyślnie 14 dni (edytowalne w editorze i zapisywane do zlecenia).
- Opiekun: wybór z 2 predefiniowanych osób.
- Transport to pozycja produkcji (osobna sekcja w PDF).
- Sprzęt grupowany dynamicznie po kategoriach.
- Harmonogram pokazuje tylko etapy istniejące w zleceniu.
- Obsługa per block/faza; pozycje bez etapu na końcu bez adnotacji.
- Waluty: `PLN` i `EUR`; dla `EUR` PDF pokazuje tylko EUR.
- VAT: tylko `23` albo `0`.
- Pozostałe dokumenty (`proposal`, `magazyn załadunek`, `brief techniczny`) na razie jako przyciski `w przygotowaniu`.

Poza zakresem tego etapu:
- Tryb ręcznej numeracji oferty (MANUAL).
- Automatyczna wycena transportu od dystansu (tylko przygotowanie pod przyszłość).

---

## 2) Zmiany modelu danych (Prisma)

## 2.1. `Order` – nowe pola

Dodać do modelu `Order`:
- `orderYear Int` – rok numeracji zlecenia.
- `orderNumber Int` – numer zlecenia w ramach roku.
- `offerVersion Int @default(0)` – ostatnia wygenerowana wersja oferty.
- `offerNumber String?` – ostatni wygenerowany numer oferty (dla szybkiego podglądu).
- `offerValidityDays Int @default(14)`.
- `projectContactKey String?` – klucz opiekuna (`RAFAL`/`MICHAL`).
- `currency String @default("PLN")` – `PLN`/`EUR`.
- `exchangeRateEur Float?` – kurs EUR.

Indeksy/unikalność:
- `@@unique([orderYear, orderNumber])` (unikalny numer zlecenia w roku).
- `@unique` na `offerNumber` (unikalność ostatnio wygenerowanego numeru).

Uwaga:
- Jeśli istnieją stare rekordy, dodać migrację z backfillem:
  - `orderYear = year(createdAt)`,
  - `orderNumber` wg kolejności `createdAt` w obrębie roku.

## 2.2. Tabela sekwencji rocznej

Dodać model:
- `OrderYearSequence`
  - `year Int @id`
  - `lastNumber Int @default(0)`
  - `updatedAt DateTime @updatedAt`

Cel: bezpieczne, transakcyjne nadawanie numeru zlecenia bez kolizji.

---

## 3) Reguły numeracji (algorytmy)

## 3.1. Nadanie numeru zlecenia przy tworzeniu

W `createOrder`:
1. `year = current year` (strefa Europe/Warsaw).
2. W transakcji:
   - odczyt `OrderYearSequence(year)`,
   - jeśli brak -> utwórz z `lastNumber = 1`,
   - jeśli jest -> `lastNumber += 1`,
   - przypisz do zlecenia:
     - `orderYear = year`,
     - `orderNumber = lastNumber`.

## 3.2. Generowanie numeru oferty przy kliknięciu `Generuj`

Nowy endpoint generacji (mutacja) musi:
1. Wczytać zlecenie.
2. Zwiększyć `offerVersion = offerVersion + 1`.
3. Złożyć `offerNumber = "${orderNumber}.${offerVersion}.${orderYear}"`.
4. Zapisać `offerVersion` i `offerNumber` w `Order`.
5. Wygenerować PDF i zwrócić plik.
6. Ustawić nagłówek:
   - `Content-Disposition: attachment; filename="Oferta-{offerNumber}.pdf"`.

Reguła unikalności:
- `offerNumber` jest unikalne w bazie; przy kolizji endpoint zwraca błąd domenowy i nie generuje pliku.

---

## 4) API kontrakt (backend)

## 4.1. Nowe endpointy PDF

Zamiast obecnego `GET /api/pdf/offer/:orderId` (mutowalny `GET`), wprowadzić:

1. `POST /api/pdf/offer/:orderId/preview`
- Nie podbija wersji.
- Generuje podgląd PDF na aktualnych danych zlecenia.
- Zwraca `application/pdf`.

2. `POST /api/pdf/offer/:orderId/generate`
- Podbija wersję i zapisuje `offerNumber`.
- Generuje finalny PDF.
- Zwraca `application/pdf` z nazwą `Oferta-{offerNumber}.pdf`.

3. (opcjonalnie) `GET /api/pdf/offer/:orderId/meta`
- Zwraca dane pomocnicze do UI (ostatni numer, kolejny numer, data ważności).

## 4.2. Kurs EUR

Dodać prosty endpoint:
- `GET /api/finance/exchange-rate/eur`
  - zwraca `{ data: { rate: number, date: string, source: "NBP" } }`
  - cache in-memory 12h.

Fallback:
- gdy API kursu niedostępne: zwrócić czytelny błąd; UI pozwala wpisać kurs ręcznie.

## 4.3. Walidacje backend

- `vatRate` tylko `0` lub `23`.
- `currency` tylko `PLN` lub `EUR`.
- `offerValidityDays` min `1`, max `90`.
- `projectContactKey` tylko `RAFAL` lub `MICHAL`.

---

## 5) UI/UX (frontend)

## 5.1. Dokumenty w zleceniu

W `OrderFormPage` dodać blok `Dokumenty` z przyciskami:
- `Oferta PDF` (aktywny),
- `Oferta proposal` (disabled + etykieta `w przygotowaniu`),
- `Magazyn załadunek` (disabled + etykieta `w przygotowaniu`),
- `Brief techniczny` (disabled + etykieta `w przygotowaniu`).

## 5.2. Editor generowania oferty PDF (modal)

Pola:
- `offerValidityDays` (domyślnie 14),
- `projectContactKey` (RAFAL/MICHAL),
- `currency` (PLN/EUR),
- `exchangeRateEur` (widoczne gdy EUR; prefill z endpointu kursu),
- `vatRate` (23/0).

Akcje:
- `Podgląd PDF` -> `POST /preview` (bez podbijania wersji).
- `Generuj PDF` -> zapis pól do zlecenia + `POST /generate` (podbijanie wersji).

Ważne:
- Klik `Generuj PDF` zawsze tworzy nową wersję.
- W UI pokazać:
  - `Ostatni numer: X`,
  - `Następny numer: Y` (wyliczony).

## 5.3. Zapis przed generacją

Przed `preview/generate`:
- jeśli formularz ma niezapisane zmiany:
  - zapisać zlecenie (`create/update`) i dopiero wykonać akcję PDF.

---

## 6) Szablon PDF – wymagania treści i układu

## 6.1. Nagłówek
- Miejsce i data wystawienia.
- `Oferta ważna: {offerValidityDays} dni`.
- `Oferta nr: {offerNumber}`.
- Dane firmy Lama Stage (stałe konfiguracyjne).
- Dane klienta ze zlecenia.

## 6.2. Opis
- Tylko z `order.description`.

## 6.3. Harmonogram
- Tabela etapów tylko dla istniejących wpisów (`MONTAZ`, `EVENT`, `DEMONTAZ`, `CUSTOM`).

## 6.4. Sprzęt
- Grupowanie po `category` (dynamicznie).
- Wiersze: LP, Nazwa, Ilość, Cena netto, Rabat %, Dni, Wartość netto, VAT, Wartość brutto.
- Suma na sekcję i suma globalna sprzętu.

## 6.5. Produkcja i logistyka
- Sekcja `Transport`: pozycje produkcji oznaczone transportem.
- Sekcje per etap (block): `MONTAŻ`, `DEMONTAŻ`, `EVENT` wg `stageIds`.
- Na końcu pozycje bez etapu, bez dodatkowej adnotacji.

## 6.6. Podsumowanie
- Wartość sprzętu.
- Wartość transportu.
- Wartość obsługi.
- Przychód netto przed rabatem.
- Rabat globalny.
- Netto po rabacie.
- VAT (0/23).
- Brutto.
- Blok cykliczny tylko gdy `isRecurring = true`.

## 6.7. Waluta
- Gdy `currency = EUR` wszystkie kwoty w EUR.
- Brak równoległej prezentacji PLN w PDF.

## 6.8. Stopka
- Opiekun projektu wg `projectContactKey`:
  - RAFAL -> Rafał Szydłowski, 504361781
  - MICHAL -> Michał Rokicki, 793435302
- Tekst poufności jak we wzorze Lama Stage.

---

## 7) Mapowanie plików do zmian

Backend:
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/orders/orders.service.ts`
- `apps/api/src/modules/orders/orders.controller.ts`
- `apps/api/src/modules/pdf/pdf.router.ts`
- `apps/api/src/modules/pdf/pdf.controller.ts`
- `apps/api/src/modules/finance/*` (nowy moduł kursu EUR)
- `packages/shared-types/src/schemas/order.schema.ts`

Frontend:
- `apps/web/src/modules/orders/pages/OrderFormPage.tsx`
- `apps/web/src/modules/orders/components/*` (modal editor dokumentów)
- `apps/web/src/shared/api/client.ts` (jeśli potrzeba helperów pobierania blob)
- `apps/web/src/modules/orders/api/order.api.ts` lub nowy `pdf.api.ts`

---

## 8) Testy i kryteria odbioru (Definition of Done)

## 8.1. Numeracja
- Tworząc nowe zlecenie dostaje numer `N` dla danego roku.
- Dwa równoległe create nie dają tego samego `orderNumber`.
- Po zmianie roku numeracja startuje od `1`.

## 8.2. Generowanie PDF
- Pierwsze kliknięcie `Generuj` -> `offerVersion=1`, `offerNumber=N.1.RRRR`.
- Kolejne kliknięcie -> `N.2.RRRR`, itd.
- Każdy pobrany plik ma unikalną nazwę `Oferta-{offerNumber}.pdf`.
- `Podgląd PDF` nie zmienia `offerVersion`.

## 8.3. Zawartość PDF
- Są dane firmy, klienta, numer, ważność, opis.
- Harmonogram pokazuje tylko istniejące etapy.
- Sprzęt grupuje się po kategoriach dynamicznie.
- Transport i obsługa liczą się osobno w podsumowaniu.
- Pozycje bez etapu są na końcu sekcji obsługi.
- Dla EUR wszystkie kwoty są w EUR.
- VAT działa dla 23 i 0.

## 8.4. UI
- W zleceniu widoczne 4 typy dokumentów; 3 nieaktywne mają status `w przygotowaniu`.
- Editor zapisuje pola do zlecenia.
- Podgląd działa przed generacją.

---

## 9) Plan wdrożenia (kolejność)

1. Migracja Prisma + backfill numeracji historycznej.
2. Walidacje shared-types (`currency`, `vatRate`, nowe pola).
3. Numeracja roczna w `createOrder`.
4. Nowe endpointy `preview/generate` i logika `offerVersion`.
5. Generator PDF wg nowego układu i sekcji.
6. Moduł kursu EUR (NBP + cache).
7. UI dokumentów + modal editor + podgląd.
8. Testy ręczne E2E flow ofert iteracyjnych.

---

## 10) Ryzyka i zabezpieczenia

- **Kolizje numerów przy równoległych requestach** -> sekwencja roczna + transakcja.
- **Zmiana strefy czasowej na granicy roku** -> rok liczony w strefie Warsaw.
- **Niedostępne API kursu EUR** -> fallback do ręcznego wpisu.
- **Duże PDF i timeouty Puppeteer** -> limit czasu, czytelny błąd i retry.
- **Rozjazd kwot UI vs PDF** -> wspólna funkcja kalkulacji (wydzielić do modułu shared).
