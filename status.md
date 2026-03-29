## Status projektu – Lama Stage

Lama Stage to wewnętrzna aplikacja dla firmy eventowej do kompleksowego **zarządzania zleceniami eventowymi** – od oferty, przez planowanie sprzętu i zasobów, aż po rozliczenia finansowe. Projekt jest zbudowany jako **monorepo** (frontend React/Vite + backend Node/Express z Prisma i wspólnymi typami w `shared-types`) i rozwijany z myślą o stabilnym buildzie, spójnym API oraz dalszym rozwoju funkcji, takich jak kalendarz zleceń, integracje z Google Places/Distance Matrix, generowanie ofert PDF i wsparcie AI.

---

### Architektura – mapa wysokiego poziomu (dla LLM)

- **Monorepo i warstwy**
  - **Backend API**: `apps/api` – Express + Prisma, moduły biznesowe (`clients`, `orders`, `equipment`, `calendar`, `places`, `ai`, `pdf`, `auth`, `finance`), wspólny kontrakt odpowiedzi:
    - listy: `{ data: [...], meta: { total, page, lastPage } }`
    - detal/create/update: `{ data: object }`
  - **Frontend web**: `apps/web` – React + Vite + TypeScript, **`createBrowserRouter` + `RouterProvider`** w `src/lib/router.tsx` (nie `BrowserRouter` — potrzebne m.in. do `useBlocker` przy formularzu zlecenia), formularze i widoki oparte o `shared-types` i klienta API (TanStack Query, React Hook Form, Zustand).
  - **Wspólne typy**: `packages/shared-types` – schematy Zod i DTO, **źródło prawdy** dla payloadów i enums między API i web (np. `order.schema.ts`, `client.schema.ts`, `permission.schema.ts`).
  - **Dokumentacja i plany**: katalog `docs/` zawiera:
    - `APPLICATION_VISION_AND_ROADMAP.md` – pełna wizja, główne moduły i kierunki rozwoju,
    - `AUTH_ACCOUNTS_AND_PERMISSIONS.md` – twarda specyfikacja auth/permissions,
    - `PLAN_ZLECENIE_REFACTOR.md` – jak ma wyglądać docelowy formularz zlecenia (UI, finanse, cykle),
    - `PLAN_OFERTA_PDF.md`, `SPEC_IMPLEMENTACJI_OFERY_PDF_AUTO.md` – plan i spec oferty PDF,
    - `dev-runbook.md` i `docs/stability-reports/*` – sposób uruchamiania, raporty stabilności.

