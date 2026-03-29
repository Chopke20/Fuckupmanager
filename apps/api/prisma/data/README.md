# Dane do importu (seed)

W tym katalogu znajdują się pliki CSV wgrywane do bazy przez `npm run db:seed` (w katalogu `apps/api`):

| Plik        | Opis |
|------------|------|
| `klienci.csv` | Baza klientów: Imię i Nazwisko, Nazwa Firmy/Instytucji, Adres, Telefon, Email |
| `sprzet.csv`  | Cennik sprzętu: Kategoria, Nazwa, Cena (np. AUDIO, ŚWIATŁO, SCENA) |
| `zasoby.csv`  | Zasoby (produkcja/logistyka): Kategoria, Nazwa, Cena – importowane jako sprzęt z kategorią ZASOBY |

Aby zaktualizować dane, podmień pliki CSV i uruchom:

```bash
cd apps/api && npm run db:seed
```

Klienci są aktualizowani po `Nazwa Firmy/Instytucji` (upsert). Sprzęt i zasoby – po parze nazwa+kategoria (create lub update).

**Kody wewnętrzne (sprzęt i zasoby):** Po seedzie każdy sprzęt dostaje unikalny kod `SPR-00001`, `SPR-00002`, … a zasoby `ZAS-00001`, `ZAS-00002`, … Kody są unikalne w całej tabeli; duplikaty są blokowane przez API. Nowe wpisy dostają proponowany kolejny kod (można go zmienić w formularzu).
