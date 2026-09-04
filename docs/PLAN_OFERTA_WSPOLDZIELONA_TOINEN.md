# Plan wdrożenia: Oferta współdzielona (edytor zewnętrzny Toinen Music)

Dokument wykonawczy. Każda faza jest zamknięta, kompilowalna i ma kryteria odbioru.
Fazy realizuj **po kolei** — kolejne opierają się na poprzednich.

---

## 0. Kontekst i niezmienniki

### Co budujemy

Publiczny (bez logowania) edytor oferty dla zewnętrznej firmy **Toinen Music**, działający
na tokenie przypisanym do zlecenia w instancji `lama stage`.

- **Moje zlecenie** zawiera wyłącznie moje pozycje. Pozycji Toinen **nie widzę** w edytorze zlecenia.
- **Edytor Toinen** pokazuje moje pozycje jako **read-only, czytane żywo ze zlecenia**
  + ich własne pozycje, które mogą dowolnie dodawać/edytować/usuwać.
- **PDF** jest scalony (moje + ich pozycje, nie do rozróżnienia dla klienta) i zawsze
  generowany w **Toinen Music mode**.
- Wygenerowane przez nich dokumenty widzę w liście exportów zlecenia. To jedyne miejsce,
  gdzie widzę ich pozycje.
- Link działa do **unieważnienia** lub usunięcia zlecenia.

### Niezmienniki — nie łamać pod żadnym pozorem

1. **Zero zmian w `OrderEquipmentItem` / `OrderProductionItem`** (Prisma i Zod).
   Pozycje partnera nigdy nie trafiają do tabel zlecenia.
2. **Zero zmian w `orders.service.ts`** w ścieżkach create/update/duplicate.
   `updateOrder` robi `deleteMany: {}` na pozycjach sprzętu — dlatego pozycje partnera
   muszą leżeć w osobnej tabeli, inaczej każdy zapis zlecenia by je skasował.
3. **Zero zmian w `offer-v5-positions-builder.ts` i `offer-v5-builder.ts`.**
   Scalanie polega wyłącznie na dołożeniu pozycji do tablic `equipmentItems` /
   `productionItems` obiektu `OrderLike` przed wywołaniem `buildOfferHtmlV5`.
4. **Numeracja moich ofert nietknięta.** Nie ruszamy `Order.offerVersion` ani
   `Order.offerNumber`. Nowy typ dokumentu ma własną serię.
5. **Prisma provider zostaje `postgresql`.** Migracje trafiają do repo.
6. Endpoint publiczny **nigdy** nie zwraca pól marż, notatek wewnętrznych, kodów
   magazynowych ani `databaseUrl`. Obowiązuje whitelist, nie blacklist.

### Dlaczego to bezpieczne (potwierdzone w kodzie)

| Pytanie | Odpowiedź | Podstawa |
|---|---|---|
| Ich linie wyrenderują się w PDF? | Tak | `buildOfferPositionsSection` po blokach nazwanych dokłada sekcję pozycji bez bloku (`offer-v5-positions-builder.ts:491-493`) |
| Sumy globalne je uwzględnią? | Tak | `computeGlobalTotals` filtruje `filterEquipmentAll` / `filterProductionAll`, bez względu na blok (`offer-v5-positions-builder.ts:464-466`) |
| Trzeba zmieniać builder PDF? | Nie | `OrderLike.equipmentItems` / `productionItems` to luźne typy strukturalne (`offer-v5-builder.ts:135-157`) |
| Mój zapis zlecenia skasuje ich pozycje? | Nie | Ich dane w osobnej tabeli; `deleteMany` dotyczy tylko relacji zlecenia |
| Ich zapis nadpisze moje pozycje? | Nie | Endpoint partnera zapisuje wyłącznie własny payload |
| Potrzebny zamrożony snapshot moich linii? | Nie | Żywy odczyt ze zlecenia przy każdym `GET` |

---

## FAZA 1 — Model danych i typy współdzielone

### 1.1 Prisma: dwie nowe tabele

Plik: `apps/api/prisma/schema.prisma`

Dodaj **po** modelu `ProposalPublicEvent` (czyli po linii ~410):

```prisma
/// Sesja zewnętrznego edytora oferty (partner Toinen Music).
/// Jeden aktywny link na zlecenie. Pozycje partnera żyją TYLKO tutaj —
/// nigdy w order_equipment_items / order_production_items.
model OrderSharedOfferSession {
  id      String @id @default(uuid())
  orderId String @unique
  order   Order  @relation(fields: [orderId], references: [id], onDelete: Cascade)

  publicToken String @unique

  /// JSON: SharedOfferPartnerPayload (lista pozycji partnera)
  partnerPayloadJson String

  revokedAt   DateTime?
  lastSavedAt DateTime?
  createdById String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  events SharedOfferSessionEvent[]

  @@index([publicToken])
  @@map("order_shared_offer_sessions")
}

model SharedOfferSessionEvent {
  id        String                  @id @default(uuid())
  sessionId String
  session   OrderSharedOfferSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  /// OPEN | SAVE | PDF
  eventType String
  createdAt DateTime                @default(now())

  @@index([sessionId, eventType, createdAt])
  @@map("shared_offer_session_events")
}
```

W modelu `Order` dodaj relację (obok `documentDrafts`):

```prisma
  sharedOfferSession OrderSharedOfferSession?
```

### 1.2 Migracja SQL