- **Główne domeny biznesowe (backend + frontend)**
  - **Klienci (`clients`)**
    - Backend: moduł `clients` w `apps/api/src/modules` (CRUD klientów, paginacja, kontrakt `{ data, meta }`).
    - Frontend: widok listy i formularza klienta w `apps/web/src/modules/clients` (pobieranie listy, edycja, walidacje oparte o shared-types).
    - Dane: firma, NIP, adres, kontakt (zgodnie z opisem w `APPLICATION_VISION_AND_ROADMAP.md`).
  - **Zlecenia (`orders`)**
    - Backend: moduł `orders` (model `Order` z relacjami do `Client`, `OrderStage`, `OrderEquipmentItem`, `OrderProductionItem`, polami finansowymi, cyklicznością i numeracją).
    - Frontend: `OrderFormPage` i komponenty formularza w `apps/web/src/modules/orders` – jeden główny formularz edytujący:
      - **Zapis**: tylko przyciskiem „Zapisz zlecenie” / „Utwórz zlecenie” lub pośrednio przy przejściu do dokumentów (Oferta, Magazyn, w przyszłości Proposal/Brief) — wtedy najpierw `PATCH` zlecenia, potem nawigacja **bez** dodatkowego pytania o porzucenie zmian (`useBlocker` nie obejmuje przejścia z `/orders/:id` na `/orders/:id/*`). `useBlocker` + `beforeunload` oraz `tryNavigateAway` przy „Powrót / Anuluj” — przy niezapisanych zmianach (`isDirty`) potwierdzenie przy wyjściu na inne trasy (np. **Sprzęt** `/equipment`, **Zasoby** `/resources`). Autozapis draftu zlecenia do localStorage co interwał — wyłączony (draft tylko przy tworzeniu nowego zlecenia).
      - nagłówek (klient, opis, miejsce realizacji z podpowiedzią miejsc),
      - harmonogram (`stages` – montaż/event/demontaż/custom),
      - wykaz sprzętu (`equipmentItems`),
      - produkcję/logistykę (`productionItems`),
      - podsumowanie finansowe (przychód, rabaty, marża, cykle),
      - ustawienia oferty (waluta, **kurs EUR** — domyślnie średni NBP tabela A z `GET /api/finance/exchange-rate/eur`, VAT, ważność, opiekun).
    - Kierunek docelowy UI/formularza jest opisany szczegółowo w `docs/PLAN_ZLECENIE_REFACTOR.md` (tabele „Excel-like”, kolumna Rental, przypisanie do etapów, zlecenia cykliczne).
  - **Sprzęt i zasoby (`equipment` / `resources`)**
    - Backend: katalog sprzętu (`Equipment`), kategorie, ceny, stan, flagi typu „zasób/ludzie” i „rental”.
    - Frontend: listy sprzętu i zasobów z filtrem „ZASOBY”; pozycje zlecenia odwołują się do sprzętu/zasobów lub umożliwiają wpis ręczny (patrz plan refaktoru w `PLAN_ZLECENIE_REFACTOR.md`).
  - **Kalendarz i overview (`calendar`)**
    - Frontend: widok kalendarza (FullCalendar) pokazujący zlecenia i etapy (`stages`), rezerwacje i „inne” wydarzenia; pozwala tworzyć/edytować zlecenia z poziomu kalendarza.
    - Backend: endpointy `calendar-events` agregujące zlecenia/etapy do widoku kalendarza (opisane w `APPLICATION_VISION_AND_ROADMAP.md`).
  - **Miejsca (`places`)**
    - Backend: moduł `places` wykorzystuje Google Places (nowe i legacy) oraz Distance Matrix do:
      - autouzupełniania miejsc (autocomplete),
      - liczenia odległości drogowej od magazynu (Wał Miedzeszyński 251, Warszawa).
    - Frontend: pola wyboru miejsca w zleceniu, pokazanie odległości; smoke nie obejmuje jeszcze tych endpointów (patrz `STABILITY_REPORT.md`).
  - **Finanse (`finance`)**
    - Backend: kalkulacje netto/brutto, VAT, rabatów i marży opierają się na danych z `Order` (sprzęt, produkcja, rabaty, rentale, podwykonawcy); dla oferty PDF logika budowania HTML i sum jest w `offer-v5-builder.ts` (szablon v5); docelowo kalkulacje mogą być współdzielone z modułem finance (shared module – rekomendacja w dokumentach PDF).
    - Frontend: sekcja „Podsumowanie finansowe” w formularzu zlecenia, zgodna z planem w `PLAN_ZLECENIE_REFACTOR.md`.
  - **Auth, konta, role i uprawnienia (`auth`)**
    - Model i zasady są opisane w `docs/AUTH_ACCOUNTS_AND_PERMISSIONS.md`:
      - użytkownicy (`User`), sesje (`Session`), zaproszenia, reset hasła, role dynamiczne (`RoleDefinition`), audit log,
      - permissiony (`PERMISSIONS` i `ROLE_PERMISSION_MAP` w `packages/shared-types/src/schemas/permission.schema.ts`),
      - middleware `requireAuth`, `requireModuleAccess`, `requirePermission` w API i guardy `RequireAuth` / `RequirePermission` w web.
    - Publiczne endpointy (`/api/auth/login`, `forgot-password`, `reset-password`, `accept-invite`) oraz panel admina (`/admin`) z zarządzaniem użytkownikami/rolami/auditem i **backupem bazy danych** (uprawnienie `admin.backup`, endpoint `GET /api/auth/admin/backup` — pobiera kopię pliku SQLite; opcjonalnie `BACKUP_DIR` zapisuje kopię na serwerze).
  - **Integracje AI (`ai`)**
    - Backend: moduł `ai` korzystający z OpenRouter (klucz `OPENROUTER_API_KEY`) – redagowanie opisu zlecenia, generowanie opisów sprzętu/zasobów; opis oferty **dla klienta**: **`POST /api/orders/:id/documents/offer-client-description`** (jak draft oferty, `orders.write`) oraz **`POST /api/ai/offer-client-description`** (`integrations.ai.use`). Pole **`clientOfferDescription`** w `OfferDocumentDraftSchema` (`packages/shared-types`).
    - Frontend: przyciski AI w formularzu zlecenia i sprzęcie; na stronie **Oferta** (`OrderOfferPage`) — osobny blok opisu klienckiego z edycją ręczną, „Generuj z AI” / „Generuj ponownie” i przywrócenie w PDF opisu ze zlecenia (gdy pole usuniesz z draftu).
    - Brak klucza wyłącza funkcje AI, aplikacja pozostaje używalna (patrz `APPLICATION_VISION_AND_ROADMAP.md`).

