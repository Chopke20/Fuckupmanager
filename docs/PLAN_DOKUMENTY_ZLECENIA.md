# Plan: Dokumenty przypięte do zlecenia (Oferta, Proposal, Magazyn, Brief)

## 1. Cel i zakres

- **Problem**: Obecnie w edycji zlecenia jest bezpośrednie generowanie PDF (podgląd / generuj). Numeracja ofert jest powiązana z polem `offerVersion`/`offerNumber` na `Order`, a każdy „Generuj” od razu zwraca plik PDF.
- **Rozwiązanie**:
  - Każde zlecenie ma **przypięte dokumenty** (Oferta, Proposal, Magazyn, Brief).
  - Każdy typ dokumentu ma **podstronę** w aplikacji: widok „na żywo” z danymi zlecenia (draft) + **lista eksportów** (tylko te, które zostały wyeksportowane do PDF, z kolejną numeracją).
  - System **nie przechowuje plików PDF** – przechowuje **snapshoty danych** w momencie eksportu. Lista eksportów = lista snapshotów z numerem i datą; „Pobierz PDF” generuje PDF na żądanie z tego snapshotu.
  - **Draft** (aktualny formularz dokumentu) wynika wprost ze zaktualizowanego zlecenia; tylko ustalone pola są edytowalne w widoku dokumentu, reszta jest tylko do odczytu (odniesienie do zlecenia).
- **Efekty**: Jednoznaczna numeracja (tylko eksporty mają numery), historia wersji bez trzymania PDF, możliwość późniejszej zmiany szablonów PDF przy niezmienionym core danych.

---

## 2. Typy dokumentów

| Typ dokumentu | Klucz | Opis | Numeracja (propozycja) |
|---------------|-------|------|------------------------|
| Oferta | `OFFER` | Oferta handlowa dla klienta | `{orderNumber}.{version}.{orderYear}` (np. 16.1.2026) – jak dziś |
| Proposal | `PROPOSAL` | Proposal / oferta rozszerzona | Do ustalenia (np. sekwencja roczna per typ: P-2026-001) |
| Magazyn | `WAREHOUSE` | Lista załadunku / magazynowa | Do ustalenia (np. M-2026-001) |
| Brief | `BRIEF` | Brief techniczny | Do ustalenia (np. B-2026-001) |

W pierwszej fazie **core danych** i flow w aplikacji są wspólne; format numeru dla PROPOSAL/WAREHOUSE/BRIEF można ujednolicić później (np. `{prefix}-{year}-{seq}`).

---

## 3. Model danych

### 3.1. Nowa encja: eksport dokumentu (snapshot)

**Prisma** – nowy model `OrderDocumentExport`:

```prisma
model OrderDocumentExport {
  id             String   @id @default(uuid())
  orderId        String
  order          Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)

  documentType   String   // OFFER | PROPOSAL | WAREHOUSE | BRIEF
  documentNumber String   // numer nadany przy eksporcie (unikalny w systemie lub per order+type)
  exportedAt     DateTime @default(now())

  // Snapshot danych w momencie eksportu (JSON). Struktura zależna od documentType.
  // Dla OFFER: payload zgodny z tym, czego oczekuje generator PDF (order-like + client, stages, equipment, production, ustawienia oferty).
  snapshot       String   // JSON

  createdAt      DateTime @default(now())

  @@unique([orderId, documentType, documentNumber])
  @@index([orderId, documentType])
  @@index([documentType, documentNumber])
  @@map("order_document_exports")
}
```

W modelu `Order` dodać relację:

```prisma
documentExports  OrderDocumentExport[]
```

**Uwaga**: Pole `offerVersion` i `offerNumber` w `Order` można zostawić dla kompatybilności wstecznej (np. „ostatni wyeksportowany numer oferty”) albo stopniowo przenieść numerację wyłącznie do `OrderDocumentExport` – w planie zakładamy, że **nowe eksporty** zawsze tworzą wpis w `OrderDocumentExport`, a numer oferty (dla typu OFFER) może być np. `orderNumber.exportVersion.orderYear`, gdzie `exportVersion` to kolejny numer eksportu oferty dla danego zlecenia.