Utwórz `apps/api/prisma/migrations/20260904190000_shared_offer_session/migration.sql`.
Wzoruj się na stylu `20260819220000_proposal_public_token/migration.sql`.

```sql
-- Sesja zewnętrznego edytora oferty (partner Toinen Music).
CREATE TABLE "order_shared_offer_sessions" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "partnerPayloadJson" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSavedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_shared_offer_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_shared_offer_sessions_orderId_key" ON "order_shared_offer_sessions"("orderId");
CREATE UNIQUE INDEX "order_shared_offer_sessions_publicToken_key" ON "order_shared_offer_sessions"("publicToken");
CREATE INDEX "order_shared_offer_sessions_publicToken_idx" ON "order_shared_offer_sessions"("publicToken");

ALTER TABLE "order_shared_offer_sessions" ADD CONSTRAINT "order_shared_offer_sessions_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "shared_offer_session_events" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_offer_session_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "shared_offer_session_events_sessionId_eventType_createdAt_idx"
  ON "shared_offer_session_events"("sessionId", "eventType", "createdAt");

ALTER TABLE "shared_offer_session_events" ADD CONSTRAINT "shared_offer_session_events_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "order_shared_offer_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### 1.3 Nowy typ dokumentu

Plik: `packages/shared-types/src/schemas/order-document.schema.ts` (linia 11)

```ts
export const DOCUMENT_TYPES = ['OFFER', 'PROPOSAL', 'WAREHOUSE', 'BRIEF', 'STAGE_PLAN', 'SHARED_OFFER'] as const;
```

Plik: `packages/shared-types/src/utils/orderReferenceFormat.ts` (linia 10)

```ts
const DOCUMENT_TYPE_PREFIX: Record<DocumentType, string> = {
  OFFER: 'OFR',
  PROPOSAL: 'PRP',
  WAREHOUSE: 'WHS',
  BRIEF: 'BRF',
  STAGE_PLAN: 'SCN',
  SHARED_OFFER: 'TOI',
};
```

Numer dokumentu partnera: `TOI-26-0042-v1`.

> **Uwaga.** `buildDefaultDraft` w `order-document-draft-utils.ts` ma generyczny fallback,
> więc nowy typ go nie wywróci. Natomiast w `order-documents.controller.ts` publiczny
> endpoint `POST /api/orders/:id/documents/exports` musi **odrzucać** `SHARED_OFFER`
> (te exporty tworzy wyłącznie ścieżka partnera) — patrz faza 3.5.

### 1.4 Schematy pozycji partnera

Nowy plik: `packages/shared-types/src/schemas/shared-offer.schema.ts`

```ts
import { z } from 'zod';

export const SHARED_OFFER_LINE_KINDS = ['EQUIPMENT', 'PRODUCTION'] as const;
export const SharedOfferLineKindSchema = z.enum(SHARED_OFFER_LINE_KINDS);

/** Twarde limity — endpoint jest publiczny, bez logowania. */
export const MAX_SHARED_OFFER_LINES = 60;

/**
 * Pozycja dodana przez partnera. Jeden ujednolicony kształt dla obu rodzajów;
 * mapowanie na pozycje sprzętowe/produkcyjne odbywa się przy generowaniu PDF.
 */
export const SharedOfferPartnerLineSchema = z.object({
  id: z.string().min(1).max(64),
  kind: SharedOfferLineKindSchema.default('PRODUCTION'),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).default(''),
  category: z.string().trim().max(80).default('Inne'),
  quantity: z.number().finite().min(0).max(10_000).default(1),
  unitPrice: z.number().finite().min(0).max(10_000_000).default(0),
  days: z.number().int().min(1).max(365).default(1),
  discount: z.number().finite().min(0).max(100).default(0),
  offerBlockId: z.string().uuid().nullable().default(null),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export const SharedOfferPartnerPayloadSchema = z.object({
  lines: z.array(SharedOfferPartnerLineSchema).max(MAX_SHARED_OFFER_LINES).default([]),
});

/** Moja pozycja pokazywana partnerowi — WYŁĄCZNIE te pola. */
export const SharedOfferLockedLineSchema = z.object({
  kind: SharedOfferLineKindSchema,
  name: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  quantity: z.number(),
  unitPrice: z.number(),
  days: z.number(),
  discount: z.number(),
  offerBlockId: z.string().nullable(),
  unit: z.string().nullable(),
});

export const SharedOfferBlockSchema = z.object({
  id: z.string(),
  title: z.string(),
  sortOrder: z.number(),
});

export const SharedOfferTotalsSchema = z.object({
  ownNet: z.number(),
  partnerNet: z.number(),
  totalNet: z.number(),
  vatRate: z.number(),
  vatAmount: z.number(),
  grossTotal: z.number(),
  discountGlobal: z.number(),
  currency: z.string(),
});

export const SharedOfferPublicViewSchema = z.object({
  status: z.enum(['ACTIVE', 'REVOKED']),
  orderName: z.string(),
  venue: z.string().nullable(),
  startDate: z.string(),
  endDate: z.string(),
  clientCompanyName: z.string().nullable(),
  blocks: z.array(SharedOfferBlockSchema),
  lockedLines: z.array(SharedOfferLockedLineSchema),
  partnerLines: z.array(SharedOfferPartnerLineSchema),
  totals: SharedOfferTotalsSchema,
  lastSavedAt: z.string().nullable(),
  /** Odcisk moich pozycji — do detekcji zmian po stronie operatora. */
  lockedFingerprint: z.string(),
});

export type SharedOfferLineKind = z.infer<typeof SharedOfferLineKindSchema>;
export type SharedOfferPartnerLine = z.infer<typeof SharedOfferPartnerLineSchema>;
export type SharedOfferPartnerPayload = z.infer<typeof SharedOfferPartnerPayloadSchema>;
export type SharedOfferLockedLine = z.infer<typeof SharedOfferLockedLineSchema>;
export type SharedOfferPublicView = z.infer<typeof SharedOfferPublicViewSchema>;
export type SharedOfferTotals = z.infer<typeof SharedOfferTotalsSchema>;
```

Re-eksport w `packages/shared-types/src/index.ts` (obok pozostałych schematów).

### 1.5 Kryteria odbioru fazy 1

- [ ] `npx prisma generate -w apps/api` przechodzi
- [ ] `npm run db:migrate -w apps/api` tworzy obie tabele
- [ ] `npm run build` przechodzi w całości (shared-types → api → web)
- [ ] `buildDocumentNumber({ documentType: 'SHARED_OFFER', orderNumber: 42, orderYear: 2026, version: 1 })` zwraca `TOI-26-0042-v1`
- [ ] Żaden istniejący plik nie zmienił zachowania — `git diff` pokazuje wyłącznie dodane linie w `schema.prisma`, dwóch plikach shared-types i `index.ts`

---

## FAZA 2 — Wspólne helpery (refaktor bez zmiany zachowania)

Cel: wyciągnąć z proposali to, co będzie użyte dwa razy. **Bez zmian funkcjonalnych.**

### 2.1 Rate limit do osobnego pliku

Nowy plik: `apps/api/src/shared/middleware/public-rate-limit.ts`

Przenieś tam logikę z `public-proposal.controller.ts:18-38` w postaci konfigurowalnej:

```ts
import type { Request } from 'express'
import { AppError } from '../errors/AppError'

type Bucket = { n: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0]!.trim()
  return req.ip || 'unknown'
}

