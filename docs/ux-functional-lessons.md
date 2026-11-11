# Wnioski funkcjonalne z redesignu (Scena / LED / zlecenie)

Źródło: redesign okna „Scena z podestów” (2026-11) + równoległe poprawki LED i listy scen/LED w zleceniu.  
Cel dokumentu: przy budowie **nowych logik i okien kreatorów** nie powtarzać tych samych błędów strukturalnych.

---

## 1. Wynik pracy ≠ rysunek

Kreator (rzut, mapa LED, konfigurator) jest narzędziem pomocniczym.  
**Produktem jest lista pozycji w zleceniu / ofercie** (i poprawne ilości), nie sam widok.

Konsekwencje:
- Rozpiska / podgląd „co trafi do zlecenia” są **pierwszorzędne** — nie chować w szufladzie, zakładce „zaawansowane” ani po długim scrollu.
- Akcja zapisu do zlecenia musi być **zawsze widoczna** (sticky), z podglądem wyniku **nad** przyciskiem.
- Etykieta przycisku musi opisywać **faktyczny wynik** mapowania („Dodaj do zlecenia: 12 podestów”), nie życzeniowy („…i obicie”), gdy obicie jest „tylko plan”.

Przy projektowaniu nowej logiki najpierw zdefiniuj: *co dokładnie ląduje w zleceniu*, potem UI wokół tego.

---

## 2. Lewa = projektowanie, prawa = decyzje i overview

Sprawdzony podział 2-kolumnowy (nie 3 panele):

| Lewa | Prawa |
|------|--------|
| Rzut / scena / canvas | Podsumowanie (kompaktowe) |
| Narzędzia edycji | Opcje / konfiguracja |
| Kontekstowa podpowiedź | Rozpiska + mapowanie |
| | Sticky: „Po zastosowaniu” + CTA |

Trzeci panel (biblioteka | canvas | właściwości) zabiera miejsce rzutowi — w Lama rzut i tak jest ciasny; **nie powielać**.

Zakładki po prawej (`Konfiguracja` / `Rozpiska`) są OK, o ile rozpiska zostaje pełnoprawna i sticky CTA jest wspólne dla obu.

---

## 3. Jeden model edycji, nie dwa sprzeczne

Jeśli tę samą rzecz da się ustawić w panelu **i** narzędziem na rzucie (obicie, barierki, wysokość):
- panel = **Cała scena** (domyślne) + **Zaznaczenie** (po selekcji),
- rzut = precyzja / krawędzie / pojedyncze elementy,
- skróty „cały front / bok” zostają, ale nie konkurują wizualnie z narzędziami.

Nowa logika: najpierw ustal *źródło prawdy* (plan JSON), potem jedną hierarchię UI wokół niego.

---

## 4. Statusy mówią językiem skutku, nie procedury

Złe: „pominięte (tylko plan)” — brzmi jak błąd.  
Dobre statusy skutku:

- **✓ w zleceniu** (+ nazwa pozycji katalogu)
- **wliczone w podest** (attach / składnik innej pozycji)
- **tylko plan** (świadomie poza ofertą)
- **brak mapowania** (to jest ostrzeżenie / blokada)

Mapowanie ról → sprzęt jest **konfiguracją firmy**, nie ukrytą zębatką. Przy braku mapowania oferty: ostrzeżenie przy CTA i w rozpisce.

---

## 5. Forma kontrolki = znaczenie (kolor sam nie wystarczy)

Ten sam zielony akcent nie może oznaczać jednocześnie:
- aktywnego narzędzia,
- wybranej opcji (radio),
- włączonego przełącznika (chip).

Wzorce:
- **Segmented control** — wybór 1 z N (wysokość, materiał)
- **Chipy z ✓** — multi toggle (krawędzie)
- **Tool buttons** — tryb edycji na canvasie
- Nieaktywne opcje (np. kierunki obicia przy „Bez obicia”) — **wyszarzanie**, nie tylko brak reakcji

---

## 6. Hierarchia informacji: mniej kafli, więcej linii

Cztery duże kafle „Gabaryt / Powierzchnia / …” zjadają prawą kolumnę.  
Podsumowanie metryczne: **jedna kompaktowa linia** u góry.

Etykieta sekcji przyciemniona, **wartość wyróżniona** po prawej  
(`Obicie · 20 mb · 12 m²`).

Notatki obliczeniowe: nie lista powtórzeń z podsumowania.  
Tylko **warunkowe ostrzeżenia** (np. klamry > 60 cm) + zwijane „Założenia obliczeń”.

---

## 7. Canvas: szum etykiet vs sygnał

12× „2×1” to szum.  
Etykiety na elementach:
- zawsze gdy **odstają od domyślnej** (np. wysokość `40 cm` pod wymiarem),
- albo na hover / zaznaczeniu,
- wymiary gabarytu na krawędziach rzutu.

Rzut ma **rosnąć w dostępną wysokość**; puste pasy pod canvasem = strata.

---

## 8. Jedna podpowiedź kontekstowa

Nie trzy miejsca z tym samym helpem.  
Jeden pasek pod canvasem zależny od narzędzia; pełne skróty pod „?”.

Destrukcja (Wyczyść, Usuń) — oddzielona, z **inline confirm** w wierszu/pasie, nie `window.confirm` / `prompt` / `alert`.

---

## 9. Stan zapisu jest częścią produktu

Okno kreatora w zleceniu:
- wskaźnik **Zapisano / Niezapisane zmiany**,
- zamknięcie z dirty → confirm w UI aplikacji,
- apply resetuje dirty względem „wrzucone do zlecenia” (nie mylić z zapisem całego zlecenia do API).

---

## 10. Checklist przy nowej logice / nowym kreatorze

1. Co jest **wynikiem w zleceniu**? (pozycje, ilości, markery opisu)
2. Gdzie w UI widać ten wynik **bez scrolla**?
3. Czy etykieta CTA jest **uczciwa** względem mapowania?
4. Lewa = edycja wizualna, prawa = opcje + rozpiska + sticky CTA?
5. Czy statusy mówią skutkiem, nie żargonem wewnętrznym?
6. Czy radio / chip / tool mają **różną formę**?
7. Czy destrukcja i rename są **inline**, bez systemowych okien?
8. Czy ostrzeżenia są warunkowe, a nie ścianą powtórzeń?
9. Multi-firma: mapowanie / katalog / apply zawsze w kontekście **bieżącej firmy**.

---

## Powiązane

- Reguła: `.cursor/rules/no-system-dialogs.mdc`
- Reguła skrótowa: `.cursor/rules/lama-ux-functional.mdc`
- Implementacja odniesienia: `StagePlatformVisualizer`, `StageBomCatalogTable`, `OrderPlanProjectsPanel`
