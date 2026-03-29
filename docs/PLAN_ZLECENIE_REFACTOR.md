# Plan refaktoryzacji formularza zlecenia

Punkt wyjścia do ofert PDF: wartość za jeden event + wartość cyklu (gdy włączone).

---

## 1. Nagłówek zlecenia

| Zadanie | Opis |
|--------|------|
| **1.1 Layout klient / miejsce** | Nazwa klienta nachodzi na pole "Miejsce realizacji". Rozdzielić: klient w osobnej linii lub min-width/truncate dla selectu, miejsce w osobnej linii z wystarczającą przestrzenią. Unikać jednego wiersza 50/50. |
| **1.2 Dodawanie nowego klienta z poziomu zlecenia** | Na liście klientów (select) opcja "Dodaj nowego klienta" → modal/formularz nowego klienta. Po zapisaniu: (a) nowy klient pojawia się na liście, (b) jest automatycznie wybrany w zleceniu, (c) użytkownik pozostaje na stronie zlecenia (bez nawigacji). Wymaga: API createClient, wywołanie z modalu, invalidation listy klientów, setValue('clientId', newId). |
| **1.3 Podgląd zlecenia – nazwa klienta** | Zamiast "Wybrany klient" pokazywać faktyczną nazwę firmy (z listy clients po clientId). |
| **1.4 Daty – normalna edycja** | Obecnie input type="date" + isoToDateInput/dateInputToISO mogą powodować auto-uzupełnianie (strefa, parsowanie). Zapewnić: wartość w formacie YYYY-MM-DD bez dziwnych konwersji; ewentualnie trzy pola dzień/miesią/rok lub jeden input text z maską/momentem; nie nadpisywać miesięcy i lat przy wpisywaniu dnia. Sprawdzić dateHelpers i zachowanie w przeglądarce. |

---

## 2. Harmonogram

| Zadanie | Opis |
|--------|------|
| **2.1 Usunięcie "nazwa kafelki"** | Usunąć tytuł/opis "kafelki logiczne" i zbędne etykiety typu "Nazwa kafelki" – zostawić tylko merytoryczne pola. |
| **2.2 Forma wierszy (Excel-like)** | Zamiast dużych boxów: tabela z wierszami (jedna linia = jeden etap). Kolumny: Typ, Data, Godz. od, Godz. do, Etykieta/Inny (opcjonalnie), Notatki, Akcje. Stopka z sumą dni na dole. Przycisk "Dodaj wiersz" na końcu. |
| **2.3 Typ "Inny" – wpis z ręki** | Dla typu CUSTOM ("Inny") pokazać pole tekstowe (np. w kolumnie "Etykieta") do wpisania dowolnej nazwy etapu. |
| **2.4 Etapy: dodawanie i układanie** | Naprawić dodawanie etapów (addStage) i zmianę kolejności (drag & drop lub strzałki). Upewnić się, że sortOrder jest aktualizowany i zapisywany. Sprawdzić czy stages są przekazywane do buildPayload. |

---

## 3. Wykaz sprzętu

| Zadanie | Opis |
|--------|------|
| **3.1 Tabela wierszowa (Excel-like)** | Jedna tabela: wiersz = pozycja. Pierwsza kolumna: nazwa (wpis z ręki lub wybór z listy rozwijanej/wyszukiwarki). Po wyborze z listy: auto-uzupełnienie ceny, kategorii, dni, itd. Wpis ręczny: użytkownik uzupełnia resztę. Po zatwierdzeniu (Enter / wybór) dodawany jest nowy pusty wiersz. |
| **3.2 Stopka tabeli** | Suma i ewentualne podsumowanie zawsze na dole tabeli (sticky lub po ostatnim wierszu), nie w osobnym boxie. |
| **3.3 Usunięcie bloku "Podsumowanie sprzętu"** | Usunąć cały box "Podsumowanie sprzętu" (Pozycje, Wartość netto, Kategorie, Widoczne w ofercie) z formularza zlecenia. |
| **3.4 Rentale (wynajem)** | W wykazie sprzętu dodać kolumnę/checkbox "Rental" (wynajem – urządzenie wynajmowane, bez marży). W kalkulacji marży: przychód z rentalów nie wlicza się do marży (koszt = przychód dla tych pozycji). Wymaga: pole `isRental` w OrderEquipmentItem (schemat + API + Prisma). |

---

## 4. Produkcja i logistyka

