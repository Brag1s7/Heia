import React, {createContext, useContext, useMemo, useRef} from 'react';

interface CalendarFocusValue {
  /**
   * `dayKey`-en brukeren står på i Kalender, eller null når Kalender ikke er
   * flaten man er på. Leses PÅ TRYKK, ikke under render.
   */
  read: () => string | null;
  set: (dayKey: string | null) => void;
}

const CalendarFocusContext = createContext<CalendarFocusValue | null>(null);

/**
 * Broen mellom Kalender-fanen og den globale «+»-knappen.
 *
 * «+» bor i `MainTabs` og vet ingenting om hvilken dato brukeren ser på.
 * Kalender vet det, men er et barnebarn av navigatoren — den kan ikke sende
 * noe oppover uten en kanal.
 *
 * ⚠️ Verdien ligger i en REF, ikke i state, og contextverdien er stabil.
 * Valgt dato endres mens brukeren scroller; lå den i state, ville hele
 * fanetreet — alle fem stackene — rendret på nytt for hver dagsseksjon som
 * passerte toppen av skjermen. «+» trenger dessuten ikke verdien løpende,
 * bare i det øyeblikket arket åpnes.
 */
export function CalendarFocusProvider({children}: {children: React.ReactNode}) {
  const dayKeyRef = useRef<string | null>(null);

  const value = useMemo<CalendarFocusValue>(
    () => ({
      read: () => dayKeyRef.current,
      set: next => {
        dayKeyRef.current = next;
      },
    }),
    [],
  );

  return (
    <CalendarFocusContext.Provider value={value}>
      {children}
    </CalendarFocusContext.Provider>
  );
}

export function useCalendarFocus(): CalendarFocusValue {
  const value = useContext(CalendarFocusContext);
  if (!value) {
    throw new Error('useCalendarFocus må ligge inne i CalendarFocusProvider');
  }
  return value;
}
