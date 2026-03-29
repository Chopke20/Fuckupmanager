# Plan: oferta PDF – styl Lama Stage, złożoność Media Camp

**Odniesienie:** Oferta 16.1.2026 wariatn 8x6 (Lama Stage) = wygląd; 30.11 Dioda Lama Stage (Media Camp) = poziom złożoności.

---

## 1. Porównanie obu ofert

### 1.1. Oferta Lama Stage (wzór wyglądu)

| Element | Zawartość |
|--------|-----------|
| **Nagłówek** | Miejsce i data wystawienia, oferta ważna (X dni), numer oferty (np. 16.2.2026) |
| **Dwie kolumny** | „Oferta składa” (Lama Stage, NIP, adres, www, email, tel) \| „Oferta przygotowana dla” (klient: firma, NIP, adres) |
| **Opis** | Jedno zdanie/akapit: realizacja techniczna wydarzenia „…” w dniu … w miejscu … (np. montaż od 3:00) |
| **Tabela Urządzenia** | LP, Nazwa, ilość, cena netto, wartość netto, VAT (23%), wartość brutto – każda pozycja z VAT i brutto, na dole suma |
| **Info pod tabelą** | Ilość dni (każdy kolejny dzień 50%): 1 |
| **Tabela Produkcja i obsługa** | Ta sama struktura co urządzenia (LP, Nazwa, ilość, cena netto, wartość netto, VAT, wartość brutto), suma |
| **Blok podsumowania** | Koszt jednostkowy \| Koszt cyklu wydarzeń; Rabat: X%; Ilość wydarzeń: 1; Wartość netto, VAT, brutto |
| **Opiekun projektu** | Imię i nazwisko, telefon |
| **Stopka** | Tekst o poufności i zakazie rozpowszechniania |

### 1.2. Oferta Media Camp (wzór złożoności)

| Element | Zawartość |
|--------|-----------|
| **Nagłówek** | Dział handlowy, kierownik projektu (tel, email), dane firmy (pełne dane prawne) |
| **Klient** | Nazwa, adres, NIP, kontakt, kierownik projektu po stronie klienta |
| **Identyfikacja** | Nazwa projektu, numer oferty, data sporządzenia, **miejsce** (np. Warszawa) |
| **Harmonogram** | Tabela: Początek \| Koniec – osobne wiersze dla MONTAŻ, EVENT, DEMONTAŻ (daty + godziny) |
| **Sekcje grupowe** | Każda sekcja = grupa pozycji + „Łącznie [nazwa] PLN X” |
| **Multimedia** | Nazwa, Opis, Cena, Liczba, Rabat%, Dni pracy, Razem netto |
| **Scena, konstrukcje** | Jak wyżej |
| **Okablowanie** | Jak wyżej |
| **Transport** | Osobna sekcja: Samochód, Liczba, Przelicznik, Cena, Razem netto (np. Dostawczy L4H2, 1, 1 Dzień, 400 PLN) |
| **Obsługa techniczna** | **Podział na fazy**: MONTAŻ (pozycje + suma), DEMONTAŻ (pozycje + suma); kolumny: Nazwa, Opis, Cena, Liczba, Okres, Razem netto |
| **Podsumowanie** | Wartość sprzętu, wartość transportu, wartość obsługi, wartość netto, VAT, wartość brutto |
| **Warunki** | Np. „Oferta ważna 30 dni” |

---

## 2. Mapowanie na dane zlecenia (obecny stan)

