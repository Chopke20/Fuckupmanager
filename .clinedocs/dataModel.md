# Model Danych — Lama Stage Fuckup Manager

## Diagram ERD (uproszczony)

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────────┐
│   clients   │       │     orders       │       │   equipment     │
│─────────────│       │──────────────────│       │─────────────────│
│ id (PK)     │◄──────│ clientId (FK)    │       │ id (PK)         │
│ companyName │       │ id (PK)          │       │ name            │
│ contactName │       │ name             │       │ description     │
│ address     │       │ description      │       │ category        │
│ nip         │       │ status           │       │ dailyPrice      │
│ email       │       │ venue            │       │ stockQuantity   │
│ phone       │       │ dateFrom         │       │ unit            │
│ notes       │       │ dateTo           │       │ internalCode    │
│ createdAt   │       │ discountGlobal   │       │ technicalNotes  │
│ updatedAt   │       │ vatRate          │       │ imageUrl        │
└─────────────┘       │ parentOrderId    │       │ visibleInOffer  │
                      │ isRecurring      │       │ pricingRule     │
                      │ recurringConfig  │       │ createdAt       │
                      │ createdAt        │       │ updatedAt       │
                      │ updatedAt        │       └────────┬────────┘
                      └──────┬───────────┘                │
                             │                            │
              ┌──────────────┼──────────────┐             │
              │              │              │             │
              ▼              ▼              ▼             │
    ┌──────────────┐ ┌──────────────┐ ┌────────────────┐ │
    │ order_stages │ │ order_equip- │ │ order_produc-  │ │
    │──────────────│ │ ment_items   │ │ tion_items     │ │
    │ id (PK)      │ │──────────────│ │────────────────│ │
    │ orderId (FK) │ │ id (PK)      │ │ id (PK)        │ │
    │ type         │ │ orderId (FK) │ │ orderId (FK)   │ │
    │ label        │ │ equipmentId  │◄┘ name           │ │
    │ date         │ │   (FK, null) │   description    │ │
    │ timeStart    │ │ name         │   rateType       │ │
    │ timeEnd      │ │ description  │   rateValue      │ │
    │ notes        │ │ quantity     │   units          │ │
    │ sortOrder    │ │ unitPrice    │   stageIds       │ │
    │ createdAt    │ │ days         │   discount       │ │
    └──────────────┘ │ discount     │   isSubcontract  │ │
                     │ pricingRule  │   visibleInOffer │ │
                     │ visibleIn-   │   sortOrder      │ │
                     │   Offer      │   createdAt      │ │
                     │ sortOrder    │   updatedAt      │ │
                     │ createdAt    │ └────────────────┘ │
                     │ updatedAt    │                    │
                     └──────────────┘                    │
                                                         │
                     ┌───────────────────────────────────┘
                     ▼
           ┌──────────────────────┐
           │ equipment_reserva-   │
           │ tions                │
           │──────────────────────│
           │ id (PK)              │
           │ equipmentId (FK)     │
           │ orderId (FK)         │
           │ orderEquipmentItemId │
           │ date                 │
           │ quantity             │
           └──────────────────────┘
```

---

## Schemat Prisma (pełny)

```prisma
// apps/api/src/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────
// KLIENCI
// ─────────────────────────────────────────

model Client {
  id          String   @id @default(uuid())
  companyName String
  contactName String?
  address     String?
  nip         String?
  email       String?
  phone       String?
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  orders Order[]

  @@map("clients")
}

// ─────────────────────────────────────────
// ZLECENIA
// ─────────────────────────────────────────

model Order {
  id          String      @id @default(uuid())
  name        String
  description String?     // Notatki wewnętrzne
  status      OrderStatus @default(DRAFT)
  venue       String?     // Miejsce realizacji

  dateFrom DateTime
  dateTo   DateTime

  clientId String
  client   Client @relation(fields: [clientId], references: [id])

  // Finansowe
  discountGlobal Float @default(0) // Rabat ogólny %
  vatRate        Float @default(23) // VAT %

  // Zlecenia cykliczne
  isRecurring     Boolean @default(false)
  recurringConfig Json?   // { count: number, frequency: 'weekly'|'monthly', dates: string[] }
  parentOrderId   String?
  parentOrder     Order?  @relation("RecurringOrders", fields: [parentOrderId], references: [id])
  childOrders     Order[] @relation("RecurringOrders")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  stages          OrderStage[]
  equipmentItems  OrderEquipmentItem[]
  productionItems OrderProductionItem[]

  @@map("orders")
}