---

### Oferta PDF – jak działa generator (dla LLM)

- **Pipeline (źródło prawdy)**: **zlecenie → draft oferty (`OrderDocumentDraft`, typ `OFFER`) → PDF**. Snapshot oferty **nie** jest „kopią samego `Order`”: przy każdym generowaniu PDF (i przy `POST .../documents/exports` dla `OFFER`) budowany jest od zera przez `buildOrderOfferSnapshotFromOrder` w `apps/api/src/modules/orders/offer-snapshot-merge.ts`:
  - **Z zlecenia (aktualny stan DB w momencie operacji)**: klient, etapy, sprzęt, produkcja (widoczne w ofercie), opis, rabat globalny, cykliczność, daty, miejsce, status itd.
  - **Z draftu oferty** (lub domyślnego draftu z `buildDefaultDraft` w `order-document-draft-utils.ts`): `offerValidityDays`, `projectContactKey`, `currency`, `exchangeRateEur`, `vatRate`, `issuer` (firma wystawiająca), opcjonalnie **`clientOfferDescription`** — jeśli klucz jest w zapisanym drafcie, treść opisu w PDF bierze się stąd (pusty string = świadomie pusty blok); **brak klucza** w starych draftach = jak dawniej, treść z `Order.description` w snapshotcie (`orderOfferSnapshotToPdfOrderLike` w `offer-snapshot-merge.ts`). W JSON snapshotu pole `documentDraft` jest **zamrożone** z `issuedAt` = czas zapisu; dodatkowo snapshot ma `generatedAt` i `documentNumber` (schemat `OrderOfferSnapshotSchema` w `packages/shared-types`).
  - **PDF i snapshot muszą być identyczne**: `generateOffer` po aktualizacji `Order` w transakcji **ponownie** ładuje zlecenie, buduje snapshot, zapisuje `OrderDocumentExport`, a HTML powstaje z `orderOfferSnapshotToPdfOrderLike(snapshot)` — ten sam obiekt co zapisany JSON.

- **Źródło kodu backend**: `PdfController` w `apps/api/src/modules/pdf/pdf.controller.ts` oraz `buildOfferHtmlV5` w `offer-v5-builder.ts` (szablon v5). Opcja `issuedAt` w builderze ustawia datę w nagłówku; blok „składa” / dane rejestrowe biorą się z `offerIssuer` (z draftu) gdy jest obecny.
  - **Szablon oferty**: `apps/api/src/modules/pdf/templates/offer-v5.html` (mapowanie w komentarzu w `offer-v5-builder.ts`).
  - **Podgląd**: `POST /api/pdf/offer/:orderId/preview` — **bez** zapisu eksportu; buduje ten sam merge co PDF (snapshot w pamięci), numer jak przy następnej wersji (`offerVersion+1`), `Content-Disposition: inline`.
  - **Generowanie**: `POST /api/pdf/offer/:orderId/generate` — budowany jest snapshot kandydujący; porównanie z **ostatnim** eksportem `OFFER` (treść bez `generatedAt`, `documentNumber` i `documentDraft.issuedAt` — funkcje `stripOfferSnapshotMetaForCompare` / `areOfferSnapshotContentsEqual` w `offer-snapshot-merge.ts`). Jeśli treść jest **identyczna**, **nie** podbija się wersji, **nie** tworzy nowego wiersza eksportu, PDF ma **ten sam** numer (`numerZleceniaWRoku.wersjaOferty.rok`) z **aktualną** datą w nagłówku; nagłówki odpowiedzi: `X-Offer-Number-Reused`, `X-Offer-Export-Created`. W przeciwnym razie transakcja: podbicie `offerVersion` / `offerNumber`, insert `OrderDocumentExport`, PDF `Oferta-{numer}.pdf`.
  - **PDF z historii**: endpoint z eksportu (snapshot) — parsowanie `OrderOfferSnapshotSchema` (lub fallback dla starych snapshotów), ta sama ścieżka renderowania z `issuedAt` z `generatedAt` / `documentDraft.issuedAt`.