/** Prosty licznik w pamięci procesu. Nie jest rozproszony — świadoma decyzja. */
export function assertRateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now()
  const cur = buckets.get(key)
  if (!cur || cur.resetAt < now) {
    buckets.set(key, { n: 1, resetAt: now + windowMs })
    return
  }
  if (cur.n >= limit) {
    throw new AppError('Zbyt wiele żądań. Spróbuj za chwilę.', 429, 'RATE_LIMIT')
  }
  cur.n += 1
}
```

Podmień użycie w `public-proposal.controller.ts`: zamiast lokalnego `assertRateLimit(req)`
wywołaj `assertRateLimit(\`prop:${clientIp(req)}\`, 60, 60_000)`. Usuń lokalną mapę i funkcje.
**Zachowanie musi zostać identyczne: 60 żądań na minutę na IP.**

### 2.2 Generyczny lookup tokenu po firmach

Nowy plik: `apps/api/src/modules/orders/public-token-lookup.ts`

```ts
import { randomBytes } from 'node:crypto'
import { getCompanyRegistry } from '../companies/company-registry'
import { runWithCompanyContext } from '../../shared/context/company-context'

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/

export function isValidPublicToken(token: string): boolean {
  return TOKEN_RE.test(token)
}

export function newPublicToken(): string {
  return randomBytes(24).toString('base64url')
}

/**
 * Repo jest multi-company (osobna baza na firmę), a link publiczny nie ma kontekstu
 * sesji — dlatego token trzeba szukać po kolei we wszystkich bazach z rejestru.
 */
export async function findAcrossCompanies<T>(
  finder: () => Promise<T | null>
): Promise<{ companyCode: string; value: T } | null> {
  for (const company of getCompanyRegistry()) {
    const found = await runWithCompanyContext(company.code, finder)
    if (found) return { companyCode: company.code, value: found }
  }
  return null
}
```

W `proposal-publish.ts` zastąp lokalne `TOKEN_RE` / `newPublicToken()` importami z nowego
pliku, a `findProposalExportByPublicToken` przepisz na `findAcrossCompanies`.
Wyeksportuj dalej `isValidProposalPublicToken` jako alias, żeby nie ruszać importów
w `public-proposal.controller.ts`.

### 2.3 Kryteria odbioru fazy 2

- [ ] `npm run build` przechodzi
- [ ] Publiczny link proposal (`/p/:token`) nadal działa: wczytanie, sygnały, PDF
- [ ] Limit 60/min na proposalach nadal działa (61. żądanie w minucie → 429 `RATE_LIMIT`)
- [ ] Brak zmian w kontraktach API

---

## FAZA 3 — Backend sesji i publiczne API

### 3.1 Serwis sesji

Nowy plik: `apps/api/src/modules/orders/shared-offer.service.ts`

Funkcje do zaimplementowania:

| Funkcja | Opis |
|---|---|
| `getOrCreateSession(orderId, userId)` | Zwraca istniejącą sesję lub tworzy nową z nowym tokenem. Jeśli sesja jest `revokedAt`, **generuje nowy token** i czyści `revokedAt`. Kolizja tokenu → retry do 5 razy. |
| `revokeSession(orderId)` | Ustawia `revokedAt = now()`. Nie usuwa payloadu (historia). |
| `getSessionStatus(orderId)` | Sesja + ostatnie ~50 zdarzeń + liczba i suma pozycji partnera. Dla widoku operatora. |
| `findSessionByToken(token)` | `findAcrossCompanies` po `publicToken`. |
| `loadOrderForSharedOffer(orderId)` | `prisma.order.findUnique` z `client`, `offerBlocks`, `equipmentItems` (z `equipment`), `productionItems` (`where: { visibleInOffer: true }`). Identycznie jak `loadOrderForPdf` w `pdf.controller.ts:31-48`. |
| `buildPublicView(order, session)` | Buduje `SharedOfferPublicView` — **whitelistą**. |
| `savePartnerLines(sessionId, payload)` | Waliduje `SharedOfferPartnerPayloadSchema`, zapisuje, ustawia `lastSavedAt`, loguje `SAVE`. |
| `logEvent(sessionId, eventType)` | Wpis do `SharedOfferSessionEvent`. |
| `computeLockedFingerprint(lockedLines)` | `sha256` ze stabilnego JSON-a pozycji. |

**Krytyczne — mapowanie moich pozycji na `SharedOfferLockedLine` (whitelist):**

```ts
// Sprzęt
{
  kind: 'EQUIPMENT',
  name: item.name,
  description: item.description ?? null,
  category: item.category ?? null,
  quantity: item.quantity,
  unitPrice: item.unitPrice,
  days: item.days ?? 1,
  discount: item.discount ?? 0,
  offerBlockId: item.offerBlockId ?? null,
  unit: item.equipment?.unit ?? null,
}
// Produkcja
{
  kind: 'PRODUCTION',
  name: item.name,
  description: item.description ?? null,
  category: null,
  quantity: item.units,
  unitPrice: item.rateValue,
  days: 1,
  discount: item.discount ?? 0,
  offerBlockId: item.offerBlockId ?? null,
  unit: null,
}
```

Filtry przy budowie `lockedLines`:
- sprzęt: `visibleInOffer !== false`
- produkcja: `visibleInOffer !== false` (transport `isTransport === true` **pomijamy** —
  transport jest globalny i zostaje moją częścią; nie pokazujemy go partnerowi jako pozycji edytowalnej kontekstowo,
  ale **wchodzi do sumy `ownNet`**)

**Zakazane do wyniesienia na zewnątrz** (nie kopiuj ich nigdy):
`marginRentalUnits`, `marginRentalUnitCostNet`, `marginSubcontractorUnits`,
`marginSubcontractorUnitCostNet`, `externalConfirmationStatus`, `externalConfirmationDeadline`,
`externalConfirmedAt`, `isRental`, `isSubcontractor`, `equipmentId`, `pricingRule`,
`Order.notes`, `equipment.internalCode`, `equipment.technicalNotes`, `Client.notes`,
`Client.nip`, `Client.email`, `Client.phone`, `Client.address`.

Z klienta wychodzi **tylko** `companyName`.

**Obsługa osieroconego `offerBlockId`:** przy `GET` zeruj `offerBlockId` w pozycjach
partnera, jeśli nie ma go w `order.offerBlocks`. Zapisz wyczyszczoną wersję.

**Sumy:** licz tak samo jak PDF —
`net = quantity * unitPrice * days * (1 - discount/100)` dla sprzętu,
`net = units * rateValue * (1 - discount/100)` dla produkcji.
`ownNet` = moje pozycje (razem z transportem), `partnerNet` = ich pozycje.
Rabat globalny i VAT ze zlecenia, bez prawa zmiany przez partnera.

### 3.2 Kontroler publiczny

Nowy plik: `apps/api/src/modules/orders/shared-offer-public.controller.ts`

Wzoruj strukturę na `public-proposal.controller.ts` (try/catch → `next(error)`,
`AppError`, `runWithCompanyContext`, nagłówek `X-Company-Code`).

| Handler | Metoda i ścieżka | Limit | Zachowanie |
|---|---|---|---|
| `getSharedOffer` | `GET /:token` | 60/min/IP | 404 gdy brak sesji, `revokedAt != null`, lub `order.isDeleted`. Loguje `OPEN`. Zwraca `SharedOfferPublicView`. |
| `putSharedOfferLines` | `PUT /:token` | 30/min/IP | Body: `{ lines, lockedFingerprint? }`. Gdy `lockedFingerprint` podany i różny od aktualnego → **409** `LOCKED_CHANGED` + świeży widok. Loguje `SAVE`. |
| `postSharedOfferPdf` | `POST /:token/pdf` | **5/min i 30/h na token** | Generuje scalony PDF, tworzy export, loguje `PDF`, streamuje plik. |

Klucze limitów: `so:${clientIp(req)}` dla GET/PUT, oraz `so-pdf:${token}` z dwoma
oknami (`5, 60_000` i `30, 3_600_000`) dla generowania.

Walidacja tokenu: `isValidPublicToken`; nieprawidłowy → 404 `NOT_FOUND`
(nigdy 400 — nie zdradzamy istnienia zasobu).

### 3.3 Router publiczny

Nowy plik: `apps/api/src/modules/orders/shared-offer-public.router.ts`

```ts
import { Router } from 'express'
import {
  getSharedOffer,
  putSharedOfferLines,
  postSharedOfferPdf,
} from './shared-offer-public.controller'

const router = Router()

router.get('/:token', getSharedOffer)
router.put('/:token', putSharedOfferLines)
router.post('/:token/pdf', postSharedOfferPdf)

export default router
```

### 3.4 Montowanie w `app.ts`

Plik: `apps/api/src/app.ts`

Import obok linii 18:

```ts
import sharedOfferPublicRouter from './modules/orders/shared-offer-public.router'
```

Rejestracja **przed** `app.use('/api', requireAuth, ...)` (czyli między linią 69 i 70):

```ts
  app.use('/api/public/shared-offer', sharedOfferPublicRouter)
```

> To jedyne miejsce, gdzie router omija `requireAuth`. Nie dodawaj go pod `/api`
> po tej linii, bo straci publiczność.

### 3.5 Endpointy operatora (zalogowanego)

Plik: `apps/api/src/modules/orders/orders.router.ts`

Ten router używa **importów nazwanych**, nie `controller.*`. Dodaj import obok bloku
z linii 18-25 i trasy po linii 42 (`PUT /:id/documents/draft`):

```ts
import {
  getSharedOfferStatus,
  createSharedOfferLink,
  revokeSharedOfferLink,
} from './shared-offer.controller';

// ...

router.get('/:id/shared-offer', getSharedOfferStatus);
router.post('/:id/shared-offer/link', createSharedOfferLink);
router.delete('/:id/shared-offer/link', revokeSharedOfferLink);
```

Handlery w nowym pliku `apps/api/src/modules/orders/shared-offer.controller.ts`
(operatorski, nie mieszać z publicznym).

Wymagania:
- Wszystkie trzy dostają `requireModuleAccess('orders')` z rejestracji `app.ts:73` — nic nie trzeba dodawać.
- `createSharedOfferLink` i `revokeSharedOfferLink` sprawdzają, czy
  `appSettings.enableToinenMusicMode === true`; jeśli nie → `AppError(..., 400)`
  z komunikatem „Tryb Toinen Music jest wyłączony w ustawieniach aplikacji.”
- `createSharedOfferLink` zwraca `{ token, url: null }` — pełny URL składa frontend
  z `window.location.origin` (tak jak `OrderProposalPage.tsx:278`).
- `createSharedOfferLink` woła `writeAuditLog` (`module: 'orders'`, `action: 'shared_offer.link_create'`),
  analogicznie `revokeSharedOfferLink` z `shared_offer.link_revoke`.
  Actor bierz z `res.locals.user` — `writeAuditLog` wymaga `actorUserId` z FK do `User`,
  więc **nie** wołaj go z ścieżek publicznych.

**Zabezpieczenie generycznego endpointu exportów.** W `order-documents.controller.ts`,
w handlerze `POST /:id/documents/exports`, odrzuć `documentType === 'SHARED_OFFER'`:

```ts
if (documentType === 'SHARED_OFFER') {
  throw new AppError('Dokument oferty współdzielonej tworzy wyłącznie edytor partnera.', 400)
}
```

Sprawdź też, czy `deleteOrderDocumentExport` i `syncOrderOfferFromRemainingExports`
nie reagują na nowy typ — `sync` filtruje po `documentType: 'OFFER'`, więc jest bezpieczny.
Usunięcie exportu `SHARED_OFFER` nie może ruszać `Order.offerVersion`.

### 3.6 Kryteria odbioru fazy 3

- [ ] `npm run build` przechodzi
- [ ] `POST /api/orders/:id/shared-offer/link` przy wyłączonym Toinen mode → 400
- [ ] Po włączeniu flagi zwraca token; drugie wywołanie zwraca **ten sam** token
- [ ] `GET /api/public/shared-offer/:token` **bez ciasteczka sesji** zwraca dane
- [ ] Odpowiedź nie zawiera żadnego z zakazanych pól (sprawdź `grep` po `margin`, `internalCode`, `notes` w JSON-ie)
- [ ] `PUT` zapisuje pozycje; ponowny `GET` je zwraca
- [ ] Po `DELETE .../link` publiczny `GET` zwraca 404
- [ ] Zapis zlecenia przez `PUT /api/orders/:id` **nie** kasuje pozycji partnera
- [ ] Zmiana ceny mojej pozycji jest widoczna w kolejnym publicznym `GET`

---

## FAZA 4 — Scalony PDF w trybie Toinen

### 4.1 Nowa metoda w `PdfController`

Plik: `apps/api/src/modules/pdf/pdf.controller.ts`

Dodaj metodę `generateSharedOfferPdf(orderId, partnerLines, res)`.
Wzoruj się na `generateOffer` (linie 390-552), z następującymi różnicami:

1. **Wymuś tryb Toinen** przed `applyToinenMusicModeIfEnabled`:
   ```ts
   draftPayload = { ...draftPayload, toinenMusicMode: true }
   ```
   Dalej wołaj `this.applyToinenMusicModeIfEnabled(appSettings, draftPayload, branding, projectContact)`
   bez zmian — jeśli flaga globalna jest wyłączona, metoda sama wyzeruje tryb, a my
   w takim wypadku **przerywamy** z błędem 400 (nie generujemy oferty Toinen bez zgody).

2. **Numeracja własnej serii.** Nie ruszaj `Order.offerVersion` ani `Order.offerNumber`:
   ```ts
   const existing = await prisma.orderDocumentExport.count({
     where: { orderId, documentType: 'SHARED_OFFER' },
   })
   const documentNumber = buildDocumentNumber({
     documentType: 'SHARED_OFFER',
     orderNumber,
     orderYear,
     version: existing + 1,
   })
   ```

3. **Scalenie pozycji.** Zbuduj `OrderLike` przez `orderOfferSnapshotToPdfOrderLike(snapshot)`,
   a następnie dołóż pozycje partnera:
   ```ts
   const pdfOrder = orderOfferSnapshotToPdfOrderLike(snapshot)
   const merged: OrderLike = {
     ...pdfOrder,
     equipmentItems: [
       ...(pdfOrder.equipmentItems ?? []),
       ...partnerLines.filter((l) => l.kind === 'EQUIPMENT').map(toPdfEquipmentLine),
     ],
     productionItems: [
       ...(pdfOrder.productionItems ?? []),
       ...partnerLines.filter((l) => l.kind === 'PRODUCTION').map(toPdfProductionLine),
     ],
   }
   ```
   Mapery (funkcje modułowe, nie metody):
   ```ts
   function toPdfEquipmentLine(l: SharedOfferPartnerLine) {
     return {
       name: l.name,
       description: l.description || null,
       category: l.category || 'Inne',
       quantity: l.quantity,
       unitPrice: l.unitPrice,
       days: l.days,
       discount: l.discount,
       visibleInOffer: true,
       offerBlockId: l.offerBlockId,
       equipment: null,
     }
   }
   function toPdfProductionLine(l: SharedOfferPartnerLine) {
     return {
       name: l.name,
       description: l.description || null,
       rateValue: l.unitPrice,
       units: l.quantity,
       discount: l.discount,
       stageIds: null,
       isTransport: false,
       visibleInOffer: true,
       offerBlockId: l.offerBlockId,
     }
   }
   ```

4. **Snapshot zawiera scalone pozycje.** Zapisz do `OrderDocumentExport.snapshot`
   snapshot zbudowany z **merged** pozycji, żeby ponowne pobranie dawało identyczny PDF.
   Zapamiętaj w snapshocie `documentDraft.toinenMusicMode = true`.

5. `buildOfferHtmlV5(merged, documentNumber, { ..., issuerDetailsVariant: 'ADDRESS_NIP' })`,
   potem `this.renderPdf(html)`.

6. Nazwa pliku: `Oferta-${documentNumber}.pdf`.

**Nie modyfikuj** `offer-v5-positions-builder.ts` ani `offer-v5-builder.ts`.

### 4.2 Naprawa istniejącej luki: branding Toinen przy ponownym pobraniu

Plik: `apps/api/src/modules/pdf/pdf.controller.ts`, metoda `buildOfferPdfFromExportId`
(linie 554-602).

Obecnie bierze aktualne `appSettings` dla logo i koloru, więc PDF odtworzony ze starego
exportu Toinen wygląda jak oferta Lamy. Popraw:

1. Zdejmij twarde ograniczenie typu:
   ```ts
   if (exportRecord.documentType !== 'OFFER' && exportRecord.documentType !== 'SHARED_OFFER') {
     throw new AppError('Obsługiwany jest tylko eksport oferty', 400)
   }
   ```
2. Po odczytaniu snapshotu sprawdź `documentDraft.toinenMusicMode === true`. Jeśli tak,
   przepuść `branding` i `projectContact` przez `applyToinenMusicModeIfEnabled` i użyj
   `issuerDetailsVariant: 'ADDRESS_NIP'`.
3. `SHARED_OFFER` zawsze traktuj jako tryb Toinen.

### 4.3 Podłączenie do endpointu publicznego

W `shared-offer-public.controller.ts`, handler `postSharedOfferPdf`:

1. Znajdź sesję i zlecenie, sprawdź `revokedAt` i `order.isDeleted`
2. Sprawdź `lockedFingerprint` z body; różny → 409 `LOCKED_CHANGED` ze świeżym widokiem
3. `await pdfController.generateSharedOfferPdf(orderId, partnerLines, res)`
4. `logEvent(sessionId, 'PDF')`

Instancja: `const pdfController = new PdfController()` na poziomie modułu
(tak jak `public-proposal.controller.ts:167`).

### 4.4 Kryteria odbioru fazy 4

- [ ] `npm run build` przechodzi
- [ ] `POST /api/public/shared-offer/:token/pdf` zwraca PDF
- [ ] PDF ma stopkę i wystawcę **Toinen Music**, akcent `#81B29F` i logo Toinen
- [ ] Pozycje moje i partnera są w jednej tabeli, **nieodróżnialne** dla klienta
- [ ] Sumy w podsumowaniu finansowym obejmują obie grupy
- [ ] `Order.offerVersion` i `Order.offerNumber` **niezmienione** po generowaniu
- [ ] Nowy export widoczny przez `GET /api/orders/:id/documents/exports?documentType=SHARED_OFFER`
- [ ] Ponowne pobranie tego exportu daje PDF w brandingu Toinen (regresja z 4.2)
- [ ] Szósty PDF w ciągu minuty na ten sam token → 429
- [ ] Przy wyłączonym Toinen mode generowanie → 400, bez tworzenia exportu

---

## FAZA 5 — Publiczny edytor w przeglądarce

### 5.1 Klient API

Nowy plik: `apps/web/src/modules/orders/api/sharedOffer.api.ts`

Publiczne wywołania idą **bez** `withCredentials`, na `/api/public/shared-offer/:token`.
Operatorskie przez `apps/web/src/shared/api/client.ts`.

```ts
export const sharedOfferPublicApi = {
  get: (token: string) => /* GET */,
  save: (token: string, lines, lockedFingerprint) => /* PUT */,
  generatePdf: (token: string, lockedFingerprint) => /* POST, responseType: 'blob' */,
}

export const sharedOfferAdminApi = {
  status: (orderId: string) => /* GET /orders/:id/shared-offer */,
  createLink: (orderId: string) => /* POST */,
  revokeLink: (orderId: string) => /* DELETE */,
}
```

### 5.2 Strona edytora

Nowy plik: `apps/web/src/modules/orders/pages/SharedOfferEditorPage.tsx`

Wzoruj układ i styl na `PublicProposalPage.tsx` + `proposalPublic.css`.

Sekcje z góry na dół:

1. **Nagłówek** — nazwa zlecenia, miejsce, daty, nazwa klienta. Logo Toinen.
2. **Pozycje Lama Stage (zablokowane)** — tabela read-only z ikoną kłódki.
   Kolumny: nazwa, opis, ilość, cena jedn., dni, rabat, netto.
   Żadnego pola edytowalnego, żadnego przycisku usuwania.
3. **Pozycje Toinen Music** — w pełni edytowalna tabela.
   Dodawanie, usuwanie, zmiana kolejności. Pola zgodne z `SharedOfferPartnerLineSchema`.
   Jeśli `blocks.length > 0`, każda pozycja ma **select bloku** z tytułami moich bloków
   (plus opcja „bez bloku”) — inaczej ich pozycje wylądują w osobnej sekcji na końcu PDF
   i klient rozpozna innego autora.
   `kind`: przełącznik „Sprzęt / Usługa”, domyślnie „Usługa”.
4. **Podsumowanie** (stopka, wymóg biznesowy) — trzy wiersze:
   `Lama Stage: X netto`, `Toinen Music: Y netto`, `Razem: Z netto` + VAT i brutto.
5. **Akcje** — `Zapisz` (zawsze aktywny przy zmianach) i `Generuj ofertę PDF`
   (jedyna akcja końcowa).

Zachowania obowiązkowe:

- **Baner nieaktualnych danych.** Gdy `PUT` lub `POST /pdf` zwróci 409 `LOCKED_CHANGED`,
  pokaż komunikat „Pozycje Lama Stage zmieniły się od otwarcia edytora” z przyciskiem
  odświeżenia, i wstaw świeże dane z odpowiedzi. Pozycji partnera **nie kasuj**.
- **Ostrzeżenie przed wyjściem** przy niezapisanych zmianach (`beforeunload`).
- **Stan `REVOKED` / 404** → czytelny ekran „Link nie jest już aktywny”.
- Kwoty formatuj tak jak reszta aplikacji (waluta ze `totals.currency`).

### 5.3 Trasa

Plik: `apps/web/src/lib/router.tsx`

Import obok linii 10 i trasa obok linii 44 — **poza** `ProtectedLayout`:

```tsx
  { path: '/so/:token', element: <SharedOfferEditorPage /> },
```

### 5.4 Kryteria odbioru fazy 5

- [ ] `npm run build` i `npm run lint` przechodzą
- [ ] `/so/:token` otwiera się w **oknie incognito**, bez logowania
- [ ] Moich pozycji nie da się zmienić żadnym polem ani skrótem
- [ ] Dodanie pozycji + `Zapisz` + odświeżenie strony → pozycja jest
- [ ] Stopka pokazuje poprawny podział nasze / Toinen / razem
- [ ] `Generuj ofertę PDF` pobiera plik w brandingu Toinen
- [ ] Zmiana mojej ceny w innej karcie → 409 i baner przy zapisie
- [ ] Po unieważnieniu linku strona pokazuje ekran „nieaktywny”

---

## FAZA 6 — Panel operatora

### 6.1 Sekcja w widoku oferty

Plik: `apps/web/src/modules/orders/pages/OrderOfferPage.tsx`

Dodaj sekcję **„Oferta współdzielona (Toinen Music)”** obok tabeli
„Snapshoty oferty (historia)” (~linia 1097).

Widoczność: tylko gdy `appSettings.enableToinenMusicMode === true` — ten sam warunek,
którego już używa checkbox trybu Toinen w tym pliku (linie 156-159, 1083-1091).

Zawartość:

- Gdy brak linku: przycisk **„Utwórz link dla partnera”**
- Gdy link istnieje: pole z URL-em `${window.location.origin}/so/${token}`,
  przycisk **Kopiuj**, przycisk **Unieważnij link** (z potwierdzeniem)
- **Historia aktywności** — lista zdarzeń (otwarcia, zapisy, generowania) z datami
- Licznik: ile pozycji dodał partner i ich suma netto
- Zdanie wyjaśniające: „Pozycje partnera nie wchodzą do Twojego zlecenia. Widzisz je
  w wygenerowanych dokumentach typu `TOI-…`.”

### 6.2 Lista exportów

W tym samym pliku: tabela exportów musi pokazywać dokumenty `SHARED_OFFER`
z widocznym oznaczeniem źródła (np. plakietka „Toinen”), obok moich `OFFER`.
Pobieranie PDF przez istniejącą ścieżkę `POST /api/pdf/offer/export/:exportId`
(działa po poprawce z 4.2).

Usuwanie takiego exportu musi być możliwe i **nie może** ruszać numeracji moich ofert.

### 6.3 Kryteria odbioru fazy 6

- [ ] `npm run build` i `npm run lint` przechodzą
- [ ] Przy wyłączonym Toinen mode sekcja jest niewidoczna
- [ ] Utworzenie, skopiowanie i unieważnienie linku działa z UI
- [ ] Historia zdarzeń pokazuje otwarcia i generowania z publicznego edytora
- [ ] Dokumenty `TOI-…` widoczne na liście i pobieralne
- [ ] Edytor zlecenia (`/orders/:id`) **nadal nie pokazuje** pozycji partnera
- [ ] Wartość netto zlecenia na liście zleceń **nie zawiera** pozycji partnera
- [ ] Dokument magazynowy **nie zawiera** pozycji partnera
- [ ] Dostępność sprzętu **nie uwzględnia** pozycji partnera

---

## FAZA 7 — Dokumentacja i wdrożenie

### 7.1 Dokumentacja

- `docs/AUTH_ACCOUNTS_AND_PERMISSIONS.md` — dopisz do listy publicznych endpointów
  `/api/public/shared-offer/*` (dokument jest nieaktualny, brakuje w nim też
  `/api/public/proposals/*` — dodaj oba)
- `status.md` — krótka notka o nowej funkcji i typie dokumentu `SHARED_OFFER`

### 7.2 Wdrożenie (wymagane przez `lama-delivery-workflow`)

```
npm run build
git add -A && git commit -m "feat(orders): oferta wspoldzielona - zewnetrzny edytor Toinen Music"
git push origin main
git rev-parse --short HEAD
```

Następnie:

1. Migracja na produkcji leci automatycznie — `deploy.sh` uruchamia
   `prisma migrate deploy` dla **każdej** bazy z `COMPANY_DATABASES_JSON`.
   Potwierdź w logach, że obie firmy dostały nowe tabele.
2. Zweryfikuj `GET /api/auth/public-companies` — nadal wszystkie firmy.
3. Zaloguj się do każdej firmy, sprawdź `Firma: <companyCode>` i wersję `main-<short_sha>`.
4. Włącz Toinen Music mode w adminie firmy `main`, utwórz link testowy,
   otwórz go w incognito, dodaj pozycję, wygeneruj PDF.
5. Sprawdź `/health` i logi PM2.

W razie blokady deploya: raportuj co poszło nie tak, co już jest wypchnięte i jaki jest
następny krok. Szczegóły w `docs/production-repair-runbook.md` i `docs/deploy-quick.md`.

### 7.3 Kryteria odbioru fazy 7

- [ ] Kod na `main`, znany short SHA
- [ ] Deploy zakończony, obie firmy działają
- [ ] Frontend pokazuje `main-<short_sha>`
- [ ] Pełny przebieg funkcji zweryfikowany na produkcji

---

## Przypadki brzegowe — wymagane zachowania

| Sytuacja | Wymagane zachowanie |
|---|---|
| Usuwam pozycję, na której partner oparł wycenę | U partnera znika przy kolejnym `GET`. Log zdarzeń pozwala odtworzyć kiedy. |
| Usuwam blok oferty, do którego partner przypisał linię | Nieznany `offerBlockId` zerowany przy odczycie; linia wraca do sekcji ogólnej. Bez błędu. |
| Zmieniam ceny, gdy partner ma otwarty edytor | Zapis i generowanie zwracają 409 `LOCKED_CHANGED`; UI pokazuje baner i wstawia świeże dane. Pozycje partnera zachowane. |
| Partner generuje PDF po mojej zmianie cen | Nowy dokument ma nowe ceny. Wcześniejsze exporty pozostają zamrożone. |
| Kasuję zlecenie (soft delete) | Publiczny `GET` sprawdza `order.isDeleted` → 404. |
| Dwie osoby z Toinen zapisują równolegle | Wygrywa ostatni zapis; `lockedFingerprint` chroni tylko przed rozjechaniem się z moimi pozycjami. Świadome uproszczenie. |
| Zlecenie bez `orderNumber` / `orderYear` | Generowanie PDF → 400 z komunikatem o brakującej numeracji (jak w `generateOffer`). |
| Partner wysyła 500 pozycji | Zod odrzuca powyżej `MAX_SHARED_OFFER_LINES` → 400. |
| Partner wysyła 10 MB payloadu | `express.json({ limit: '1mb' })` w `app.ts:59` odrzuca. Nie zmieniaj tego limitu. |
| Ktoś zgaduje tokeny | 24 bajty entropii + limit 60/min/IP na `GET`. |

---

## Czego NIE robić

- Nie dodawaj pola „autor pozycji” do `OrderEquipmentItem` / `OrderProductionItem`.
  Audyt wykazał 30+ miejsc, które musiałyby to filtrować.
- Nie ruszaj `deleteMany` w `orders.service.ts:679-694`.
- Nie wołaj `writeAuditLog` z endpointów publicznych — wymaga `actorUserId` z FK do `User`.
- Nie podnoś `BODY_SIZE_LIMIT` w `app.ts`.
- Nie dawaj partnerowi możliwości zmiany `vatRate`, `discountGlobal`, waluty ani kursu.
- Nie rejestruj publicznego routera pod `/api` po `requireAuth`.
- Nie przechowuj wygenerowanych PDF-ów na dysku — w tym projekcie snapshot jest
  źródłem prawdy, a PDF powstaje na żądanie.
- Nie zmieniaj providera Prisma i nie przełączaj niczego na sqlite.