enum OrderStatus {
  DRAFT       // Szkic
  OFFER_SENT  // Oferta wysłana
  CONFIRMED   // Potwierdzone
  IN_PROGRESS // W realizacji
  COMPLETED   // Zakończone
  CANCELLED   // Anulowane
}

// ─────────────────────────────────────────
// HARMONOGRAM — ETAPY ZLECENIA
// ─────────────────────────────────────────

model OrderStage {
  id        String    @id @default(uuid())
  orderId   String
  order     Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)

  type      StageType
  label     String?   // Własna nazwa dla typu "Custom"
  date      DateTime
  timeStart String?   // Format "HH:MM"
  timeEnd   String?   // Format "HH:MM"
  notes     String?
  sortOrder Int       @default(0)

  createdAt DateTime @default(now())

  @@map("order_stages")
}

enum StageType {
  MONTAZ    // Montaż
  EVENT     // Event
  DEMONTAZ  // Demontaż
  CUSTOM    // Własny typ
}

// ─────────────────────────────────────────
// SPRZĘT (BAZA)
// ─────────────────────────────────────────

model Equipment {
  id            String   @id @default(uuid())
  name          String
  description   String?
  category      String   // "Multimedia" | "Audio" | "Oświetlenie" | "Konstrukcje" | "Inne"
  dailyPrice    Float
  stockQuantity Int      @default(1)
  unit          String   @default("szt.")
  internalCode  String?
  technicalNotes String?
  imageUrl      String?
  visibleInOffer Boolean @default(true)

  // Konfiguracja wyceny wielodniowej (nadpisuje globalną)
  // null = użyj globalnej konfiguracji
  pricingRule Json?
  // Przykład: { "day1": 1.0, "nextDays": 0.5 }
  // day1 = mnożnik dla 1. dnia (domyślnie 1.0 = 100%)
  // nextDays = mnożnik dla kolejnych dni (domyślnie 0.5 = 50%)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  orderItems    OrderEquipmentItem[]
  reservations  EquipmentReservation[]

  @@map("equipment")
}

// ─────────────────────────────────────────
// POZYCJE SPRZĘTU W ZLECENIU
// ─────────────────────────────────────────

model OrderEquipmentItem {
  id          String  @id @default(uuid())
  orderId     String
  order       Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)

  // Może być powiązany z bazą lub ad hoc (equipmentId = null)
  equipmentId String?
  equipment   Equipment? @relation(fields: [equipmentId], references: [id])

  // Dane ofertowe (kopiowane z bazy lub wpisywane ad hoc)
  name        String
  description String?
  category    String  @default("Inne")
  quantity    Int     @default(1)
  unitPrice   Float
  days        Int     @default(1)  // Domyślnie z harmonogramu, edytowalne
  discount    Float   @default(0)  // Rabat % per pozycja

  // Konfiguracja wyceny wielodniowej per pozycja
  // null = użyj konfiguracji z equipment lub globalnej
  pricingRule Json?

  visibleInOffer Boolean @default(true)
  sortOrder      Int     @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  reservations EquipmentReservation[]

  @@map("order_equipment_items")
}

// ─────────────────────────────────────────
// POZYCJE PRODUKCJI I LOGISTYKI
// ─────────────────────────────────────────

model OrderProductionItem {
  id      String @id @default(uuid())
  orderId String
  order   Order  @relation(fields: [orderId], references: [id], onDelete: Cascade)

  name        String
  description String?
  rateType    RateType @default(FLAT) // Typ stawki
  rateValue   Float                  // Wartość stawki
  units       Float    @default(1)   // Liczba jednostek (osób, dni, godzin)
  discount    Float    @default(0)   // Rabat % per pozycja

  // Przypisanie do etapów harmonogramu
  // Tablica ID etapów (OrderStage.id) — JSON array
  // null = ręczne wpisanie units
  stageIds Json?

  isSubcontractor Boolean @default(false) // Flaga podwykonawcy
  visibleInOffer  Boolean @default(true)
  sortOrder       Int     @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("order_production_items")
}

