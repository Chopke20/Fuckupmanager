# Pobieranie firmy po NIP (DataPort.pl)

Przycisk **„Pobierz”** przy polu NIP (formularz klienta, profile wystawcy w Admin) wywołuje backend, który łączy się z **DataPort.pl** (dane z rejestru **GUS BIR 1.1**).

## Konfiguracja (`apps/api/.env` lub `.env` w rootzie)

Zmienne wczytuje **`src/load-env.ts`** przy starcie API (przed `app.ts`). Plik **`apps/api/.env`** jest ładowany z **`override: true`**, żeby wartości z pliku wygrywały z pustymi zmiennymi z otoczenia (np. po `npm run dev` z roota). Szukane ścieżki: obok `dist`/`src`, `process.cwd()/.env`, `process.cwd()/apps/api/.env`.

```env
DATAPORT_API_KEY=<klucz z panelu DataPort>
```

Opcjonalnie inna baza URL (domyślnie `https://dataport.pl/api`):

```env
DATAPORT_API_BASE_URL=https://dataport.pl/api
```

**Bezpieczeństwo:** nie commituj klucza do repozytorium. Jeśli klucz trafił do czatu lub logów, wygeneruj nowy w panelu DataPort.

## Endpoint aplikacji

`POST /api/integrations/nip-lookup/lookup`  
Body: `{ "nip": "1234567890" }` (10 cyfr)  
Odpowiedź: `{ "data": { "companyName", "address", "nip", "regon?" } }` — zgodnie z `NipCompanyLookupResultSchema` w `packages/shared-types`.

## API zewnętrzne

- Dokumentacja: [dataport.pl/api/reference](https://dataport.pl/api/reference)
- Wywołanie: `GET {base}/v1/company/{nip}?format=simple` z nagłówkiem `X-API-Key`
- Gdy `format=simple` nie zwróci pola `adres`, wykonywane jest drugie zapytanie z `format=full` i adres składany z ulicy, kodu i miasta.

Uprawnienia jak wcześniej: `clients.write` **lub** `orders.read` **lub** `admin.users.write`.
