# Architektura — Lama Stage Fuckup Manager

## Diagram warstw

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRZEGLĄDARKA                             │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    apps/web (React)                      │   │
│  │                                                          │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │   │
│  │  │ Overview │  │ Zlecenia │  │ Klienci  │  │ Sprzęt │  │   │
│  │  │  module  │  │  module  │  │  module  │  │ module │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────┘  │   │
│  │                                                          │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │              shared/                             │    │   │
│  │  │  components/ │ hooks/ │ utils/ │ lib/api-client  │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │                                                          │   │
│  │  State: Zustand (UI) + TanStack Query (server cache)     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTP REST
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    apps/api (Node.js + Express)                  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Middleware Stack                       │  │
│  │  cors │ helmet │ express.json │ zod-validator │ logger    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ /orders  │  │ /clients │  │/equipment│  │    /pdf      │  │
│  │  router  │  │  router  │  │  router  │  │   router     │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │              │              │                │          │
│  ┌────▼──────────────▼──────────────▼────────────────▼──────┐  │
│  │                    Service Layer                          │  │
│  │  OrderService │ ClientService │ EquipmentService │ PDF    │  │
│  └────────────────────────────┬──────────────────────────────┘  │
│                               │                                 │
│  ┌────────────────────────────▼──────────────────────────────┐  │
│  │                    Prisma ORM                             │  │
│  └────────────────────────────┬──────────────────────────────┘  │
└───────────────────────────────┼─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       PostgreSQL                                │
│                                                                 │
│  clients │ orders │ order_stages │ equipment │ order_equipment  │
│  order_production_items │ equipment_reservations               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Struktura katalogów — szczegółowa

