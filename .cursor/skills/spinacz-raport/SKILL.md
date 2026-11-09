---
name: spinacz-raport
description: >-
  Pobiera zgłoszenia Pana Spinacza z Gmaila (subject [Lama Bug]) i robi raport
  do omówienia/naprawy. Używaj gdy użytkownik prosi o raport Spinacza, listę
  bugów, co jest do zrobienia z ticketów LAMA-, inbox Spinacza, albo omawia
  requesty z maila rafalszydlowski7@gmail.com.
---

# Raport Spinacza (z Gmaila)

## Źródło

- Skrzynka: `rafalszydlowski7@gmail.com` (MCP `plugin-gmail-gmail`)
- Query: `subject:[Lama Bug]`
- Jeśli MCP wymaga auth → `mcp_auth`, potem ponów search

## Procedura raportu

1. `search_threads` z `query: subject:[Lama Bug]`, `pageSize: 50`, `view: THREAD_VIEW_SUMMARY`
2. Dla każdego wątku (max ~15 świeżych / wszystkie open): `get_message` z `messageFormat: PLAIN_TEXT`
3. Parsuj body: ticketId (`LAMA-…`), typ, pilność, firma, moduł, trasa, opis
4. Odczytaj statusy z personal store (jeśli jest):
   - `spinacz/inbox-status.json` w user personal store
5. Wypisz raport po polsku, pogrupowany:

### Format wyjścia

```
## Raport Spinacza (YYYY-MM-DD)

### Do zrobienia (open)
1. [Pali się] LAMA-… · firma · moduł/trasa
   Opis (1–3 zdania)
2. …

### Backlog / niski priorytet
…

### Pominąć / nie-bug (feedback, żarty)
…

### Już done (ze status store)
…
```

6. Na końcu zapytaj: które ticketty omawiamy / naprawiamy najpierw.
7. Po ustaleniu „done” zaktualizuj `inbox-status.json` (`open` | `discussing` | `done` | `wontfix`).

## Status store

Plik (user personal store): `spinacz/inbox-status.json`

```json
{
  "updatedAt": "ISO",
  "tickets": {
    "LAMA-1108-1444-1OVV": { "status": "open", "note": "" }
  }
}
```

Przy raporcie: nowe tickety z maila bez wpisu → traktuj jako `open` i dopisz do pliku.

## Naprawa

Po wyborze ticketu: czytaj trasę/moduł z maila, szukaj w kodzie, naprawiaj według Lama delivery workflow (build → commit → push gdy użytkownik chce).