- **Renderowanie**: Puppeteer (`renderPdf`) używa natywnego `footerTemplate` (stopka renderowana w każdej stronie), a marginesy treści są sterowane w CSS (`@page margin-bottom` + padding w `.body`), żeby nie polegać na `position: fixed`.

- **Dane surowe z Prisma** (przed scaleniem z draftem): `loadOrderForPdf(orderId)` ładuje `Order` z relacjami:
  - `client` (dane firmy klienta),
  - `stages` (harmonogram z `type`, datą i godzinami, sortowanie po `sortOrder`),
  - `equipmentItems` z relacją `equipment` (do jednostki) i sortowaniem po `sortOrder`,
  - `productionItems` filtrowanymi po `visibleInOffer: true` i sortowanymi po `sortOrder`.

- **Logika finansowa i grupowanie** (w `offer-v5-builder.ts`, funkcja `buildOfferHtmlV5`):
  - Liczenie wartości sprzętu i produkcji z uwzględnieniem:
    - ilości (`quantity` / `units`),
    - liczby dni (`days` – każdy kolejny dzień 50% ceny: pierwszy dzień 100%, kolejne: `base * 0.5`),
    - rabatu pozycji (`discount` procentowo),
    - globalnego rabatu zlecenia (`discountGlobal` ze snapshotu / zlecenia),
    - **stawki VAT i waluty z draftu oferty** (w zapisanym snapshotcie — nie z „gołego” `Order`, jeśli się różnią),
    - waluty `PLN`/`EUR` i kursu `exchangeRateEur` przy EUR.
  - Sprzęt (`equipmentItems`) jest **grupowany dynamicznie po `category`** do mapy `equipmentByCategory`; w PDF każda kategoria ma osobny nagłówek i tabelę z LP, nazwą, ilością, ceną netto, kwotą netto, VAT i brutto oraz stopką z sumą dla kategorii.
  - Produkcja (`productionItems`) jest dzielona na:
    - **Transport** – pozycje, których `name` zawiera słowo `transport` (sekcja „Transport”),
    - **Obsługa techniczna** – pozostałe pozycje.
    Obsługa jest dalej grupowana po etapie (`MONTAZ`, `EVENT`, `DEMONTAZ`, `CUSTOM`, `none`) na podstawie `stageIds` (JSON z ID etapów) i mapy `stageMap` (`OrderStage.id -> type`). Do PDF trafiają sekcje „Produkcja i obsługa techniczna” z podsekcjami per etap (nagłówki z `stageLabels`).
  - Blok **„Podsumowanie”** prezentuje:
    - wartość sprzętu, transportu, obsługi,
    - przychód netto przed rabatem,
    - rabat globalny (jeśli `discountGlobal > 0`),
    - wartość netto po rabacie, VAT i brutto.
    Dodatkowo, jeśli zlecenie jest cykliczne (`isRecurring = true` i `recurringConfig` parsuje się do `{ repetitions }`), PDF zawiera podsumowanie **kosztu jednostkowego** i **kosztu całego cyklu** (netto, VAT, brutto) na podstawie liczby powtórzeń.

- **Struktura HTML i layout PDF**:
  - HTML jest budowany z szablonu `templates/offer-v5.html`: nagłówek z logo (SVG base64), numer oferty i meta (data, ważność), dwie kolumny stron („Oferta składa” / „Przygotowana dla”), opis, harmonogram (stages), tabele Sprzęt (wg kategorii), Produkcja i obsługa (wg etapów), Transport, podsumowanie finansowe, opcjonalny blok cykliczny, klauzula poufności i stopka (kierownik projektu, dane rejestrowe). Styl CSS jest w szablonie; dane wstawiane przez zamianę placeholderów (np. `{{OFFER_NUMBER}}`, `{{EQUIPMENT_TBODY}}`).
  - Harmonogram z `order.stages` jest renderowany jako tabela z kolumnami „Typ”, „Początek”, „Koniec” (daty/godziny wyświetlane w formacie `pl-PL`); typy `MONTAZ`/`DEMONTAZ` są transliterowane na „MONTAŻ”/„DEMONTAŻ”.
  - Opis zlecenia (`order.description`) jest wstawiany jako paragraf z `white-space: pre-wrap` z prostym escapowaniem `<`/`>` (bez pełnej sanitacji HTML).
  - Domyślna firma wystawiająca to stałe `COMPANY` w builderze; gdy w danych jest `offerIssuer` (z draftu / snapshotu), nagłówek i stopka „dane rejestrowe” używają **issuer**. Opiekun: `projectContactKey` z draftu (snapshot) + mapa `PROJECT_CONTACTS`.