enum RateType {
  DAILY   // Dzienna
  HOURLY  // Godzinowa
  FLAT    // Ryczałt
}

// ─────────────────────────────────────────
// REZERWACJE SPRZĘTU
// ─────────────────────────────────────────
// Tabela pomocnicza do śledzenia dostępności sprzętu per dzień

model EquipmentReservation {
  id                   String @id @default(uuid())
  equipmentId          String
  equipment            Equipment @relation(fields: [equipmentId], references: [id], onDelete: Cascade)
  orderId              String
  orderEquipmentItemId String
  orderEquipmentItem   OrderEquipmentItem @relation(fields: [orderEquipmentItemId], references: [id], onDelete: Cascade)

  date     DateTime // Konkretny dzień rezerwacji
  quantity Int      // Zarezerwowana ilość

  @@unique([equipmentId, orderEquipmentItemId, date])
  @@index([equipmentId, date])
  @@map("equipment_reservations")
}

// ─────────────────────────────────────────
// PRZYSZŁE ROZSZERZENIA (ZAKOMENTOWANE)
// ─────────────────────────────────────────

// model User {
//   id        String   @id @default(uuid())
//   email     String   @unique
//   name      String
//   role      UserRole @default(USER)
//   createdAt DateTime @default(now())
//   @@map("users")
// }

// model StockMovement {
//   id          String   @id @default(uuid())
//   equipmentId String
//   type        String   // "IN" | "OUT" | "ADJUSTMENT"
//   quantity    Int
//   reason      String?
//   createdAt   DateTime @default(now())
//   @@map("stock_movements")
// }

// model Invoice {
//   id        String   @id @default(uuid())
//   orderId   String
//   number    String   @unique
//   issuedAt  DateTime
//   dueAt     DateTime
//   status    String
//   @@map("invoices")
// }
```

---

## Opis encji

### Client (Klient)
| Pole | Typ | Opis |
|---|---|---|
| `id` | UUID | Klucz główny |
| `companyName` | String | Nazwa firmy (wymagane) |
| `contactName` | String? | Imię i nazwisko kontaktu |
| `address` | String? | Adres |
| `nip` | String? | NIP (do faktury) |
| `email` | String? | Email |
| `phone` | String? | Telefon |
| `notes` | String? | Notatki wewnętrzne |

### Order (Zlecenie)
| Pole | Typ | Opis |
|---|---|---|
| `id` | UUID | Klucz główny |
| `name` | String | Nazwa zlecenia |
| `description` | String? | Notatki wewnętrzne |
| `status` | OrderStatus | DRAFT/OFFER_SENT/CONFIRMED/IN_PROGRESS/COMPLETED/CANCELLED |
| `venue` | String? | Miejsce realizacji |
| `dateFrom` | DateTime | Data rozpoczęcia |
| `dateTo` | DateTime | Data zakończenia |
| `clientId` | UUID FK | Powiązany klient |
| `discountGlobal` | Float | Rabat ogólny % (0-100) |
| `vatRate` | Float | Stawka VAT % (domyślnie 23) |
| `isRecurring` | Boolean | Czy zlecenie cykliczne |
| `recurringConfig` | JSON? | Konfiguracja cyklu |
| `parentOrderId` | UUID? | ID zlecenia-rodzica (dla cyklicznych) |

### OrderStage (Etap harmonogramu)
| Pole | Typ | Opis |
|---|---|---|
| `type` | StageType | MONTAZ/EVENT/DEMONTAZ/CUSTOM |
| `label` | String? | Własna nazwa (dla CUSTOM) |
| `date` | DateTime | Data etapu |
| `timeStart` | String? | Godzina startu "HH:MM" |
| `timeEnd` | String? | Godzina końca "HH:MM" |
| `sortOrder` | Int | Kolejność (drag & drop) |

### Equipment (Sprzęt)
| Pole | Typ | Opis |
|---|---|---|
| `name` | String | Nazwa sprzętu |
| `category` | String | Kategoria (Multimedia/Audio/Oświetlenie/...) |
| `dailyPrice` | Float | Cena dzienna w PLN |
| `stockQuantity` | Int | Stan magazynowy |
| `unit` | String | Jednostka (szt., kpl., m) |
| `internalCode` | String? | Kod wewnętrzny |
| `visibleInOffer` | Boolean | Czy widoczny w ofercie PDF |
| `pricingRule` | JSON? | Reguła wyceny wielodniowej |

### OrderEquipmentItem (Pozycja sprzętu w zleceniu)
| Pole | Typ | Opis |
|---|---|---|
| `equipmentId` | UUID? | FK do bazy (null = ad hoc) |
| `name` | String | Nazwa (skopiowana lub wpisana) |
| `quantity` | Int | Ilość |
| `unitPrice` | Float | Cena jednostkowa |
| `days` | Int | Liczba dni (z harmonogramu lub ręcznie) |
| `discount` | Float | Rabat % per pozycja |
| `pricingRule` | JSON? | Nadpisanie reguły wyceny |
| `visibleInOffer` | Boolean | Widoczność w PDF |

### OrderProductionItem (Pozycja produkcji/logistyki)
| Pole | Typ | Opis |
|---|---|---|
| `name` | String | Nazwa pozycji |
| `rateType` | RateType | DAILY/HOURLY/FLAT |
| `rateValue` | Float | Wartość stawki |
| `units` | Float | Liczba jednostek |
| `stageIds` | JSON? | Tablica ID etapów (auto-kalkulacja) |
| `isSubcontractor` | Boolean | Flaga podwykonawcy |
| `discount` | Float | Rabat % per pozycja |

---

## Logika kalkulacji finansowych

### Wycena wielodniowa sprzętu
```
Wartość pozycji = unitPrice × quantity × (1 + (days - 1) × nextDayMultiplier) × (1 - discount/100)