### 3.2. Numeracja

- **OFFER**: Zachować semantykę `{orderNumber}.{version}.{orderYear}`. Przy tworzeniu eksportu: wziąć aktualne zlecenie, ustalić kolejny `version` = max(eksporty OFFER dla tego order) + 1 (albo obecne `order.offerVersion + 1` przy pierwszej migracji), zapisać w `documentNumber` i w snapshot.
- **PROPOSAL / WAREHOUSE / BRIEF**: Sekwencja roczna per typ (np. tabele `DocumentExportSequence { year, documentType, lastNumber }` lub jedna tabela z polami `year`, `type`, `lastNumber`). Format np. `P-2026-001`, `M-2026-001`, `B-2026-001`.

Sekwencje można zrealizować w transakcji przy `POST .../exports` (odczyt/zapis sekwencji + insert `OrderDocumentExport`).

### 3.3. Struktura snapshotu (core pod przyszłe szablony PDF)

Snapshot to **serializowany DTO** używany przez generator PDF i przez UI do podglądu „zarchiwizowanej” wersji. Wspólna baza dla wszystkich typów dokumentów:

- **Wspólne**: `orderId`, `documentType`, `documentNumber`, `exportedAt` (można w API zwracać z rekordu, nie tylko z JSON).
- **Dla OFFER** (i podobnie dla innych): obiekt „order-like” wystarczający do zbudowania PDF bez odpytywania Order/Client:
  - Nagłówek: nazwa zlecenia, opis, miejsce, daty, klient (id + companyName, NIP, adres, kontakt).
  - Harmonogram: etapy (type, date, timeStart, timeEnd, label, sortOrder).
  - Sprzęt: pozycje (name, category, quantity, unitPrice, days, discount, visibleInOffer, isRental, sortOrder).
  - Produkcja: pozycje (name, rateType, rateValue, units, discount, stageIds, visibleInOffer, sortOrder).
  - Ustawienia oferty: currency, exchangeRateEur, vatRate, discountGlobal, offerValidityDays, projectContactKey.
  - Opcjonalnie: isRecurring, recurringConfig (dla kalkulacji „za 1 event” / „za cykl”).

W **shared-types** wprowadzić np.:

- `OrderOfferSnapshotSchema` (Zod) – struktura JSON snapshotu dla OFFER (płaskie lub zagnieżdżone pola, spójne z tym, co dziś przyjmuje `buildOfferHtml`).
- Typy dla PROPOSAL / WAREHOUSE / BRIEF można dodać w kolejnych fazach (na razie wystarczy `documentType` + ogólny `Record<string, unknown>` lub jeden wspólny typ bazowy).

Dokładny kształt (nazwy pól, zagnieżdżenia) warto dopasować do obecnego `loadOrderForPdf` + `buildOfferHtml`, tak aby generator mógł dostać albo `Order` z Prisma, albo ten sam kształt z przekazanego snapshotu.

---

## 4. API

### 4.1. Zasób: eksporty dokumentów zlecenia

- **Lista eksportów**  
  `GET /api/orders/:orderId/documents/exports?documentType=OFFER`  
  Zwraca: `{ data: OrderDocumentExport[], meta?: { total } }`.  
  Każdy element: `id`, `orderId`, `documentType`, `documentNumber`, `exportedAt`, opcjonalnie fragment snapshotu (np. tytuł) – bez pełnego JSONa jeśli duży.

- **Szczegóły eksportu (snapshot)**  
  `GET /api/orders/:orderId/documents/exports/:exportId`  
  Zwraca: `{ data: { id, orderId, documentType, documentNumber, exportedAt, snapshot } }`.  
  Snapshot to obiekt (np. OfferSnapshotDto), nie string – backend parsuje JSON z bazy.

