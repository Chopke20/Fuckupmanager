# Generator sceny z podestów — dokumentacja wdrożenia

Status: **wdrożone** (lokalnie zbudowane, testy przechodzą).

---

## Co zostało zrobione

### P1 — Status zapisu (kropka)
- `useStagePlanProjectSession`: `saveStatus`, `busy`, `consecutiveFailures`, `pendingSince`, `lastSavedAt`
- Czerwona kropka po 2 nieudanych zapisach lub gdy zmiany czekają >15 s
- Przyciski blokowane przez `busy`, nie przez autozapis

### P2 — Generator nad edytorem
- Blok „Ułóż prostokąt” przeniesiony nad pasek narzędzi w `StagePlatformVisualizer`

### P3 — Eksport PDF z Toolbox
- `POST /api/stage-plan-projects/preview-pdf` (uprawnienie `orders`)
- Przycisk „Pobierz PDF” w `StagePlanProjectBar`

### P4 — Powrót do „Zaznacz” po schodach
- `StagePlanCanvas.onToolDone` → `setTool('select')` po postawieniu biegu

### P6.3 — Klamry po obwodzie
- `computeStagePerimeterClamps()` w `stagePlatformGeometry.ts`
- Prostokąt 6×4 → 10 szt.; jeden rząd → bez duplikatu z tyłu
- Testy w `stagePlatformGeometry.test.ts`

### P5 — Mapowanie sprzętu (`stagePlanKey`)
- Kolumna `Equipment.stagePlanKey` + migracja `20260902210000_equipment_stage_plan_key`
- `StageBomLine.catalogKey` w BOM
- `applyStagePlanToOrder.ts`: dopasowanie wyłącznie po `stagePlanKey` (usunięte fuzzy match)
- `StageBomCatalogTable`: cena, checkbox „W ofercie”, Utwórz / Wskaż
- Pole „Rola w generatorze sceny” w `EquipmentFormModal` (kategoria Scena)
- Nogi: `offer: false` w BOM; rekord w bazie z `visibleInOffer: false`

### P7 — Plan sceny per blok oferty
- `OrderStagePlanPage`: przełącznik planów (zlecenie + bloki z `stagePlanJson`)
- `GET /api/pdf/stage-plan/:orderId/generate?blockId=…`

### Wcześniejsze (z poprzedniej sesji, w tym commicie)
- `StagePlanProject` + autozapis projektów
- `orderOfferBlock.stagePlanJson` + migracja `20260902180000_offer_block_stage_plan`
- Przycisk „Złóż scenę” per blok oferty

---

## Migracje do zastosowania na VPS

1. `20260902180000_offer_block_stage_plan` — `stagePlanJson` na blokach oferty
2. `20260902210000_equipment_stage_plan_key` — `stagePlanKey` na sprzęcie

Deploy: push na `main` → GitHub Actions → sprawdzić logi `Applying migration` dla obu firm.

---

## Konfiguracja sprzętu (pierwsze uruchomienie)

Dla każdej firmy zmapuj pozycje w module Sprzętu (pole „Rola w generatorze sceny”) lub z poziomu generatora (Utwórz / Wskaż):

| Klucz | Przykładowa nazwa | W ofercie | Cena |
|---|---|---|---|
| `deck-2x1` | Podest 2×1 m + nogi | tak | wg cennika |
| `legs-40` | Nogi 40 cm | **nie** | 0 |
| `deck-clamps` | Klamry blatów | **nie** | 0 |
| `cladding-skirt` | Obicie kotara (mb) | tak | wg cennika |
| `stairs-40` | Schody 40 cm | tak | wg cennika |
| `railings` | Barierki (mb) | tak | wg cennika |

Stare zlecenia nie zmieniają się — pozycje trzymają snapshot ceny i widoczności.

---

## Decyzje biznesowe (zamknięte)

- **Klamry:** tylko po obwodzie, w sztukach (`computeStagePerimeterClamps`)
- **Niewyceniane:** w wykazie sprzętu, poza ofertą PDF/Excel — flaga `visibleInOffer`
- **Nogi:** osobny rekord magazynowy, niewidoczny w ofercie; podest wyceniony raz
