import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseScheduledFetchOptions {
  initialFetch?: boolean;
  interval?: number;
  enabled?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export function useScheduledFetch<T>(
  fetchFn: () => Promise<T>,
  options: UseScheduledFetchOptions = {}
) {
  const {
    initialFetch = true,
    interval = 60000, // Default to 1 minute
    enabled = true,
    maxRetries = 3,
    retryDelay = 5000,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(initialFetch);
  const [error, setError] = useState<Error | null>(null);
  const timerRef = useRef<number | null>(null);
  const isFetchingRef = useRef<boolean>(false);
  const retryCountRef = useRef<number>(0);
  const mountedRef = useRef<boolean>(true);

  // Clear the timeout when component unmounts
  const clearScheduledFetch = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const fetchData = useCallback(async (retryOnError = true) => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      console.log('Already fetching data, skipping this request');
      return;
    }

    // Set fetching flag to true
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const result = await fetchFn();
      
      // Only update state if the component is still mounted
      if (mountedRef.current) {
        setData(result);
        setLoading(false);
        // Reset retry count on success
        retryCountRef.current = 0;
      }
    } catch (err) {
      // Only update state if the component is still mounted
      if (mountedRef.current) {
        const error = err instanceof Error ? err : new Error('An unknown error occurred');
        setError(error);
        setLoading(false);
        
        // Implement retry logic
        if (retryOnError && retryCountRef.current < maxRetries) {
          console.log(`Fetch failed, retrying (${retryCountRef.current + 1}/${maxRetries}) in ${retryDelay}ms`);
          retryCountRef.current += 1;
          timerRef.current = window.setTimeout(() => {
            if (mountedRef.current) {
              fetchData(true);
            }
          }, retryDelay);
        } else if (retryCountRef.current >= maxRetries) {
          console.error('Max retries reached, giving up', error);
          retryCountRef.current = 0; // Reset for next time
        }
      }
    } finally {
      // Ensure we always reset the fetching flag
      isFetchingRef.current = false;
    }
  }, [fetchFn, maxRetries, retryDelay]);

  const scheduleNextFetch = useCallback(() => {
    // Only schedule if enabled and not already scheduled
    if (enabled && timerRef.current === null && mountedRef.current) {
      console.log(`Scheduling next fetch in ${interval}ms`);
      timerRef.current = window.setTimeout(() => {
        if (mountedRef.current) {
          timerRef.current = null; // Clear the ref before fetching
          fetchData();
        }
      }, interval);
    }
  }, [enabled, interval, fetchData]);

  // Trigger refetch manually
  const refetch = useCallback(() => {
    clearScheduledFetch();
    fetchData();
    // We'll schedule the next fetch after this one completes
  }, [clearScheduledFetch, fetchData]);

  useEffect(() => {
    // Set mounted flag for cleanup
    mountedRef.current = true;
    
    // Initial fetch if needed
    if (initialFetch && enabled) {
      fetchData();
    }
    
    return () => {
      // Set mounted flag to false to prevent state updates
      mountedRef.current = false;
      // Clear any scheduled fetches
      clearScheduledFetch();
    };
  }, [fetchData, initialFetch, enabled, clearScheduledFetch]);

  // Schedule next fetch whenever fetch completes or enabled/interval changes
  useEffect(() => {
    // Schedule next fetch only if we're not loading (i.e., previous fetch completed)
    if (!loading && enabled && !error) {
      scheduleNextFetch();
    }
    
    return () => {
      clearScheduledFetch();
    };
  }, [loading, enabled, interval, error, scheduleNextFetch, clearScheduledFetch]);

  return { data, loading, error, refetch };
}