- **Utworzenie eksportu (snapshot + numer)**  
  `POST /api/orders/:orderId/documents/exports`  
  Body: `{ documentType: "OFFER" }` (w kolejnych fazach: PROPOSAL, WAREHOUSE, BRIEF).  
  Logika:
  1. Załadować zlecenie z relacjami (client, stages, equipmentItems, productionItems).
  2. Zbudować obiekt snapshot (np. mapowanie Order → OfferSnapshotDto).
  3. Dla OFFER: ustalić kolejny numer (orderNumber.version.orderYear); dla innych typów: sekwencja roczna.
  4. Zapisać w `OrderDocumentExport`: `orderId`, `documentType`, `documentNumber`, `snapshot: JSON.stringify(snapshot)`, `exportedAt`.
  5. Dla OFFER opcjonalnie zaktualizować `Order.offerVersion` i `Order.offerNumber` (dla kompatybilności).
  6. Zwrócić `{ data: createdExport }` (bez pełnego snapshotu w odpowiedzi lub z nim – do ustalenia).

- **Generowanie PDF z eksportu**  
  `POST /api/pdf/offer/export/:exportId` (albo `/api/orders/:orderId/documents/exports/:exportId/pdf`)  
  Dla typu OFFER: wczytać eksport, sparsować `snapshot`, przekazać do istniejącej logiki budowania HTML/PDF (zamiast ładowania Order z bazy).  
  Zwracać: `application/pdf`, `Content-Disposition: attachment; filename="Oferta-{documentNumber}.pdf"`.  
  **Nie** tworzy nowego eksportu i **nie** zmienia numeracji – tylko generuje plik z istniejącego snapshotu.

- **Podgląd PDF z draftu (bez zapisu eksportu)**  
  Zachować obecny `POST /api/pdf/offer/:orderId/preview` – generuje PDF z aktualnego zlecenia, bez zapisu.  
  W UI: dostępny z podstrony „Oferta” (draft), przycisk „Podgląd PDF”.

### 4.2. Zasób: draft dokumentu

- **Draft = aktualne dane zlecenia w formie „widoku dokumentu”.**  
  `GET /api/orders/:orderId/documents/draft?documentType=OFFER`  
  Zwraca ten sam kształt co snapshot (OfferSnapshotDto), ale zbudowany na żywo z Order.  
  Frontend używa tego do wyświetlenia formularza „Oferta” (pola tylko do odczytu z zlecenia + pola edytowalne, np. offerValidityDays, projectContactKey, currency, vatRate).  
  Zapisywanie zmian draftu = zapis do Order (np. `PATCH /api/orders/:orderId`), nie do osobnej encji.

### 4.3. Kompatybilność wsteczna z obecnym PDF

- Endpointy `POST /api/pdf/offer/:orderId/preview` i `POST /api/pdf/offer/:orderId/generate`:
  - **preview**: bez zmian – dalej generuje podgląd z aktualnego zlecenia.
  - **generate**: można zmienić na: (1) utworzenie eksportu (snapshot + numer) przez `POST .../documents/exports` z `documentType: OFFER`, (2) wywołanie generowania PDF z tego eksportu i zwrócenie pliku. Albo usunąć bezpośrednie „generate z orderId” i w UI zawsze: najpierw „Eksportuj” (tworzy rekord), potem „Pobierz PDF” z listy eksportów.  
  Rekomendacja: **nie** generować PDF od razu w edycji zlecenia; w edycji zlecenia **nie ma** przycisków „Podgląd PDF” / „Generuj PDF” – są one tylko na podstronie dokumentu (np. `/orders/:id/offer`).

---

## 5. Frontend – jak to może wyglądać w aplikacji

### 5.1. Nawigacja i routing

