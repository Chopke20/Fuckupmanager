const DATE_INPUT_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Sprawdza, czy string to pełna data YYYY-MM-DD w sensownym zakresie (1970–2100).
 */
export function isValidDateInput(dateString: string): boolean {
  if (!dateString || !DATE_INPUT_REGEX.test(dateString)) return false;
  const parts = dateString.split('-').map(Number);
  if (parts.length !== 3) return false;
  const [y, m, d] = parts as [number, number, number];
  if (y < 1970 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/**
 * Konwertuje datę z formatu inputa (YYYY-MM-DD) do ISO datetime.
 * Zwraca null, gdy wartość niepełna lub nieprawidłowa – wtedy NIE nadpisuj stanu formularza.
 * Używamy północy czasu lokalnego, żeby uniknąć przesunięcia dnia przy wyświetlaniu.
 */
export function dateInputToISO(dateString: string): string | null {
  if (!dateString || !isValidDateInput(dateString)) return null;
  const [y, m, d] = dateString.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d, 0, 0, 0, 0);
  return date.toISOString();
}

/**
 * Konwertuje datę z formatu ISO do YYYY-MM-DD dla input type="date".
 * Używa składowych w czasie lokalnym, żeby dzień się nie przesuwał.
 */
export function isoToDateInput(isoString: string | undefined | null): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

/**
 * Porównuje daty tylko wg dnia (bez godziny). Zwraca true, gdy dzień zakończenia jest wcześniejszy niż dzień rozpoczęcia.
 * Ten sam dzień = false (poprawne).
 */
export function isEndDateBeforeStartDate(start: string | Date, end: string | Date): boolean {
  const s = typeof start === 'string' ? new Date(start) : start;
  const e = typeof end === 'string' ? new Date(end) : end;
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return false;
  const startDay = new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime();
  const endDay = new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime();
  return endDay < startDay;
}

/**
 * Liczba dni kalendarzowych między początkiem a końcem (włącznie z oboma dniami).
 * Liczy wg **dnia kalendarzowego** (północ–północ lokalnie), nie po surowej różnicy ISO z godzinami —
 * tak samo jak zakres dat zlecenia i transportu.
 */
export function daysBetween(dateFrom: string | Date, dateTo: string | Date): number {
  const from = typeof dateFrom === 'string' ? new Date(dateFrom) : dateFrom;
  const to = typeof dateTo === 'string' ? new Date(dateTo) : dateTo;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 1;
  const startDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const endDay = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  if (endDay < startDay) return 1;
  const diffDays = Math.floor((endDay.getTime() - startDay.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(1, diffDays + 1);
}

/**
 * Konwertuje datę i czas z inputów do ISO datetime
 * 
 * @param dateString - Data w formacie YYYY-MM-DD
 * @param timeString - Czas w formacie HH:mm (opcjonalny)
 * @returns Data w formacie ISO datetime
 */
export function dateTimeInputToISO(dateString: string, timeString?: string): string {
  if (!dateString) return new Date().toISOString();
  
  const time = timeString || '00:00';
  const dateTimeString = `${dateString}T${time}:00`;
  const date = new Date(dateTimeString);
  return date.toISOString();
}