- **Powiązane dokumenty i szersza specyfikacja**:
  - Pełne decyzje produktowo-techniczne, model danych i kontrakt API dla `oferta PDF` (w tym numeracja AUTO, editor przed generacją, waluty, VAT, sekwencja roczna) są opisane w:
    - `docs/PLAN_OFERTA_PDF.md` – plan funkcjonalny i UX (odniesienie do realnych ofert, rozbicie na fazy),
    - `docs/SPEC_IMPLEMENTACJI_OFERY_PDF_AUTO.md` – twarda specyfikacja wdrożenia (model Prisma, algorytmy numeracji, endpointy `preview/generate`, wymagania treści i układu PDF).
  - Każda zmiana w generatorze oferty PDF powinna:
    - zachować numerację `orderNumber.offerVersion.orderYear` i nazwę pliku `Oferta-{offerNumber}.pdf`,
    - być spójna z logiką finansową (rabat pozycji + rabat globalny, sprzęt/transport/obsługa) opisaną w specyfikacji,
    - respektować podział na waluty (`PLN`/`EUR`) i dozwolone stawki VAT (`0`/`23`),
    - aktualizować odpowiednio dokumenty w `docs/` przy większych zmianach kontraktu lub layoutu.

---

### Auth / Konta / Role / Uprawnienia – mapa funkcjonalna

- **Źródło wiedzy**: `docs/AUTH_ACCOUNTS_AND_PERMISSIONS.md` opisuje pełny model kont, sesji, ról, uprawnień i audit logów (v0.2.x) oraz jak dodawać nowe moduły/role.
- **Backend**
  - Prisma: modele `User`, `Session`, `InvitationToken`, `PasswordResetToken`, `RoleDefinition`, `AuditLog` w `apps/api/prisma/schema.prisma`.
  - Moduł `auth` w `apps/api/src/modules/auth/*`:
    - endpointy publiczne: `POST /api/auth/login`, `forgot-password`, `reset-password`, `accept-invite`,
    - admin: `GET/POST/PATCH/DELETE /api/auth/admin/*` dla użytkowników, ról, audit logów,
    - wysyłka maili: `smtp.mailer.ts`, `auth.mail.ts` (linki z `APP_BASE_URL`).
  - Middleware: `requireAuth`, `requireModuleAccess`, `requirePermission` w `apps/api/src/shared/middleware/auth.middleware.ts` – wszystkie `/api/*` poza `/api/auth/*` są domyślnie chronione.
- **Frontend**
  - Ścieżki auth: `/login`, `/forgot-password`, `/reset-password`, `/accept-invite`, `/admin`.
  - Guardy: `RequireAuth` / `RequirePermission` w `apps/web/src/modules/auth/RequireAuth.tsx` – owijają resztę aplikacji.
  - `AuthProvider` trzyma `user` i `permissions` z backendu (`/api/auth/me`, `/api/auth/login`), z fallbackiem do `resolvePermissionsForRole` po stronie frontu.

---

### Formularz zlecenia i finanse – stan i kierunek

- **Stan obecny**
  - Formularz zlecenia (`OrderFormPage` w web, `orders` w API) obsługuje:
    - nagłówek (klient, miejsce, opis, daty),
    - harmonogram (`stages`),
    - wykaz sprzętu (`equipmentItems` z `isRental`, `visibleInOffer`, dniami i rabatami),
    - produkcję/logistykę (`productionItems` z przypisaniem do etapów),
    - podsumowanie finansowe i zlecenia cykliczne (`isRecurring`, `recurringConfig`),
    - pola oferty (`offerValidityDays`, `projectContactKey`, `currency`, `exchangeRateEur`, `vatRate`).
  - Szczegóły modelu i powiązań wykorzystuje m.in. generator oferty PDF (opisany wyżej).
