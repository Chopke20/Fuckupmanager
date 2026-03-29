# Lama Stage – pomysł aplikacji, raport całości, plan utwardzenia i rozwoju

**Wersja:** 1.0  
**Data:** 2025-03-08  

---

## 1. Pomysł aplikacji (co to jest i po co)

**Lama Stage** to aplikacja do **zarządzania zleceniami eventowymi** (imprezy, konferencje, wydarzenia) z naciskiem na:

- **Klientów** – baza kontrahentów (firmy, dane kontaktowe).
- **Zlecenia** – pełny cykl: od oferty przez harmonogram po rozliczenie (sprzęt, produkcja/logistyka, finanse, zlecenia cykliczne).
- **Sprzęt i zasoby** – katalog sprzętu (np. nagłośnienie) oraz zasobów (np. ludzie), stany, cenniki, kody wewnętrzne.
- **Kalendarz** – widok zleceń i etapów w czasie, rezerwacje, wydarzenia „inne”, szybkie dodawanie zlecenia/rezerwacji z kalendarza.
- **Miejsce realizacji** – podpowiedzi Google Places, odległość drogowa od magazynu (Wał Miedzeszyński 251, Warszawa).
- **Finanse** – kalkulacja netto/brutto, rabat, zysk (przychód minus rentale i podwykonawcy), notatki.
- **AI (opcjonalnie)** – redakcja opisu zlecenia, generowanie opisów sprzętu/zasobów (OpenRouter/DeepSeek).
- **PDF** – generowanie oferty (endpoint gotowy, integracja w toku).

Aplikacja jest **narzędziem wewnętrznym** dla firmy eventowej: jedna baza klientów, zleceń, sprzętu i zasobów, z czytelnym podglądem zlecenia (w tym odległość od magazynu) i kalendarzem.

---

## 2. Architektura i technologia

| Warstwa | Stack |
|--------|--------|
| **Frontend** | React, Vite, TypeScript, React Router, TanStack Query, React Hook Form, Zustand, Tailwind, FullCalendar, Radix UI |
| **Backend** | Node.js, Express, TypeScript, Prisma (ORM) |
| **Baza** | SQLite (dev), możliwość PostgreSQL (prod) |
| **Wspólne typy** | Monorepo `packages/shared-types` (Zod, schematy, DTO) |
| **Zewnętrzne API** | Google Places (autocomplete, Distance Matrix), OpenRouter (AI) |

Struktura: **monorepo** (npm workspaces) – `apps/api`, `apps/web`, `packages/shared-types`. Build: `shared-types` → `api` → `web`. Uruchomienie: `npm run dev` (skrypt `dev-auto.mjs` – db push, wolne porty, API + frontend).

---

## 3. Główne moduły (backend i frontend)

- **Clients** – CRUD klientów, lista z paginacją.
- **Orders** – CRUD zleceń, etapy (harmonogram), pozycje sprzętu i produkcji, statusy, soft delete (Kosz), availability sprzętu, konflikty.
- **Equipment** – katalog sprzętu, kategorie, cenniki, stany, kody wewnętrzne, „rental” w zleceniu; osobno zasoby (filtr ZASOBY) z logiką „Ludzie” (brak stanu).
- **Resources** – widok na zasoby (współdzielona baza z equipment, filtr kategorii).
- **Calendar / Overview** – kalendarz (FullCalendar), zlecenia i etapy, rezerwacje, wydarzenia „inne”, akcje z kalendarza (nowe zlecenie, rezerwacja, edycja).
- **Places** – autocomplete miejsc (Places API v1 + fallback legacy), odległość od magazynu (Distance Matrix), cache.
- **AI** – redakcja opisu zlecenia, generowanie opisów (sprzęt/zasoby).
- **PDF** – oferta PDF po zleceniu (Puppeteer).

---

## 4. Plan utwardzenia konstrukcji

### 4.1. Stabilność buildu i środowiska

