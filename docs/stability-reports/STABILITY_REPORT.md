# Raport stabilności aplikacji Lama Stage

**Data:** 2025-03-08  
**Zakres:** pełna aplikacja (monorepo: shared-types, api, web).

---

## 1. Wyniki testów

| Test | Wynik | Uwagi |
|------|--------|--------|
| **Build (root)** | ✅ | `npm run build` – shared-types, api, web |
| **Smoke check API** | ✅ | Wymaga uruchomionego API (`npm run dev` lub API na localhost:3000) |
| **E2E (Playwright)** | ⚠️ Nie uruchamiano | Dostępne: `npm run e2e`, `npm run e2e:ui` |
| **Lint** | ⚠️ Nie uruchamiano | `npm run lint` |

### Wykonane poprawki przed raportem

- **apps/web/tsconfig.json:** wykluczenie plików `**/*.test.ts` i `**/*.test.tsx` z kompilacji (brak modułu `vitest` w build).
- **OrderFormV4.tsx:** dodanie pola `isRental` w payloadzie pozycji sprzętu (zgodność z `CreateOrderEquipmentItemDto`).

---

## 2. Smoke check – pokrycie

Obecny skrypt (`scripts/smoke-check.mjs`) weryfikuje:

- `GET /health` – status OK
- `GET /api/clients?page=1&limit=1` – format `{ data, meta }`
- `GET /api/orders?page=1&limit=1` – format `{ data, meta }`
- `GET /api/equipment?page=1&limit=1` – format `{ data, meta }`
- `GET /api/orders/:id` – pojedyncze zlecenie (na podstawie pierwszego ID z listy)

**Nie są objęte smoke:** `/api/places/*`, `/api/calendar-events`, `/api/ai`, `/api/pdf`, `/api/blocks`, lista zasobów (equipment z filtrem ZASOBY). Warto rozszerzyć smoke o przynajmniej `GET /api/places/autocomplete?query=test` i ewentualnie `GET /api/calendar-events`.

---

## 3. Znane ryzyka i ograniczenia

1. **Środowisko dev**
   - W `apps/api/src` nie powinno być skompilowanych plików `.js` obok `.ts` – mogą być ładowane zamiast źródeł i powodować „brak podpowiedzi” / stare zachowanie. Rozwiązanie: budować tylko do `dist/`, nie trzymać `.js` w `src/`.
   - Restart API po zmianach: `ts-node-dev` przeładowuje przy zapisie; przy problemach – ręczny restart.

2. **Zależności zewnętrzne**
   - **Google APIs:** Places (New), Places (Legacy), Distance Matrix – wymagają włączonych API w Google Cloud i klucza `GOOGLE_MAPS_API_KEY`. Przy braku klucza lub błędach API podpowiedzi miejsc i odległość są puste (aplikacja nie pada).
   - **OpenRouter (AI):** `OPENROUTER_API_KEY` – opcjonalne; brak klucza wyłącza funkcje AI (redakcja opisu, generowanie opisów sprzętu/zasobów).

3. **Baza danych**
   - SQLite (`file:./dev.db`) – odpowiednia na dev i małe wdrożenia. Produkcja: rozważyć PostgreSQL (Prisma obsługuje).
   - Migracje: projekt używa `db:push`; dla ścisłej historii zmian warto wprowadzić `db:migrate` i trzymać migracje w repo.

4. **Testy jednostkowe**
   - Plik `orderForm.test.ts` używa `vitest` – nie jest w build (exclude). Aby uruchamiać testy: dodać `vitest` do devDependencies w `apps/web` i skrypt `test` w package.json.

---

## 4. Rekomendacje krótkoterminowe

- **Smoke:** dodać do smoke sprawdzenie `/api/places/autocomplete?query=Warszawa` (oczekiwany format `{ data: [] }` lub tablica z `placeId`, `description`) oraz opcjonalnie `GET /api/calendar-events`.
- **CI:** w pipeline uruchamiać `npm run build` oraz `npm run smoke` (z uruchomionym API w tle lub w osobnym kroku).
- **Runbook:** trzymać w `docs/dev-runbook.md` informację o usuwaniu `.js` z `apps/api/src` w razie problemów z „starym kodem”.

---

## 5. Podsumowanie

Aplikacja **buduje się poprawnie** i **smoke check API przechodzi** przy działającym backendzie. Główne ryzyka to: środowisko dev (stare `.js` w src), zależność od zewnętrznych API (Google, OpenRouter) oraz brak pełnego pokrycia smoke dla wszystkich modułów. Wprowadzone poprawki (exclude testów, `isRental` w OrderFormV4) umożliwiają stabilny build i są podstawą do dalszego utwardzania (patrz raport pomysłu i planu rozwoju).