| Potrzebne w PDF | Źródło w systemie | Uwagi |
|-----------------|------------------|--------|
| Miejsce i data wystawienia | Nowe pole lub data generowania | Można: data z Order albo osobne pole `offerIssuedAt` |
| Oferta ważna X dni | Brak | Propozycja: pole `offerValidityDays` (np. 14) w zleceniu lub stała |
| Numer oferty | Brak w czytelnej formie | Propozycja: pole `offerNumber` (np. 16.2.2026) lub generować z daty + id |
| Dane Lama Stage (NIP, adres, tel…) | Brak w systemie | Propozycja: konfiguracja globalna (env / tabela ustawień) |
| Klient (firma, NIP, adres) | `Client`: companyName, nip, address, contactName, email, phone | OK |
| Opis realizacji | `Order.description` + `Order.venue` + `Order.dateFrom` / stages | Można złożyć z istniejących pól |
| Urządzenia z VAT/brutto w wierszu | `OrderEquipmentItem` + `order.vatRate` | Obliczenie w PDF; styl tabeli jak Lama |
| Ilość dni (kolejny 50%) | Z harmonogramu / `equipmentItems.days` | Już jest w logice (np. w kontrolerze PDF) |
| Produkcja i obsługa | `OrderProductionItem` | OK |
| Grupowanie sprzętu w sekcje | `OrderEquipmentItem.category` | Już jest w PDF; można dopasować nazwy sekcji (Multimedia, Scena, Transport…) |
| Harmonogram Montaż/Event/Demontaż | `OrderStage` (type, date, timeStart, timeEnd) | Jest; w PDF dodać tabelę Początek/Koniec jak w Media Camp |
| Transport jako osobna sekcja | Brak | Obecnie transport może być w produkcji. Opcje: kategoria „Transport” w produkcji ALBO osobna sekcja w PDF dla pozycji z kategorią/typem „Transport” |
| Obsługa per faza (Montaż / Demontaż) | `OrderProductionItem.stageIds` | Jest; w PDF grupować pozycje produkcji wg etapu (po stageIds) i pokazać podsekcje MONTAŻ / DEMONTAŻ |
| Podsumowanie: sprzęt / transport / obsługa | Obliczenia z equipment + produkcja (z podziałem) | Wymaga zdefiniowania: co liczymy jako „transport” (np. kategoria) i „obsługa” (reszta produkcji) |
| Opiekun projektu | Brak | Propozycja: pole w zleceniu `projectContactName`, `projectContactPhone` lub globalne ustawienie |
| Koszt jednostkowy vs cykl (zlecenie cykliczne) | `Order.isRecurring`, `recurringConfig` (repetitions, dates) | Jest; w PDF blok jak w Lama Stage |
| Warunki (oferta ważna X dni) | Jak „Oferta ważna X dni” u góry | To samo pole / stała |

---

## 3. Decyzje po Twoich odpowiedziach (zamknięte)

### 3.1. Numeracja zleceń i ofert

- Wprowadzamy numerację zleceń.
- Numer oferty jest powiązany z numerem zlecenia.
- Format: `numerZlecenia.numerWersji.rok` (np. `16.1.2026`).
- Nazwa pliku PDF: `Oferta-{numer}.pdf`.

### 3.2. Stałe biznesowe i wybory w generatorze

- Oferta ważna: domyślnie 14 dni.
- W generatorze PDF dodajemy możliwość wyboru (editor przed wygenerowaniem), ale wartość startowa zawsze 14.
- Opiekun projektu wybierany z listy:
  - Rafał Szydłowski, tel. 504361781
  - Michał Rokicki, tel. 793435302
- Dane firmy do PDF bierzemy ze wzoru oferty Lama Stage.

### 3.3. Struktura merytoryczna PDF

- Opis: z pola opisu zlecenia.
- Harmonogram: tylko etapy, które są faktycznie w zleceniu.
- Sprzęt: zawsze grupowanie dynamicznie po kategoriach (elastyczne, bez sztywnej mapy).
- Produkcja:
  - transport = stała kategoria „Transport” (osobna sekcja),
  - obsługa = podział per block/faza (na podstawie przypięcia do etapów).
- Podsumowanie: wartość sprzętu + transport + obsługa, następnie netto/VAT/brutto.
- Blok cykliczny pokazujemy tylko gdy `isRecurring = true`.
- Rabaty: pokazujemy rabat pozycji i rabat globalny.

### 3.4. Waluta i VAT

- Dodajemy obsługę walut: PLN i EUR.
- W zleceniu: kurs EUR (proponowany lub ręcznie wpisany).
- VAT: wybór 23% lub 0% w zleceniu.

### 3.5. Rola sekcji Transport

- Na teraz: transport liczony ryczałtem jako jedna funkcja zlecenia.
- Na przyszłość: automatyka zależna od odległości magazyn -> venue.

---

## 4. Minimalne dodatkowe dane w zleceniu

| Pole | Typ | Opis |
|------------|-----|------|
| **orderNumber** | number | Numer zlecenia rosnący (globalny licznik). |
| **offerVersion** | number | Wersja oferty dla zlecenia (start 1, kolejne generacje mogą podbijać). |
| **offerNumber** | string | Finalny numer do druku, składany jako `orderNumber.offerVersion.rok` (np. `16.1.2026`). |
| **offerValidityDays** | number | Domyślnie 14; możliwa zmiana w editorze generowania PDF. |
| **projectContactKey** | enum/string | Wybór opiekuna z listy predefiniowanej (Rafał/Michał). |
| **currency** | enum | `PLN` lub `EUR`. |
| **exchangeRateEur** | number? | Kurs EUR do wyliczeń/druku (gdy waluta lub prezentacja wymaga przeliczeń). |
| **vatRate** | number | Do wyboru 23 lub 0. |

Dane firmy (Lama Stage) trzymamy centralnie (konfiguracja), a nie per zlecenie.

---

## 5. Decyzje finalne (po doprecyzowaniu)

