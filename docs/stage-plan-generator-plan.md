# Generator sceny — mapowanie ról (zębatka)

## Model

1. **BOM planu** — zawsze szczegółowy (`deck-2x1`, `legs-40`, klamry…).
2. **Przepis firmy** — tabela `stage_plan_role_maps` (nie na rekordzie `Equipment`).
3. **Wiersze zlecenia** — wyłącznie zmapowane rekordy sprzętu (`equipmentId`).

Akcje na rolę / rodzinę (`legs`, `stairs`):

| Akcja | Skutek |
|---|---|
| `map` | wiersz zlecenia z ilością tej roli |
| `attach` | bez własnego wiersza; ilość **nie** sumuje się do gospodarza |
| `skip` | nie wchodzi do zlecenia |

## UI

Przy rozpisce w edytorze → **Mapowanie** (zębatka) → modal przepisu + podgląd wierszy.

API: `/api/stage-plan-role-maps` (GET, PUT, PUT `/bulk`, DELETE `/:roleKey`).

## Migracja

`20260915160000_stage_plan_role_maps` — tworzy tabelę, przenosi stare `Equipment.stagePlanKey` → `map`, usuwa kolumnę.

## Konfiguracja typowa (Lama)

- `deck-2x1` → map „Podest 2×1 + nogi”
- `legs` → attach → `deck-2x1`
- `deck-clamps` → map (visibleInOffer=false) albo skip
- schody / barierki / obicie → map na własne rekordy