```
lama-stage/
│
├── .clinedocs/                     # Dokumentacja architektoniczna
│   ├── techStack.md
│   ├── architecture.md
│   └── dataModel.md
│
├── IMPLEMENTATION_PLAN.md          # Plan implementacji krok po kroku
│
├── package.json                    # Root package.json (npm workspaces)
├── .eslintrc.js                    # Wspólna konfiguracja ESLint
├── .prettierrc                     # Konfiguracja Prettier
├── tsconfig.base.json              # Bazowy tsconfig
│
├── apps/
│   │
│   ├── web/                        # Frontend React
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── tailwind.config.ts
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx            # Entry point
│   │       ├── App.tsx             # Router + QueryClient + Providers
│   │       │
│   │       ├── modules/            # Moduły funkcjonalne (feature-based)
│   │       │   ├── overview/
│   │       │   │   ├── index.tsx           # Lazy-loaded route component
│   │       │   │   ├── OverviewPage.tsx
│   │       │   │   ├── components/
│   │       │   │   │   ├── ClockWidget.tsx
│   │       │   │   │   ├── MiniCalendar.tsx
│   │       │   │   │   ├── UpcomingOrders.tsx
│   │       │   │   │   └── ConflictsPanel.tsx
│   │       │   │   └── hooks/
│   │       │   │       └── useOverviewData.ts
│   │       │   │
│   │       │   ├── orders/
│   │       │   │   ├── index.tsx
│   │       │   │   ├── OrdersListPage.tsx
│   │       │   │   ├── OrderFormPage.tsx   # Główny formularz zlecenia
│   │       │   │   ├── components/
│   │       │   │   │   ├── OrderCard.tsx
│   │       │   │   │   ├── OrderFilters.tsx
│   │       │   │   │   ├── sections/       # Sekcje formularza
│   │       │   │   │   │   ├── HeaderSection.tsx
│   │       │   │   │   │   ├── ScheduleSection.tsx
│   │       │   │   │   │   ├── EquipmentSection.tsx
│   │       │   │   │   │   ├── ProductionSection.tsx
│   │       │   │   │   │   ├── FinancialSummary.tsx
│   │       │   │   │   │   ├── RecurringSection.tsx
│   │       │   │   │   │   └── PdfSection.tsx
│   │       │   │   │   └── StickyNav.tsx   # Lewy panel skrótów
│   │       │   │   ├── hooks/
│   │       │   │   │   ├── useOrderForm.ts
│   │       │   │   │   ├── useOrderCalculations.ts
│   │       │   │   │   └── useEquipmentAvailability.ts
│   │       │   │   └── store/
│   │       │   │       └── orderFormStore.ts  # Zustand store dla formularza
│   │       │   │
│   │       │   ├── clients/
│   │       │   │   ├── index.tsx
│   │       │   │   ├── ClientsListPage.tsx
│   │       │   │   ├── ClientFormPage.tsx
│   │       │   │   └── components/
│   │       │   │       ├── ClientCard.tsx
│   │       │   │       └── ClientOrderHistory.tsx
│   │       │   │
│   │       │   └── equipment/
│   │       │       ├── index.tsx
│   │       │       ├── EquipmentListPage.tsx
│   │       │       ├── EquipmentFormPage.tsx
│   │       │       └── components/
│   │       │           ├── EquipmentCard.tsx
│   │       │           ├── AvailabilityBadge.tsx
│   │       │           └── CategoryFilter.tsx
│   │       │
│   │       ├── shared/             # Współdzielone elementy UI
│   │       │   ├── components/
│   │       │   │   ├── layout/
│   │       │   │   │   ├── AppLayout.tsx       # Główny layout z nawigacją
│   │       │   │   │   ├── Sidebar.tsx
│   │       │   │   │   └── TopBar.tsx
│   │       │   │   ├── ui/                     # shadcn/ui komponenty
│   │       │   │   ├── FabButton.tsx           # Floating Action Button "+"
│   │       │   │   ├── DataTable.tsx           # Reużywalna tabela
│   │       │   │   ├── AutocompleteInput.tsx   # Autocomplete z bazy
│   │       │   │   ├── ConfirmDialog.tsx
│   │       │   │   └── StatusBadge.tsx
│   │       │   ├── hooks/
│   │       │   │   ├── useDebounce.ts
│   │       │   │   └── useLocalStorage.ts
│   │       │   └── utils/
│   │       │       ├── formatters.ts           # PLN, daty, procenty
│   │       │       └── calculations.ts         # Logika wyceny
│   │       │
│   │       └── lib/
│   │           ├── api-client.ts               # Axios instance + interceptors
│   │           ├── query-client.ts             # TanStack Query config
│   │           └── router.ts                   # React Router config
│   │
│   └── api/                        # Backend Node.js
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts            # Entry point (Express app)
│           ├── app.ts              # Express setup, middleware
│           │
│           ├── modules/            # Moduły domenowe
│           │   ├── orders/
│           │   │   ├── orders.router.ts
│           │   │   ├── orders.service.ts
│           │   │   ├── orders.controller.ts
│           │   │   └── orders.queries.ts   # Złożone Prisma queries
│           │   │
│           │   ├── clients/
│           │   │   ├── clients.router.ts
│           │   │   ├── clients.service.ts
│           │   │   └── clients.controller.ts
│           │   │
│           │   ├── equipment/
│           │   │   ├── equipment.router.ts
│           │   │   ├── equipment.service.ts
│           │   │   └── equipment.controller.ts
│           │   │
│           │   └── pdf/
│           │       ├── pdf.router.ts
│           │       ├── pdf.service.ts          # Puppeteer logic
│           │       └── templates/
│           │           └── offer.template.html # HTML template oferty
│           │
│           ├── shared/
│           │   ├── middleware/
│           │   │   ├── validate.middleware.ts  # Zod validation
│           │   │   ├── error.middleware.ts     # Global error handler
│           │   │   └── logger.middleware.ts
│           │   ├── errors/
│           │   │   └── AppError.ts             # Custom error classes
│           │   └── utils/
│           │       └── calculations.ts         # Logika finansowa (server-side)
│           │
│           └── prisma/
│               ├── schema.prisma
│               ├── client.ts                   # Prisma client singleton
│               └── migrations/
│
└── packages/
    └── shared-types/               # Współdzielone typy i schematy
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── index.ts            # Re-export wszystkiego
            ├── schemas/
            │   ├── order.schema.ts
            │   ├── client.schema.ts
            │   ├── equipment.schema.ts
            │   └── common.schema.ts
            └── types/
                ├── order.types.ts  # Inferowane z Zod schemas
                ├── client.types.ts
                └── equipment.types.ts
```

