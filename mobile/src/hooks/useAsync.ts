import { useEffect, useState } from "react";

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const run = () => {
    setLoading(true);
    fn()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(run, deps);
  return { data, error, loading, reload: run };
}