- [x] Build bez błędów TypeScript (exclude testów bez vitest, poprawki typów np. OrderFormV4).
- [ ] **CI:** pipeline (np. GitHub Actions) – `npm ci`, `npm run build`, uruchomienie API w tle, `npm run smoke`.
- [ ] **Środowisko:** oficjalnie nie trzymać skompilowanych `.js` w `apps/api/src`; w runbooku opisać usuwanie ich w razie problemów.
- [ ] **Testy jednostkowe:** dodać `vitest` do `apps/web`, włączyć `orderForm.test.ts` i ewentualnie inne testy; skrypt `npm run test`.

### 4.2. Baza danych i migracje

- [ ] Przejście z `db:push` na **Prisma Migrate** – migracje w repo, powtarzalne wdrożenia.
- [ ] Dla produkcji: **PostgreSQL** (lub inna obsługiwana przez Prisma) + zmienne środowiskowe.
- [ ] Backup bazy (harmonogram, skrypty) – osobno do ustalenia w zależności od hostingu.

### 4.3. API i kontrakt

- [ ] Rozszerzyć **smoke** o endpointy: `/api/places/autocomplete`, opcjonalnie `/api/calendar-events`, `/api/places/distance`.
- [ ] Spójna obsługa błędów (middleware już jest) – upewnić się, że wszystkie błędy walidacji/404 zwracają jednolity format.
- [ ] Opcjonalnie: **rate limiting** i **logowanie requestów** (audit) dla krytycznych ścieżek.

### 4.4. Frontend

- [ ] Upewnić się, że **formularze** (zlecenie, klient, sprzęt, zasoby) przy błędach API pokazują czytelny komunikat (toast / inline).
- [ ] **Draft zlecenia** (localStorage) – już jest; rozważyć limit rozmiaru lub wygaszanie starych draftów.
- [ ] **E2E:** utrzymywać/rozwijać Playwright – krytyczne ścieżki: logowanie do listy zleceń, otwarcie formularza, zapis (jeśli będzie auth).

### 4.5. Bezpieczeństwo i konfiguracja

- [ ] Klucze API (Google, OpenRouter) **tylko w zmiennych środowiskowych**, nie w repo.
- [ ] CORS i ewentualnie **auth** (JWT / sesja) – gdy aplikacja ma być wieloużytkownikowa lub wystawiona na zewnątrz.
- [ ] **HTTPS** w produkcji; zmienne dla URLi frontu/API.

---

## 5. Możliwy dalszy rozwój

- **Autentykacja i role** – logowanie, uprawnienia (np. tylko odczyt dla części użytkowników).
- **Oferta PDF end-to-end** – pełna integracja z podglądem i przyciskiem „Generuj ofertę” w UI.
- **Powiadomienia** – np. e-mail przy nowym zleceniu / zmianie statusu (wymaga konfiguracji SMTP lub usługi).
- **Eksport danych** – CSV/Excel klientów, zleceń (częściowo było w planach; można przywrócić w kontrolowany sposób).
- **Wersjonowanie / historia zmian** – audyt pól krytycznych (kto, kiedy zmienił zlecenie).
- **Multi-tenancy** – wiele firm w jednej instancji (duża zmiana; wymaga osobnego planu).
- **Aplikacja mobilna** – widok kalendarza / lista zleceń (React Native lub PWA).
- **Integracje** – księgowość, CRM (API po stronie Lamy lub integracje gotowe).

---

## 6. Podsumowanie

**Lama Stage** to spójna aplikacja do zarządzania zleceniami eventowymi z kalendarzem, finansami, sprzętem i zasobami oraz integracjami (Places, Distance Matrix, AI). Raport stabilności potwierdza **poprawny build** i **działający smoke check API**. Plan utwardzenia koncentruje się na CI, migracjach bazy, rozszerzeniu smoke, testach i bezpieczeństwie; rozwój można kierować w stronę auth, PDF, powiadomień i eksportu zgodnie z priorytetami biznesowymi.