Gdzie:
- nextDayMultiplier = 0.5 (domyślnie, konfigurowalne per pozycja lub globalnie)
- Przykład: 1000 PLN × 1 szt. × 3 dni = 1000 + 500 + 500 = 2000 PLN
```

### Wartość pozycji produkcji
```
Wartość = rateValue × units × (1 - discount/100)

Gdzie units:
- Jeśli stageIds podane: suma dni/godzin wybranych etapów
- Jeśli nie: ręcznie wpisana wartość
```

### Podsumowanie finansowe
```
equipmentTotal    = Σ wartości pozycji sprzętu (visibleInOffer = true lub wszystkie?)
productionTotal   = Σ wartości pozycji produkcji
subcontractorTotal = Σ wartości pozycji z isSubcontractor = true

subtotal          = equipmentTotal + productionTotal
discountAmount    = subtotal × (discountGlobal / 100)
netTotal          = subtotal - discountAmount
vatAmount         = netTotal × (vatRate / 100)
grossTotal        = netTotal + vatAmount

// Tylko wewnętrznie (nie w PDF):
ownMargin         = netTotal - subcontractorTotal
marginPercent     = (ownMargin / netTotal) × 100
```

---

## Konfiguracja globalna (przyszłość)

Tabela `app_settings` (do dodania w kolejnej iteracji):
```prisma
model AppSetting {
  key   String @id
  value Json
  @@map("app_settings")
}
```

Przykładowe klucze:
- `pricing.nextDayMultiplier` = `0.5`
- `pdf.companyName` = `"Lama Stage"`
- `pdf.companyAddress` = `"..."`
- `pdf.companyNip` = `"..."`
- `pdf.logoUrl` = `"..."`

---

## Indeksy i wydajność

```prisma
// Kluczowe indeksy (już w schemacie):
@@index([equipmentId, date])  // equipment_reservations — szybkie sprawdzanie dostępności
@@unique([equipmentId, orderEquipmentItemId, date])  // Brak duplikatów rezerwacji

// Do dodania przy większym ruchu:
// @@index([orderId]) na order_stages, order_equipment_items, order_production_items
// @@index([clientId]) na orders
// @@index([status]) na orders
// @@index([dateFrom, dateTo]) na orders
```
