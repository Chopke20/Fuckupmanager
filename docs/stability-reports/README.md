# Raporty stabilności

Ten katalog służy do krótkich raportów po **dużych zmianach** (refaktor, zmiana API, nowe moduły).

## Kiedy dodać raport

- Refaktor warstwy API lub frontendu (orders, clients, equipment).
- Zmiana kontraktu API (format odpowiedzi, paginacja).
- Duża zmiana w `shared-types` lub Prisma.

## Szablon pliku

Nazwa: `YYYY-MM-DD-krótki-opis.md` (np. `2025-03-07-api-contract-unification.md`).

Zawartość:

```markdown
# YYYY-MM-DD – Krótki tytuł

- **Zmiany:** co zrobiono (1–3 zdania).
- **Build:** ✅ / ❌
- **Smoke:** ✅ / ❌
- **Uwagi:** np. znane ograniczenia, kolejne kroki.
```

Nie trzymaj tu długich snapshotów ani starych raportów – jeden plik na większą zmianę, zwięźle.