1. **Wersjonowanie oferty i unikalność nazw**
   - Proces: zlecenie -> oferta -> feedback -> zmiana zlecenia -> nowa oferta (wiele iteracji).
   - Wymóg: wygenerowane oferty z jednego zlecenia nie mogą mieć tej samej nazwy.
   - Reguła techniczna:
     - numer zlecenia powstaje przy utworzeniu,
     - numeracja resetuje się co rok,
     - wersja oferty rośnie przy kolejnych generacjach/zapisach wersji,
     - finalna nazwa pliku: `Oferta-{offerNumber}.pdf` (unikalna dzięki wersji).

2. **Numeracja**
   - Numer zlecenia: nadawany przy utworzeniu.
   - Reset numeracji: roczny.
   - Ręczna edycja numeru oferty: dozwolona, ale system musi pilnować unikalności (walidacja/kolizje).

3. **Waluty i kurs**
   - Kurs EUR: domyślnie pobierany automatycznie + możliwość ręcznej edycji.
   - Gdy waluta = EUR, PDF pokazuje tylko EUR.

4. **VAT**
   - Tylko wybór stawki (23% albo 0%); bez dodatkowego pola opisowego.

5. **Transport i obsługa**
   - Transport jest częścią produkcji (jedna z pozycji).
   - Pozycje bez etapu w „obsługa per block” trafiają poniżej, bez adnotacji.

6. **Editor generowania PDF**
   - Zmiany z editora zapisują się do zlecenia (nie tylko „na chwilę”).
   - Ma być podgląd PDF przed pobraniem.

7. **Pozostałe dokumenty**
   - Na teraz tylko przyciski (bez implementacji backendu):
     - oferta proposal
     - magazyn załadunek
     - brief techniczny

---

## 6. Proponowana kolejność działań (kolejny plan realizacyjny)

1. **Faza 0 – opcje dokumentów (UI shell)**  
   - Dodać w zleceniu listę dostępnych dokumentów:
     - oferta PDF
     - oferta proposal
     - magazyn załadunek
     - brief techniczny
   - Na teraz aktywna implementacja tylko dla „oferta PDF”, pozostałe jako opcje „w przygotowaniu”.

2. **Faza 1 – model danych i numeracja**  
   - Dodać numerację zleceń (`orderNumber`) i wersję oferty (`offerVersion`).  
   - Wyliczać/persistować `offerNumber = orderNumber.offerVersion.rok`.  
   - Dodać pola oferty: `offerValidityDays` (domyślnie 14), `projectContactKey`, `currency`, `exchangeRateEur`.  
   - Ograniczyć VAT do 23 lub 0.

3. **Faza 2 – szablon PDF (styl Lama Stage)**  
   - Nagłówek: miejsce i data, ważność, numer oferty.  
   - Dwie kolumny: firma \| klient.  
   - Opis realizacji z pól zlecenia.  
   - Tabela urządzeń: LP, Nazwa, ilość, cena netto, wartość netto, VAT %, wartość brutto, suma (styl Lama).  
   - Info „Ilość dni (każdy kolejny 50%)”.  
   - Tabela produkcji w tym samym stylu (na razie jedna tabela).  
   - Podsumowanie: przychód, rabat, netto, VAT, brutto; przy cyklicznym: koszt jednostkowy vs cykl.  
   - Opiekun projektu, stopka poufności.

4. **Faza 3 – złożoność w stylu Media Camp**  
   - Harmonogram: tabela Początek/Koniec dla MONTAŻ, EVENT, DEMONTAŻ (tylko istniejące typy).  
   - Sprzęt: sekcje wg kategorii z „Łącznie [nazwa]” (zawsze dynamicznie wg kategorii).  
   - Transport: osobna sekcja z pozycji produkcji oznaczonej kategorią/typem „Transport”.  
   - Obsługa techniczna: podsekcje MONTAŻ / DEMONTAŻ wg `stageIds`; pozycje bez etapu pokazane na końcu bez adnotacji.  
   - Podsumowanie: wartość sprzętu, transportu, obsługi, netto, VAT, brutto.  
   - Blok „Warunki” (oferta ważna X dni).

5. **Faza 4 – editor generowania + dopracowanie**  
   - „Editor generowania PDF” przed eksportem: ważność (domyślnie 14), opiekun (2 opcje), waluta, kurs EUR, VAT (23/0).  
   - Zmiany z editora zapisują się do zlecenia.  
   - Podbijanie wersji oferty przy generacji i walidacja unikalności numeru/oferty.  
   - Wywołanie API i pobranie pliku `Oferta-{offerNumber}.pdf`.  
   - Podgląd przed pobraniem.

---

## 7. Backlog dokumentów generowanych ze zlecenia

Docelowy zestaw generatorów:

1. **Oferta PDF** (priorytet teraz)
2. **Oferta proposal**
3. **Magazyn załadunek**
4. **Brief techniczny**

Rekomendacja architektoniczna: wspólny moduł „Document Composer” (jedno źródło danych ze zlecenia + różne szablony wyjściowe), żeby uniknąć duplikacji logiki finansowej i harmonogramowej.