---

## Przepływ danych

### Tworzenie zlecenia

```
User Input
    │
    ▼
OrderFormPage (React)
    │ useForm (React Hook Form + Zod)
    ▼
orderFormStore (Zustand)
    │ Lokalne obliczenia (kalkulacje finansowe)
    ▼
api-client.ts (Axios)
    │ POST /api/orders
    ▼
validate.middleware.ts (Zod)
    │
    ▼
orders.controller.ts
    │
    ▼
orders.service.ts
    │ Transakcja Prisma (order + stages + items)
    ▼
PostgreSQL
    │
    ▼
TanStack Query cache invalidation
    │
    ▼
UI update (optimistic lub po refetch)
```

### Generowanie PDF

```
User klika "Generuj ofertę techniczną"
    │
    ▼
POST /api/pdf/offer/:orderId
    │
    ▼
pdf.service.ts
    │ Pobiera dane zlecenia z Prisma
    │ Renderuje offer.template.html z danymi
    │ Puppeteer: HTML → PDF buffer
    ▼
Response: PDF jako binary stream
    │
    ▼
Browser: automatyczne pobieranie pliku
```

### Sprawdzanie dostępności sprzętu

```
User wybiera sprzęt w formularzu zlecenia
    │
    ▼
useEquipmentAvailability hook
    │ GET /api/equipment/:id/availability?from=&to=
    ▼
equipment.service.ts
    │ Query: equipment_reservations WHERE date BETWEEN from AND to
    │ Oblicza dostępną ilość = stock - reserved
    ▼
AvailabilityBadge (zielony/żółty/czerwony)
```

---

## Wzorce architektoniczne

### Feature-based modules (frontend)
Każdy moduł (`orders/`, `clients/`, `equipment/`, `overview/`) jest samowystarczalny:
- Własne komponenty, hooki, store
- Lazy-loaded przez React Router
- Komunikuje się z resztą tylko przez API lub shared hooks

### Controller → Service → Repository (backend)
- **Controller**: Parsuje request, wywołuje service, zwraca response
- **Service**: Logika biznesowa, orkiestracja
- **Prisma**: Bezpośredni dostęp do bazy (Prisma zastępuje osobną warstwę repository)

### Shared types jako single source of truth
```typescript
// packages/shared-types/src/schemas/order.schema.ts
export const CreateOrderSchema = z.object({
  name: z.string().min(1),
  clientId: z.string().uuid(),
  // ...
})

export type CreateOrderDto = z.infer<typeof CreateOrderSchema>
// Ten sam typ używany na frontendzie i backendzie
```

---

## Bezpieczeństwo i jakość

### Walidacja
- Wszystkie dane wejściowe walidowane przez Zod (frontend + backend)
- Prisma zapewnia type-safe queries (brak SQL injection)

### Error handling
- Globalny middleware `error.middleware.ts` łapie wszystkie błędy
- Custom `AppError` klasy z kodami HTTP
- Frontend: TanStack Query obsługuje loading/error states

### Przyszłe rozszerzenia (przygotowane)
| Feature | Jak dodać |
|---|---|
| Autentykacja | Middleware JWT w Express + AuthContext w React |
| Role użytkowników | Pole `role` w tabeli `users`, middleware autoryzacji |
| Faktury | Nowy moduł `invoices/` (frontend + backend), nowa tabela |
| Stany magazynowe | Tabela `stock_movements` już w schemacie, UI do dodania |
| Integracja email | Nowy moduł `notifications/`, np. Nodemailer |
| Oferty AI | Nowy endpoint `/api/pdf/offer-ai`, integracja z OpenAI |