- **Plan docelowy**
  - Dokument `docs/PLAN_ZLECENIE_REFACTOR.md` definiuje:
    - docelowy layout formularza (nagłówek, harmonogram, sprzęt, produkcja, finanse, zlecenia cykliczne),
    - zasady dla „Rental” (przychód = koszt, marża = 0 na tych pozycjach),
    - uproszczony blok zleceń cyklicznych i kalkulację „za 1 event” oraz „za cykl”,
    - tabelowe widoki „Excel-like” dla sprzętu i produkcji, z wyborem z katalogu lub wpisem ręcznym.
  - Zmiany modelu (Prisma/shared-types) opisane są w sekcji „Schemat i API” tego dokumentu; przy modyfikacji logiki finansowej należy:
    - trzymać jedno źródło prawdy do kalkulacji (docelowo wspólny moduł używany przez UI i PDF),
    - uwzględnić wpływ na ofertę PDF i marżę.
- **Dokumenty przypięte do zlecenia (plan)**
  - Dokument `docs/PLAN_DOKUMENTY_ZLECENIA.md` opisuje docelowy model: z edycji zlecenia **nie** generuje się już bezpośrednio PDF; każde zlecenie ma przypięte dokumenty (Oferta, Proposal, Magazyn, Brief) z osobnymi podstronami.
  - Draft dokumentu = dane na żywo z zlecenia (tylko ustalone pola edytowalne); „Eksportuj do PDF” tworzy **snapshot** danych i nadaje numer; system przechowuje **snapshoty**, nie pliki PDF; „Pobierz PDF” generuje plik na żądanie z snapshotu.
  - Wdrożono trwałe drafty dokumentów: `GET/PUT /api/orders/:id/documents/draft` (typ dokumentu + payload JSON), zapis w modelu `OrderDocumentDraft`.
  - Eksporty snapshotów działają dla `OFFER` i `WAREHOUSE` (oraz technicznie dla pozostałych typów jako core danych), zapis w `OrderDocumentExport` z numeracją per typ dokumentu.
  - `OrderOfferPage` — edycja draftu oferty; **„Generuj PDF”** zapisuje rekord `OrderDocumentExport` (snapshot) i zwraca plik; **usuwanie snapshotu** (`DELETE /api/orders/:id/documents/exports/:exportId`) usuwa wiersz z `OrderDocumentExport` i dla `OFFER` przelicza `Order.offerVersion` / `offerNumber` z pozostałych snapshotów (albo reset `0` / `null` gdy brak). `OrderWarehousePage` — dokument magazynu; snapshot przez `POST .../exports` (usuwanie bez zmiany pól oferty na zleceniu).
  - **Profile firmy (wystawca dokumentów)** — źródło danych instancji (Prisma `IssuerProfile`), seed: dwa profile Lama + jeden `isDefault`. **Admin** (`AdminIssuerProfilesSection` na `/admin`): CRUD, ustawienie domyślnego; **API** `GET/POST/PATCH/DELETE /api/issuer-profiles`, `GET /api/issuer-profiles/default`, `POST …/:id/set-default` — odczyt przy `orders.read`, zmiany przy `admin.users.write`. Nowy draft oferty bez zapisu w `OrderDocumentDraft` bierze `issuer` z profilu domyślnego (`buildOfferDefaultDraft` / `resolveDefaultIssuerForDraft`). `OrderOfferPage`: lista z API, link do Admin dla administratorów; pole `issuer` w draftcie jak dotąd (`OfferIssuerSchema`).
  - **Przycisk „Pobierz” przy NIP (klienci, profile):** `POST /api/integrations/nip-lookup/lookup` — dane firmy z **DataPort.pl** (GUS BIR), nagłówek `X-API-Key`; wymaga `DATAPORT_API_KEY` w konfiguracji API. Dokumentacja: `docs/dataport-nip-lookup.md`.