| Zadanie | Opis |
|--------|------|
| **4.1 Ta sama mechanika co sprzęt** | Tabela wierszowa: nazwa/zasób z listy (tylko rekordy z Zasobów) lub wpis ręczny, auto-uzupełnienie po wyborze, nowy wiersz po dodaniu. Te same zasady co w wykazie sprzętu. |
| **4.2 Kolumna "Przypisanie do etapu"** | Dodać kolumnę: wybór etapu z harmonogramu (Montaż, Event, Demontaż, Inny + etykieta). Wartość zapisywana w pozycji (np. stageIds / stageId) do użycia w ofercie i kalendarzu. |

---

## 5. Podsumowanie finansowe

| Zadanie | Opis |
|--------|------|
| **5.1 Rentale w kalkulacji marży** | Przychód z pozycji oznaczonych jako "Rental" traktować jako koszt (zerowa marża na nich). Marża = przychód netto (po rabacie) − koszty podwykonawców − wartość rentalów. Ująć to w jednej spójnej sekcji "Kalkulacja marży". |
| **5.2 Uporządkowanie sekcji** | Usunąć powtórzenia: jedna sekcja "Wartość dla klienta" (sprzęt, produkcja, rabat, VAT, brutto), jedna sekcja "Kalkulacja marży (wewnętrzna)" z: przychód netto, koszty podwykonawców, wartość rentalów, marża własna netto, marża %. Usunąć duplikaty "Przychód netto" i drugą identyczną "Kalkulacja marży". "Podsumowanie" zredukować do: Do zapłaty (brutto), ewentualnie jedna linia marży. Notatki finansowe – jeden blok. |

---

## 6. Zlecenia cykliczne

| Zadanie | Opis |
|--------|------|
| **6.1 Uproszczenie UI** | Mały, zwarty blok: przełącznik "To wydarzenie będzie się jeszcze powtarzać X razy" + pole liczba (np. 4). Opcjonalnie: wpis dat kolejnych powtórzeń (do obsługi przez kalendarz). Bez dużych boxów (częstotliwość można uprościć lub zostawić jako opcję zaawansowaną). |
| **6.2 Kalkulacja** | Wartość za 1 event (z podsumowania) × (1 + liczba powtórzeń) = wartość łączna cyklu. Wyświetlać obok: "Za 1 event: X PLN", "Łącznie za cykl (np. 5 eventów): Y PLN". |
| **6.3 Punkt wyjścia do PDF** | Te wartości (za 1 event + za cykl) będą w ofercie PDF dla klienta. Nie implementować PDF w tym planie – tylko model danych i wyświetlanie. |
| **6.4 Daty powtórzeń** | Możliwość wpisania dat (np. lista dat) tak, żeby kalendarz mógł pokazywać powtórzenia. recurringConfig w API jest string (JSON) – przechować np. { repetitions, dates?: [] }. |

---

## 7. Kolejność realizacji (proponowana)

1. **Schemat i API**  
   - Dodać `isRental` do OrderEquipmentItem (shared-types, Prisma, API).  
   - Upewnić się, że recurringConfig przyjmuje JSON (repetitions, dates).

2. **Nagłówek**  
   - Layout klient/miejsce (1.1).  
   - Podgląd: nazwa klienta (1.3).  
   - Daty: naprawa edycji (1.4).  
   - Dodawanie nowego klienta w modalu z pozostaniem na zleceniu (1.2).

3. **Harmonogram**  
   - Usunięcie "nazwa kafelki" (2.1).  
   - Tabela wierszowa + typ "Inny" z wpisem (2.2, 2.3).  
   - Naprawa dodawania i układania etapów (2.4).

4. **Wykaz sprzętu**  
   - Tabela Excel-like, stopka na dole (3.1, 3.2).  
   - Usunięcie "Podsumowanie sprzętu" (3.3).  
   - Kolumna/checkbox Rental (3.4) + uwzględnienie w marży.

5. **Produkcja i logistyka**  
   - Tabela jak sprzęt, tylko zasoby (4.1).  
   - Kolumna przypisania do etapu (4.2).

6. **Podsumowanie finansowe**  
   - Jedna spójna kalkulacja z rentalem (5.1).  
   - Uporządkowanie bloków, usunięcie powtórzeń (5.2).

7. **Zlecenia cykliczne**  
   - Uproszczony UI (6.1).  
   - Kalkulacja za 1 event i za cykl (6.2).  
   - Opcjonalnie daty powtórzeń (6.4).

---

## Zasady (cursor rules)

- Zachować styl nano-compact i spójność z resztą aplikacji.  
- Nie łamać istniejących API bez konieczności; rozszerzyć schematy.  
- Po każdej większej zmianie: szybki test ręczny (lista zleceń, nowe zlecenie, edycja, zapis).
