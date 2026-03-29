# Runbook – uruchomienie projektu Lama

## Wymagania

- Node.js 18+
- npm (workspaces)

## Pierwsze uruchomienie

1. **Zainstaluj zależności** (w katalogu głównym projektu):
   ```bash
   npm install
   ```

2. **Zbuduj shared-types** (wymagane przed API i frontendem):
   ```bash
   npm run build -w packages/shared-types
   ```

3. **Baza danych** (API używa SQLite):
   - Upewnij się, że w `apps/api` istnieje plik `.env` z `DATABASE_URL`, np.:
     ```
     DATABASE_URL="file:./dev.db"
     ```
   - Szybkie utworzenie/aktualizacja schematu:
     ```bash
     npm run db:push
     ```
   - Migracje (jeśli używasz migracji):
     ```bash
     npm run db:migrate
     ```
   - (Opcjonalnie) seed:
     ```bash
     npm run db:seed
     ```
   - Przy polu NIP przycisk **„Pobierz”** (klienci, profile w Admin): backend **DataPort.pl** — ustaw `DATAPORT_API_KEY` w **`apps/api/.env`** (lub `.env` w rootzie), zob. `docs/dataport-nip-lookup.md`.

3b. **Backup bazy (panel Admin)**  
   - W panelu Admin (po zalogowaniu jako użytkownik z uprawnieniem `admin.backup`) jest sekcja „Backup bazy danych” — przycisk „Pobierz backup bazy (.db)” pobiera pełną kopię SQLite na dysk.
   - Opcjonalnie w `apps/api/.env`: `BACKUP_DIR=<ścieżka>` — przy każdym pobraniu backupu kopia zapisuje się też w tym katalogu (np. zewnętrzny dysk lub NAS).  
   - Jeśli baza nie jest w domyślnej lokalizacji: `BACKUP_DATABASE_PATH=<pełna ścieżka do pliku .db>`.

4. **Uruchom aplikację**:
   ```bash
   npm run dev
   ```
   - Skrypt `dev` automatycznie wybierze wolne porty (start od `3000` i `5173`).
   - W logu zobaczysz finalne adresy API i frontendu.

5. **Sprawdzenie działania (smoke check)**  
   W drugim terminalu, gdy API już działa:
   ```bash
   npm run smoke
   ```

## Gdy coś nie działa

### Port 3000 lub 5173 zajęty

- Domyślnie nie trzeba nic robić: `npm run dev` sam znajdzie wolny port.
- Jeśli chcesz ręcznie: użyj `npm run dev:legacy` i wtedy ewentualnie zwolnij porty.

### Błąd 500 na /api/orders lub /api/clients

- Sprawdź logi w terminalu, gdzie działa API – middleware błędów wypisuje szczegóły.
- Upewnij się, że baza jest zmigrowana: `npm run db:migrate`.
- Uruchom smoke check: `npm run smoke`  
  - PowerShell (inny port): `$env:API_URL='http://localhost:<port>'; npm run smoke`

### Biały ekran / błąd importu w przeglądarce

- Zbuduj ponownie shared-types: `npm run build -w packages/shared-types`.
- Zrestartuj dev (Ctrl+C, potem `npm run dev`).
- Sprawdź, że w `apps/api/src` nie ma plików `.js` (tylko `.ts`). Jeśli są – usuń je (build ma być w `dist/`).

## Skrypty w katalogu głównym

| Skrypt        | Opis |
|---------------|------|
| `npm run dev` | Uruchamia API i frontend na wolnych portach (auto-detekcja). |
| `npm run dev:legacy` | Stary tryb `concurrently` na domyślnych portach. |
| `npm run build` | Buduje shared-types, API i web. |
| `npm run smoke` | Smoke check API (health, clients, orders). |
| `npm run db:push` | Synchronizacja schematu Prisma z bazą. |
| `npm run db:migrate` | Migracje Prisma (API). |
| `npm run db:seed` | Seed bazy (API). |

## Kontrakt API (lista)

- **Lista (klienci / zlecenia):** odpowiedź `{ data: [...], meta: { total, page, lastPage } }`.
- **Detal / create / update:** odpowiedź `{ data: <obiekt> }`.
- Frontend w `client.api.ts` i `order.api.ts` dopasowany do tego formatu.

## Raport stabilności po dużej zmianie

Po większym refaktorze, zmianie kontraktu API lub modułów (np. orders, clients, equipment):

1. **Weryfikacja obowiązkowa**
   - `npm run build` (root) – musi przejść.
   - `npm run smoke` (API musi być uruchomione; ustaw `API_URL` jeśli inny port).
   - Przejście manualne: Klienci, Zlecenia – lista i formularz bez 500 / białego ekranu.

2. **Opcjonalnie – raport w repo**
   - W katalogu `docs/stability-reports/` dodaj plik `YYYY-MM-DD-krótki-opis.md`.
   - Szablon: data, co zmieniono, wynik build/smoke, uwagi (np. znane ograniczenia).
   - Dzięki temu historia „czy po zmianie było zielono” zostaje w projekcie bez zaśmiecania roota.
