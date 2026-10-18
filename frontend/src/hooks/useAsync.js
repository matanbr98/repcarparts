import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Run an async loader on mount and whenever `deps` change.
 * Returns { data, error, loading, reload, setData }.
 */
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const loaderRef = useRef(loader);
  const seq = useRef(0);

  useEffect(() => {
    loaderRef.current = loader;
  });

  const run = useCallback(() => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve()
      .then(() => loaderRef.current())
      .then(
        (data) => {
          if (id === seq.current) setState({ data, error: null, loading: false });
        },
        (error) => {
          if (id === seq.current) setState((s) => ({ data: s.data, error, loading: false }));
        }
      );
  }, []);

  useEffect(() => {
    run();
    const current = seq;
    return () => {
      current.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === "function" ? updater(s.data) : updater }));
  }, []);

  return { ...state, reload: run, setData };
}
