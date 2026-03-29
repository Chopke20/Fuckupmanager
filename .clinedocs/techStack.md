# Tech Stack — Lama Stage Fuckup Manager

## Przegląd

Aplikacja webowa do zarządzania firmą eventową. Stack dobrany pod kątem:
- **Type safety** end-to-end (TypeScript wszędzie)
- **Modularności** — każdy moduł można rozwijać niezależnie
- **Developer Experience** — szybkie iteracje, czytelny kod
- **Skalowalności** — gotowość na przyszłe rozszerzenia (faktury, role, AI)

---

## Frontend

### React 18 + TypeScript + Vite
- **Dlaczego React**: Dojrzały ekosystem, komponentowy model idealny dla złożonych formularzy
- **Dlaczego TypeScript**: Type safety, autocomplete, refactoring bez strachu
- **Dlaczego Vite**: Błyskawiczny HMR, natywny ESM, szybki build

### shadcn/ui + Tailwind CSS
- **shadcn/ui**: Komponenty headless (Radix UI pod spodem) — pełna kontrola nad stylem, ciemny motyw out-of-the-box
- **Tailwind CSS**: Utility-first, spójny design system, łatwe ciemne motywy (`dark:` prefix)
- **Alternatywy odrzucone**: MUI (zbyt opinionated, trudny dark mode), Ant Design (zbyt korporacyjny wygląd)

### Zustand
- Globalny stan aplikacji (UI state, filtry, aktywne zlecenie)
- Lekki (~1KB), prosty API, brak boilerplate jak w Redux
- **Nie zastępuje** React Query — Zustand = stan UI, React Query = stan serwera

### TanStack Query (React Query v5)
- Cache danych z serwera, automatyczne refetching, optimistic updates
- Obsługa loading/error states out-of-the-box
- Klucze cache per moduł dla precyzyjnej inwalidacji

### React Router v6
- Lazy loading modułów (code splitting per zakładka)
- Nested routes dla widoku zlecenia (sekcje jako sub-routes opcjonalnie)

### FullCalendar (React wrapper)
- Wymagany w specyfikacji
- Widok miesięczny na Overview, kolorowanie per typ etapu
- Integracja z harmonogramem zleceń

### @dnd-kit
- Drag & drop dla kafelków harmonogramu w zleceniu
- Nowoczesny, dostępny (ARIA), lekki
- **Alternatywa odrzucona**: react-beautiful-dnd (deprecated)

### Zod
- Walidacja formularzy (integracja z React Hook Form)
- **Współdzielony** z backendem — jeden schemat walidacji dla frontu i API

### React Hook Form
- Wydajne formularze (minimalne re-rendery)
- Natywna integracja z Zod przez `@hookform/resolvers`

---

## Backend

### Node.js + Express + TypeScript
- **Dlaczego Node.js**: Spójność języka z frontendem, jeden język w całym projekcie
- **Dlaczego Express**: Minimalistyczny, elastyczny, ogromny ekosystem middleware
- **Alternatywa**: FastAPI (Python) — odrzucona ze względu na brak spójności z TS frontendem

### Prisma ORM
- Type-safe queries generowane z schematu
- Automatyczne migracje bazy danych
- Czytelny, deklaratywny schemat (`schema.prisma`)
- Prisma Studio do podglądu danych w dev

### PostgreSQL
- Relacyjna baza — idealna dla złożonych relacji (zlecenia ↔ sprzęt ↔ klienci)
- JSONB dla elastycznych pól (np. konfiguracja wyceny wielodniowej per pozycja)
- Pełne wsparcie dla transakcji (ważne przy rezerwacjach sprzętu)

### Puppeteer
- Generowanie PDF po stronie serwera z szablonu HTML
- Pełna kontrola nad layoutem (CSS → PDF)
- **Alternatywa**: WeasyPrint (Python) — odrzucona ze względu na spójność stacku

### Zod (shared)
- Te same schematy walidacji co na frontendzie
- Walidacja request body w Express middleware

---

## Shared

### packages/shared-types
- Monorepo package z typami TypeScript i schematami Zod
- Importowany zarówno przez `apps/web` jak i `apps/api`
- Eliminuje duplikację typów między frontendem a backendem

---

## Narzędzia deweloperskie

| Narzędzie | Cel |
|---|---|
| **npm workspaces** | Monorepo management (prosto, bez Turborepo overhead) |
| **ESLint** | Linting (reguły dla React, TypeScript) |
| **Prettier** | Formatowanie kodu |
| **Husky + lint-staged** | Pre-commit hooks (lint + format) |
| **dotenv** | Zmienne środowiskowe |

---

## Wersje (docelowe)

```json
{
  "react": "^18.3.0",
  "typescript": "^5.4.0",
  "vite": "^5.2.0",
  "tailwindcss": "^3.4.0",
  "@tanstack/react-query": "^5.0.0",
  "zustand": "^4.5.0",
  "react-router-dom": "^6.22.0",
  "@fullcalendar/react": "^6.1.0",
  "@dnd-kit/core": "^6.1.0",
  "zod": "^3.22.0",
  "react-hook-form": "^7.51.0",
  "express": "^4.18.0",
  "prisma": "^5.11.0",
  "puppeteer": "^22.0.0"
}
```

---

## Decyzje architektoniczne (ADR)

### ADR-001: Monorepo zamiast osobnych repozytoriów
**Decyzja**: Jeden repo z `apps/web`, `apps/api`, `packages/shared-types`  
**Powód**: Współdzielone typy bez publikowania na npm, atomowe commity, łatwiejszy refactoring

### ADR-002: REST zamiast GraphQL
**Decyzja**: REST API z Express  
**Powód**: Prostota, mniejszy overhead, wystarczający dla tej skali aplikacji. GraphQL można dodać później.

### ADR-003: Zod jako single source of truth dla typów
**Decyzja**: Schematy Zod w `packages/shared-types`, typy TypeScript inferowane z Zod  
**Powód**: Walidacja runtime + typy statyczne z jednego miejsca, brak duplikacji

### ADR-004: Puppeteer zamiast bibliotek PDF
**Decyzja**: HTML template → Puppeteer → PDF  
**Powód**: Pełna kontrola nad layoutem CSS, łatwe utrzymanie szablonu, WYSIWYG
