# Generator sceny — mapowanie ról (zębatka)

## Model

1. **BOM planu** — zawsze szczegółowy (`deck-2x1`, `legs-40`, klamry…).
2. **Przepis firmy** — tabela `stage_plan_role_maps` (globalnie, aż do zmiany).
3. **Wiersze zlecenia** — wyłącznie zmapowane rekordy sprzętu.

Akcje:

| Akcja | Skutek |
|---|---|
| `map` | wiersz zlecenia z ilością tej roli i wybranym sprzętem |
| `skip` | zostaje w planie sceny, **nie** wchodzi do zlecenia |

„Dołącz” zostało usunięte. Żeby mieć „podest + nogi” jako jedną pozycję: mapuj `deck-2x1` na rekord „Podest + nogi”, a `legs` ustaw na **Pomiń**.

## UI

Przy rozpisce → **Mapowanie** (podświetla się, gdy brakuje decyzji).
W liście sprzętu przy Mapuj: wyszukiwarka + **+ Dodaj nową pozycję do bazy** (tworzy i od razu wybiera).

## API

`/api/stage-plan-role-maps` — GET, PUT, PUT `/bulk`, DELETE `/:roleKey`