- **Transport – auto-wycena i ustawienia globalne**
  - W formularzu zlecenia dodano osobną sekcję `Transport` pod `Produkcja i logistyka`; transport jest zapisywany jako pozycje `productionItems` z flagą `isTransport` i polem `isAutoCalculated`.
  - Auto-wycena opiera się o odległość z `places/distance` i globalną listę przedziałów `od km / do km / stawka` (dowolna liczba wierszy); po przekroczeniu najwyższego przedziału działa kilometrówka `stawka/km * km * 2`.
  - Edycja przedziałów (`dodaj/usuń`) jest dostępna zarówno w modalu sekcji transportu zlecenia, jak i w panelu admin, a legenda wyceny pokazuje aktualne przedziały + próg startu kilometrówki.
  - Użytkownik może ręcznie zmienić kwotę transportu; przy zmianie lokalizacji system pyta o ponowne przeliczenie, aby nie nadpisać świadomej ręcznej edycji.
  - Globalne ustawienia transportu są dostępne:
    - z poziomu sekcji transportu (ikona ustawień / modal),
    - z poziomu panelu admin (`AdminUsersPage`) jako ustawienia wspólne dla przyszłych zleceń.
  - Backend: nowe endpointy `GET/PUT /api/finance/transport-pricing`, `GET /api/finance/transport-pricing/quote` oraz model Prisma `TransportPricingSettings`.
  - Endpoint `quote` zwraca breakdown wyliczenia (`mode`, `baseNetPerTrip`, `totalNet`, `formula`) i jest używany w UI dla ikonki `(i)`, aby pokazywać dokładne źródło kwoty.
  - Zmiany ustawień transportu zapisują audit log (`module=finance`, `action=TRANSPORT_PRICING_UPDATE`) z wartościami `before/after`.

---

### Stabilność, uruchamianie i raportowanie

- **Runbook i skrypty**
  - `docs/dev-runbook.md` opisuje:
    - wymagania (Node, npm workspaces),
    - kroki pierwszego uruchomienia (install, build shared-types, db:push/migrate, dev),
    - smoke check (`npm run smoke`) i podstawową diagnostykę błędów (500 na `/api/orders`/`/api/clients`, biały ekran w web).
  - Główne skrypty w root:
    - `npm run dev` – dev API + web na wolnych portach,
    - `npm run build` – build shared-types, api, web,
    - `npm run smoke` – smoke API (health, clients, orders),
    - `npm run db:push`, `npm run db:migrate`, `npm run db:seed`.
- **Raporty stabilności**
  - `docs/stability-reports/STABILITY_REPORT.md` oraz pliki `docs/stability-reports/YYYY-MM-DD-*.md` dokumentują:
    - stan builda, smoke checków, testów E2E/linta po większych zmianach,
    - znane ryzyka (np. `.js` w `apps/api/src`, zależność od Google / OpenRouter),
    - rekomendacje rozszerzenia smoke (np. `/api/places/autocomplete`, `/api/calendar-events`).
  - Po dużym refaktorze lub zmianie kontraktu modułów (orders/clients/equipment/calendar/places/ai/pdf/auth) zaleca się dopisanie nowego raportu stabilności zgodnie z `dev-runbook.md`.

---

### Konwencja dla przyszłych zmian (dla kolejnych LLM)

- **Gdzie dopisywać wiedzę o systemie**
  - `status.md` – ten plik jest **główną mapą projektu dla LLM**:
    - opisuje główne domeny biznesowe i moduły (backend + frontend),
    - wskazuje, gdzie znajduje się kod (moduły w `apps/api`, `apps/web`) i typy (`packages/shared-types`),
    - linkuje do szczegółowych specyfikacji w `docs/`.
  - Szczegółowe plany/specki dla pojedynczych funkcji trzymamy w `docs/*.md` (np. `PLAN_*`, `SPEC_*`).
- **Zasada (powiązana z `.cursor/rules/lama-stability-core.mdc`)**
  - Przy każdej **większej funkcji lub zmianie domenowej** (nowy moduł, duży refaktor, nowy typ dokumentu/PDF, nowa integracja zewnętrzna, nowe reguły numeracji/finansów):
    - **zaktualizuj `status.md`**, dodając:
      - krótki opis funkcji/domeny i jej celu biznesowego,
      - wskazanie głównych plików/backend/frontend (moduły, klasa kontrolera, komponenty UI),
      - odwołania do odpowiednich plików w `docs/` (plan/spec), jeśli istnieją,
      - nietrywialne konwencje (np. numeracja, zasady podziału na sekcje, reguły uprawnień, zależności od zewnętrznych API).
    - jeśli zmiana dotyka kontraktu API lub logiki finansowej, upewnij się, że:
      - shared-types są zgodne z backendem i frontendem,
      - istniejąca dokumentacja w `docs/` jest zaktualizowana,
      - po zmianie przechodzi `npm run build` i `npm run smoke` (patrz rules i `dev-runbook.md`).
