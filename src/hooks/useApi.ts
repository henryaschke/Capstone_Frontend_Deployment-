import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  fetchPriceData, 
  fetchBatteryStatus,
  fetchBatteryHistory,
  fetchTradeHistory, 
  fetchPerformanceMetrics,
  fetchMarketData,
  chargeBattery,
  dischargeBattery,
  executeTrade,
  PriceData,
  BatteryStatus,
  BatteryHistoryItem,
  Trade,
  PerformanceMetric,
  MarketData
} from '../services/api';

// Simple hook for data fetching with loading/error states
const useDataFetching = <T,>(fetchFunction: (...args: any[]) => Promise<T>, ...args: any[]) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchFunction(...args);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An unknown error occurred'));
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchFunction, ...args]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};

// Throttle function to prevent too many API calls
const throttle = (func: Function, delay: number) => {
  let lastCall = 0;
  return (...args: any[]) => {
    const now = new Date().getTime();
    if (now - lastCall < delay) {
      return;
    }
    lastCall = now;
    return func(...args);
  };
};

// Basic hook for data fetching with loading and error states
export const usePriceData = (startDate: string, endDate: string) => {
  const [data, setData] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const fetchingRef = useRef<boolean>(false);
  const queuedFetchRef = useRef<boolean>(false);

  // Keep track of the last successful parameters
  const lastParamsRef = useRef({ startDate, endDate });

  const fetchData = useCallback(async () => {
    // If already fetching, queue another fetch
    if (fetchingRef.current) {
      console.log('Already fetching price data, request queued');
      queuedFetchRef.current = true;
      return;
    }

    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      console.log(`Fetching price data from ${startDate} to ${endDate}`);
      
      const result = await fetchPriceData(startDate, endDate);
      
      if (Array.isArray(result) && result.length > 0) {
        console.log(`Fetched ${result.length} price data points`);
        setData(result);
        // Update last successful parameters
        lastParamsRef.current = { startDate, endDate };
      } else {
        console.warn('Received empty or invalid price data array');
        setError(new Error('No price data available for the selected date range'));
      }
    } catch (err) {
      console.error('Error fetching price data:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch price data'));
    } finally {
      setLoading(false);
      fetchingRef.current = false;
      
      // If another fetch was queued while this one was running, execute it
      if (queuedFetchRef.current) {
        queuedFetchRef.current = false;
        setTimeout(() => fetchData(), 100);
      }
    }
  }, [startDate, endDate]);

  // Throttled refetch function to prevent too many API calls
  const refetch = useCallback(
    throttle(() => {
      fetchData();
    }, 300000),
    [fetchData]
  );

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
};

export const useBatteryStatus = () => {
  return useDataFetching<BatteryStatus>(fetchBatteryStatus);
};

export const useBatteryHistory = (days: number = 7) => {
  return useDataFetching<BatteryHistoryItem[]>(fetchBatteryHistory, days);
};

export const useTradeHistory = (startDate?: string, endDate?: string, tradeType?: 'buy' | 'sell', status?: string) => {
  // Use the correct Trade type from types.ts
  const { data, loading, error, refetch } = useDataFetching<Trade[]>(
    fetchTradeHistory, startDate, endDate, tradeType, status
  );
  
  // Add a function to refetch without date constraints
  const refetchAll = useCallback(() => {
    return fetchTradeHistory(undefined, undefined, tradeType, status);
  }, [tradeType, status]);
  
  return { 
    data, 
    loading, 
    error, 
    refetch,
    refetchAll  // Add the new function to the returned object
  };
};

export const usePerformanceMetrics = (startDate?: string, endDate?: string) => {
  return useDataFetching<PerformanceMetric>(fetchPerformanceMetrics, startDate, endDate);
};

export const useMarketData = (
  startDate?: string, 
  endDate?: string, 
  minPrice?: number, 
  maxPrice?: number,
  resolution: string = '1h'
) => {
  return useDataFetching<MarketData[]>(
    fetchMarketData, 
    startDate, 
    endDate, 
    minPrice,
    maxPrice,
    resolution
  );
};

// Hooks for actions that modify data
export const useBatteryActions = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<any>(null);

  const charge = async (amount: number) => {
    try {
      setLoading(true);
      setError(null);
      const result = await chargeBattery(amount);
      setResult(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An unknown error occurred'));
      console.error('Error charging battery:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const discharge = async (amount: number) => {
    try {
      setLoading(true);
      setError(null);
      const result = await dischargeBattery(amount);
      setResult(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An unknown error occurred'));
      console.error('Error discharging battery:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { charge, discharge, loading, error, result };
};

export const useTradeActions = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<any>(null);

  const executeBuyTrade = async (quantity: number, price: number) => {
    try {
      setLoading(true);
      setError(null);
      const result = await executeTrade({
        type: 'buy',
        quantity,
        price,
        timestamp: new Date().toISOString() // Use timestamp instead of executionTime
      });
      setResult(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An unknown error occurred'));
      console.error('Error executing buy trade:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const executeSellTrade = async (quantity: number, price: number) => {
    try {
      setLoading(true);
      setError(null);
      const result = await executeTrade({
        type: 'sell',
        quantity,
        price,
        timestamp: new Date().toISOString() // Use timestamp instead of executionTime
      });
      setResult(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An unknown error occurred'));
      console.error('Error executing sell trade:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { executeBuyTrade, executeSellTrade, loading, error, result };
};

export const useScheduledFetch = <T>(
  fetchFunction: () => Promise<T>,
  initialInterval: number = 60000
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [interval, setInterval] = useState<number>(initialInterval);
  const intervalRef = useRef<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFunction();
      setData(result);
    } catch (err) {
      console.error('Error in scheduled fetch:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
    } finally {
      setLoading(false);
    }
  }, [fetchFunction]);

  const startFetching = useCallback(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // Immediately fetch once
    fetchData();
    
    // Then set up the interval
    intervalRef.current = window.setInterval(fetchData, interval);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData, interval]);

  useEffect(() => {
    return startFetching();
  }, [startFetching]);

  const updateInterval = useCallback((newInterval: number) => {
    setInterval(newInterval);
  }, []);

  const manualFetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, updateInterval, manualFetch };
}; 