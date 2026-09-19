import { useCallback, useRef, useState } from 'react';

/**
 * Wraps an async function with loading/error state, guarding against
 * setting state after the component unmounts (e.g. the user navigates away
 * mid-request).
 */
export function useAsyncCallback(fn) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const run = useCallback(
    async (...args) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fn(...args);
        return result;
      } catch (err) {
        if (mountedRef.current) setError(err);
        throw err;
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls identity of fn
    [fn],
  );

  return { run, loading, error, setError };
}
