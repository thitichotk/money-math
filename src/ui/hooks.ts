import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/** A calculator's inputs live in the URL: a link reproduces the calculation, a reload keeps it,
 *  and nothing is stored anywhere else. Values that equal the default are left out of the URL. */
export function useQueryState<T extends Record<string, string>>(defaults: T) {
  const [params, setParams] = useSearchParams();
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const state = useMemo(() => {
    const next = { ...defaults };
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      const value = params.get(key as string);
      if (value != null) next[key] = value as T[keyof T];
    }
    return next;
  }, [params, defaults]);

  const update = useCallback(
    (patch: Partial<T>) =>
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [key, value] of Object.entries(patch) as [string, string | undefined][]) {
            if (value == null || value === defaultsRef.current[key]) next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  return [state, update] as const;
}

/** The last result that was valid, so a half-typed number dims the answer instead of blanking it. */
export function useLastGood<T>(value: T | null): T | null {
  const last = useRef(value);
  if (value != null) last.current = value;
  return last.current;
}

export function useTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Money-Math`;
  }, [title]);
}