- **Edycja zlecenia**  
  ` /orders/:id` – jak dziś (nagłówek, harmonogram, sprzęt, produkcja, finanse, ustawienia oferty).  
  **Usunąć** z tej strony bezpośrednie przyciski „Generuj ofertę PDF” / „Podgląd PDF” oraz modal oferty PDF.  
  Zamiast tego: link/ przycisk **„Dokumenty”** (lub osobne linki: Oferta, Proposal, Magazyn, Brief) prowadzący do podstron dokumentów.

- **Podstrony dokumentów (draft + lista eksportów)**  
  - ` /orders/:id/offer` – Oferta  
  - ` /orders/:id/proposal` – Proposal (na razie placeholder lub ten sam layout co oferta)  
  - ` /orders/:id/warehouse` – Magazyn  
  - ` /orders/:id/brief` – Brief  

  Wspólny układ każdej podstrony:
  - **Breadcrumb**: Zlecenia > [Nazwa/num zlecenia] > Oferta (lub Proposal / Magazyn / Brief).
  - **Draft (aktualny)** – sekcja „Aktualna wersja” / „Na podstawie zlecenia”:  
    - Dane tylko do odczytu (np. klient, harmonogram, sprzęt, produkcja) – pobrane z `GET .../documents/draft?documentType=OFFER` lub z cache’a zlecenia.  
    - Edytowalne tylko ustalone pola (np. oferta: ważność, opiekun, waluta, kurs EUR, VAT).  
    - Przyciski: **„Podgląd PDF”** (wywołuje `POST /api/pdf/offer/:orderId/preview`), **„Eksportuj do PDF”** (tworzy eksport: `POST .../documents/exports` z `documentType: OFFER`, po sukcesie można pokazać toast i odświeżyć listę eksportów; opcjonalnie od razu wywołać pobranie PDF z nowego eksportu).
  - **Lista eksportów** – tabela: data eksportu, numer dokumentu, akcja **„Pobierz PDF”** (wywołanie `POST .../exports/:exportId/pdf` lub odpowiedniego endpointu).  
  - Opcjonalnie: klik w wiersz eksportu → podstrona ` /orders/:id/offer/exports/:exportId` z podglądem danych snapshotu (tylko do odczytu) i przyciskiem „Pobierz PDF”.

### 5.2. Spójność z formularzem zlecenia

- Wszystkie dane merytoryczne (klient, etapy, sprzęt, produkcja, rabaty, cykliczność) pochodzą z zlecenia.  
- Edycja tych danych odbywa się w `/orders/:id`, nie na podstronie dokumentu.  
- Na podstronie dokumentu użytkownik widzi „to samo” co w zleceniu (w formie czytelnej) plus możliwość ustawienia parametrów eksportu (ważność, opiekun, waluta itd.) i wykonania „Podgląd PDF” / „Eksportuj do PDF” oraz pobrania PDF z wcześniejszych eksportów.

### 5.3. Proposal, Magazyn, Brief

- Na razie można zrobić **core** (model, API listy/tworzenia eksportów, draft), a widoki Proposal/Magazyn/Brief jako **placeholdery**: ta sama struktura podstrony (draft + lista eksportów), draft może pokazywać uproszczony widok zlecenia, lista eksportów pusta lub z testowymi danymi.  
- Szablony PDF dla tych typów ustalimy później – ważne, żeby snapshot miał wspólną bazę (np. minimalny zestaw pól z zlecenia + typ dokumentu), a rozszerzenia (np. pola specyficzne dla briefu) dodać w shared-types i w snapshotcie w kolejnych krokach.

---

## 6. Fazy wdrożenia

### Faza 1 – Core danych i API (bez zmiany UI)

1. **Prisma**: Dodać model `OrderDocumentExport`, relację w `Order`, migracja/db:push.
2. **shared-types**: Dodać typy dla snapshotu oferty (np. `OrderOfferSnapshotSchema`, `OfferSnapshotDto`) i eksportu (np. `OrderDocumentExportSchema`, `DocumentType` enum).
3. **API**:
   - `GET/POST /api/orders/:orderId/documents/exports`, `GET .../exports/:exportId`.
   - Budowa snapshotu z Order (funkcja `orderToOfferSnapshot`).
   - Przy `POST exports` z `documentType: OFFER`: numeracja jak dziś (orderNumber.version.year), zapis snapshotu.
   - Endpoint generowania PDF z eksportu: `POST /api/pdf/offer/export/:exportId` (wczytywanie snapshotu, wywołanie buildOfferHtml z tego danych, render PDF).
4. **PdfController**: Refaktor: wydzielić `buildOfferHtml(snapshot: OfferSnapshotDto)` (lub przyjmować union Order | OfferSnapshotDto), tak aby działał zarówno z Order z bazy, jak i z przekazanego snapshotu. `preview` dalej z Order; nowy endpoint `export/:exportId` z snapshotu.
5. Nie usuwać jeszcze z UI przycisków oferty – można je zostawić, ale „Generuj” pod spodem niech tworzy eksport i zwraca PDF z eksportu (kompatybilność przejściowa).

### Faza 2 – Frontend: podstrony dokumentów, usunięcie bezpośredniego PDF z edycji

1. **Routing**: Dodać trasy ` /orders/:id/offer`, ` /orders/:id/proposal`, ` /orders/:id/warehouse`, ` /orders/:id/brief`.
2. **Strona Oferta** (`/orders/:id/offer`):  
   - Pobranie draftu (draft API lub dane zlecenia).  
   - Widok „na żywo” (tylko odczyt + edytowalne pola oferty).  
   - Przyciski „Podgląd PDF”, „Eksportuj do PDF”.  
   - Lista eksportów (tabela) + „Pobierz PDF” per wiersz.
3. **Edycja zlecenia** (`/orders/:id`): Usunąć modal oferty PDF i przyciski generowania PDF; dodać linki do „Oferta”, „Proposal”, „Magazyn”, „Brief” (np. dropdown „Dokumenty” lub osobne przyciski).
4. **Proposal / Magazyn / Brief**: Placeholder strony (ten sam layout: draft + lista eksportów), draft uproszczony, lista eksportów z API (pusta do pierwszego eksportu).

### Faza 3 – Rozszerzenia

- Numeracja i snapshoty dla PROPOSAL, WAREHOUSE, BRIEF (sekwencje, kształt snapshotu).
- Szablony PDF dla tych typów (osobny dokument).
- Ewentualne podstrony ` /orders/:id/offer/exports/:exportId` z podglądem snapshotu.

---

## 7. Podsumowanie – core danych pod przyszłe szablony eksportów

- **Źródło prawdy**: Zlecenie (Order + relacje). Draft dokumentu = odczyt z Order.
- **Historia**: Tabela `OrderDocumentExport` – jeden rekord = jeden eksport (jedna wersja PDF); przechowujemy tylko **snapshot JSON**, nie plik PDF.
- **Numeracja**: Tylko eksporty mają numery (OFFER: orderNumber.version.year; inne typy: do ustalenia, np. prefix-year-seq).
- **Generowanie PDF**: Zawsze z danych – albo aktualne zlecenie (podgląd), albo snapshot (pobranie PDF z listy eksportów). Szablony PDF można zmieniać później przy niezmienionym core (snapshot + typ dokumentu).
- **Aplikacja**: Edycja zlecenia bez bezpośredniego generowania PDF; dokumenty na osobnych podstronach z draftem i listą eksportów; „Eksportuj do PDF” tworzy snapshot i numer; „Pobierz PDF” generuje plik z snapshotu na żądanie.

Po zatwierdzeniu planu kolejny krok to **Faza 1** (model Prisma, shared-types, API eksportów, endpoint PDF z eksportu, refaktor buildOfferHtml).
