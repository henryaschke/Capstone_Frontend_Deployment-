import axios from 'axios';
import type { Trade as TypesTrade } from '../types';

// Show API URL being used for debugging
const apiUrl = import.meta.env.VITE_API_URL || 'https://fastapi-service-920719150185.us-central1.run.app';
console.log('Using API URL:', apiUrl);

const BASE_URL = 'https://fastapi-service-920719150185.us-central1.run.app';

// Create an API instance with default config
export const api = axios.create({
  baseURL: apiUrl,
  timeout: 30000, // 30 seconds (increased from 10 seconds)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const user = getCurrentUser();
    if (user && user.access_token) {
      config.headers.Authorization = `Bearer ${user.access_token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ------ Basic Data Types ------

export interface PriceData {
  time: string;
  clearedHighPrice: number;
  clearedLowPrice: number;
  forecastedHighNordpool?: number;
  forecastedLowNordpool?: number;
  lumaraxHighForecast?: number;
  lumaraxLowForecast?: number;
}

export interface BatteryStatus {
  level: number;
  capacity: {
    total: number;
    usable: number;
  };
  lastUpdated?: string;
}

export interface BatteryHistoryItem {
  time: string;
  level: number;
  action?: 'charge' | 'discharge' | null;
  amount?: number;
}

export type Trade = TypesTrade;

export interface PerformanceMetric {
  totalRevenue: number;
  totalProfit: number;
  totalCosts: number;
  profitMargin: number;
  totalVolume: number;
  tradeCount: number;
  accuracy?: number;
  currentBalance?: number;
  chartData?: {
    date: string;
    profit: number;
    revenue: number;
  }[];
}

export interface MarketData {
  deliveryDay: string;
  deliveryPeriod: string;
  high: number;
  low: number;
  close: number;
  open?: number;
  volume?: number;
  transactionVolume: number;
  market: string;
  cleared: boolean;
}

// Authentication Types and Services
export interface RegisterRequest {
  email: string;
  password: string;
  user_role?: string;
}

export interface LoginRequest {
  username: string; // FastAPI OAuth2 expects 'username' even though we use email
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  email: string;
  user_role: string;
}

export interface UserProfile {
  user_id: number;
  email: string;
  user_role: string;
  created_at: string;
  updated_at?: string;
}

export interface Forecast {
  id: string;
  timestamp: string;
  period: string;
  predictedLow: number;
  predictedHigh: number;
  confidence: number;
  status: 'pending' | 'completed' | 'failed';
}

// ------ Basic API Functions ------

// Cache storage for price data
const priceDataCache: {
  data: any[] | null;
  timestamp: number;
  params: Record<string, any>;
  cacheTTL: number;
} = {
  data: null,
  timestamp: 0,
  params: {},
  cacheTTL: 5 * 60 * 1000 // 5 minutes in milliseconds
};

// Price Data
export const fetchPriceData = async (startDate?: string, endDate?: string) => {
  try {
    console.log(`Fetching price data from ${startDate} to ${endDate}`);
    
    // Prepare query parameters
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    
    // Check if we have cached data for the same parameters and if it's still fresh
    const now = Date.now();
    const paramsMatch = JSON.stringify(params) === JSON.stringify(priceDataCache.params);
    const cacheIsFresh = (now - priceDataCache.timestamp) < priceDataCache.cacheTTL;
    
    if (paramsMatch && cacheIsFresh && priceDataCache.data) {
      console.log('Returning cached price data (cache age:', 
        ((now - priceDataCache.timestamp) / 1000).toFixed(0), 'seconds)');
      return priceDataCache.data;
    }
    
    // Cache miss or expired, proceed with API request
    console.log('Cache miss or expired, fetching fresh data');
    
    // First try to get data from the API
    try {
      const response = await api.get('/api/market-data/realtime', { params });
      console.log('API response:', response.data);
      
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        const processedData = processApiResponse(response.data);
        
        // Update cache
        priceDataCache.data = processedData;
        priceDataCache.timestamp = now;
        priceDataCache.params = params;
        
        return processedData;
      }
    } catch (error) {
      console.error('Error fetching from primary endpoint:', error);
      // Continue to fallback
    }
    
    // Try alternative endpoint if first one fails
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const response = await api.get(`/api/market-data/realtime?date=${todayStr}`);
      
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        const processedData = processApiResponse(response.data);
        
        // Update cache
        priceDataCache.data = processedData;
        priceDataCache.timestamp = now;
        priceDataCache.params = params;
        
        return processedData;
      }
    } catch (error) {
      console.error('Error fetching from secondary endpoint:', error);
      // Continue to fallback
    }
    
    // If all API calls fail, return sample data
    console.log('Using sample data as fallback');
    return generateSamplePriceData();
  } catch (error) {
    console.error('Error in fetchPriceData:', error);
    return generateSamplePriceData();
  }
};

function processApiResponse(data: any) {
  console.log('Processing API response, raw data:', data);
  
  if (!Array.isArray(data)) {
    console.error('API response is not an array:', data);
    return generateSamplePriceData();
  }
  
  // Filter for 15-minute products
  const processedData = data.map(item => {
    try {
      // Extract time from different possible formats
      let timeStr = '';
      
      if (item.Delivery_Period) {
        // Format: "2025-03-10 15:00:00" or "15:00-15:15"
        const periodParts = item.Delivery_Period.split('-');
        if (periodParts.length > 1) {
          // It's a range like "15:00-15:15"
          timeStr = periodParts[0].trim();
        } else {
          // It's a datetime like "2025-03-10 15:00:00"
          timeStr = item.Delivery_Period.split(' ')[1] || item.Delivery_Period;
        }
      } else if (item.time) {
        timeStr = item.time;
      } else if (item.timestamp) {
        // If it's a full timestamp, extract the time part
        const date = new Date(item.timestamp);
        timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      } else {
        console.warn('No time field found in item:', item);
        return null;
      }
      
      // Normalize time format to HH:MM
      if (timeStr.includes(':')) {
        const timeParts = timeStr.split(':');
        if (timeParts.length >= 2) {
          timeStr = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
        }
      }
      
      // Map database fields to our model
      return {
        time: timeStr,
        clearedHighPrice: parseNumericValue(item.High_Price || item.high_price || item.clearedHighPrice),
        clearedLowPrice: parseNumericValue(item.Low_Price || item.low_price || item.clearedLowPrice),
        forecastedHighNordpool: parseNumericValue(item.Forecasted_High || item.forecasted_high || item.forecastedHighNordpool),
        forecastedLowNordpool: parseNumericValue(item.Forecasted_Low || item.forecasted_low || item.forecastedLowNordpool),
        lumaraxHighForecast: parseNumericValue(item.Lumarax_High_Forecast || item.lumarax_high_forecast || item.lumaraxHighForecast),
        lumaraxLowForecast: parseNumericValue(item.Lumarax_Low_Forecast || item.lumarax_low_forecast || item.lumaraxLowForecast),
        // Add metadata fields for debugging and filtering
        deliveryPeriod: item.Delivery_Period || item.delivery_period || '',
        market: item.Market || item.market || '',
        cleared: item.Cleared !== undefined ? item.Cleared : (item.cleared !== undefined ? item.cleared : null)
      };
    } catch (error) {
      console.error('Error processing data item:', item, error);
      return null;
    }
  }).filter(Boolean); // Remove null items
  
  console.log(`Processed ${processedData.length} data points from API response`);
  
  if (processedData.length === 0) {
    console.warn('No valid data points after processing, using sample data');
    return generateSamplePriceData();
  }
  
  return processedData;
}

function parseNumericValue(value: any): number | null {
  if (value === undefined || value === null) return null;
  
  if (typeof value === 'number') return value;
  
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  
  return null;
}

export function generateSamplePriceData(): any[] {
  console.warn('Server not reachable - no backup data provided');
  return []; // Return empty array instead of generating fake data
}

// Battery Status
export const fetchBatteryStatus = async () => {
  try {
    // No need to send user_id as it will be extracted from the auth token
    const response = await api.get('/api/battery/status');
    
    const data = response.data;
    console.log('Raw battery data from API:', data);
    
    // Ensure the correct battery level is returned
    // The API may return Current_Level or current_level
    // It may be a percentage (0-100) or an absolute value (0-total_capacity)
    let level = data.level;
    if (level === undefined) {
      level = data.Current_Level !== undefined ? data.Current_Level : data.current_level;
    }
    
    // Get total capacity
    const totalCapacity = data.Total_Capacity !== undefined ? 
      data.Total_Capacity : (data.total_capacity !== undefined ? 
        data.total_capacity : (data.capacity?.total || 2.5));
    
    // If level is an absolute value (not a percentage), convert to percentage
    if (level !== undefined && totalCapacity > 0 && level >= 0 && level <= totalCapacity) {
      // If level is small compared to capacity, it's likely an absolute value rather than percentage
      level = (level / totalCapacity) * 100;
      console.log(`Converting absolute level ${data.Current_Level || data.current_level} to percentage: ${level}%`);
    }
    
    return {
      level: level !== undefined ? level : 0,
      capacity: {
        total: totalCapacity,
        usable: data.Usable_Capacity !== undefined ? 
          data.Usable_Capacity : (data.usable_capacity !== undefined ? 
            data.usable_capacity : (data.capacity?.usable || 2.0))
      },
      charging_state: data.charging_state || data.Charging_State || 'idle',
      charging_rate: data.charging_rate || data.Charging_Rate || 0,
      last_updated: data.Last_Updated || data.last_updated || new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching battery status:', error);
    // Return a default battery status as fallback
    return {
      level: 0,
      capacity: {
        total: 2.5,
        usable: 2.0
      },
      charging_state: 'idle',
      charging_rate: 0,
      last_updated: new Date().toISOString()
    };
  }
};

export const fetchBatteryHistory = async (days: number = 7) => {
  try {
    // No need to include user_id as it will be extracted from the auth token
    const response = await api.get('/api/battery/history', { 
      params: { days } 
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching battery history:', error);
    // Return fallback data
    return Array.from({ length: 24 }, (_, i) => ({
      time: `${i}:00`,
      level: 50,
      action: null
    }));
  }
};

export const chargeBattery = async (amount: number) => {
  try {
    const response = await api.post('/api/battery/charge', { quantity: amount });
    return response.data;
  } catch (error) {
    console.error('Error charging battery:', error);
    throw error;
  }
};

export const dischargeBattery = async (amount: number) => {
  try {
    const response = await api.post('/api/battery/discharge', { quantity: amount });
    return response.data;
  } catch (error) {
    console.error('Error discharging battery:', error);
    throw error;
  }
};

// Trades
export const fetchTradeHistory = async (startDate?: string, endDate?: string, tradeType?: 'buy' | 'sell', status?: string) => {
  try {
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (tradeType) params.trade_type = tradeType;
    if (status) params.status = status;
    
    console.log(`Fetching trade history with params:`, params);
    
    // Increase timeout to 30 seconds for this specific API call
    const response = await api.get('/api/trades/history', { 
      params, 
      timeout: 30000 // 30 seconds timeout for trade history
    });
    
    console.log(`Received ${response.data?.length || 0} trades from API`);
    
    if (response.data && response.data.length > 0) {
      console.log('First trade:', response.data[0]);
    }
    
    // Map the API response to match our Trade interface
    const mappedTrades = response.data.map((trade: any, index: number) => {
      // Use the correct field names from BigQuery
      const price = trade.Trade_Price || 0;
      const quantity = trade.Quantity || 0;
      const tradeType = trade.Trade_Type?.toLowerCase() || 'buy';
      
      // Create a unique id by combining trade_id with index if trade_id is duplicated
      const tradeId = trade.Trade_ID?.toString() || Math.random().toString();
      
      return {
        id: `${tradeId}-${index}`,
        type: tradeType === 'sell' ? 'sell' : 'buy' as 'buy' | 'sell',
        price: price,
        quantity: quantity,
        timestamp: trade.Timestamp || new Date().toISOString(),
        executionTime: trade.Timestamp || new Date().toISOString(),
        resolution: `${trade.Resolution || 60}m`,
        deliveryPeriod: trade.Timestamp?.substring(11, 16) || "00:00",
        averagePrice: price,
        closePrice: price,
        volume: quantity,
        status: trade.Status || 'pending',
        market: trade.Market || 'nordpool',
        errorMessage: trade.Error_Message || null
      };
    });
    
    console.log(`Mapped ${mappedTrades.length} trades`);
    
    return mappedTrades;
  } catch (error) {
    console.error('Error fetching trade history:', error);
    return [];
  }
};

export interface TradeRequest {
  type: 'buy' | 'sell';
  quantity: number;
  executionTime?: string;
  resolution?: number;
  market?: string;
  trade_id?: number;
  user_id?: number;
  price?: number;
  timestamp?: string;
  error_message?: string;
}

export const executeTrade = async (tradeRequest: TradeRequest) => {
  try {
    // Map the request to match BigQuery table structure
    const mappedRequest = {
      Trade_Type: tradeRequest.type.toUpperCase(),
      Quantity: tradeRequest.quantity,
      Trade_Price: tradeRequest.price,
      Timestamp: tradeRequest.timestamp || new Date().toISOString(),
      Market: tradeRequest.market || 'nordpool',
      Resolution: tradeRequest.resolution || 60,
      Status: 'pending',
      Error_Message: tradeRequest.error_message || null
    };

    const response = await api.post('/api/trades/execute', mappedRequest);
    return response.data;
  } catch (error: any) {
    console.error('Error executing trade:', error);
    
    // Log more details about the error for debugging
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      console.error('Error response headers:', error.response.headers);
    } else if (error.request) {
      console.error('Error request:', error.request);
    }
    
    throw error;
  }
};

// Execute all pending trades
export const executeAllPendingTrades = async () => {
  try {
    const response = await api.post('/api/trades/execute-all-pending');
    return response.data;
  } catch (error: any) {
    console.error('Error executing pending trades:', error);
    
    // Log more details about the error for debugging
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      console.error('Error response headers:', error.response.headers);
    } else if (error.request) {
      console.error('Error request:', error.request);
    }
    
    throw error;
  }
};

// Cancel all pending trades
export const cancelAllPendingTrades = async () => {
  try {
    const response = await api.post('/api/trades/cancel-all-pending');
    return response.data;
  } catch (error: any) {
    console.error('Error cancelling pending trades:', error);
    
    // Log more details about the error for debugging
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      console.error('Error response headers:', error.response.headers);
    } else if (error.request) {
      console.error('Error request:', error.request);
    }
    
    throw error;
  }
};

// Performance Metrics
export const fetchPerformanceMetrics = async (startDate?: string, endDate?: string) => {
  try {
    console.log(`Fetching performance metrics from ${startDate} to ${endDate}`);
    
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    
    console.log('Performance metrics request params:', params);
    
    // Add timeout and retry logic
    const response = await api.get('/api/performance/metrics', { 
      params,
      timeout: 10000 // 10 second timeout
    });
    
    console.log('Performance metrics API response:', response.data);
    
    // Check if we have a valid response
    if (!response.data) {
      console.error('Empty response from performance metrics API');
      throw new Error('Empty response from API');
    }
    
    // Map the response to match our frontend expectations with default values for safety
    return {
      totalRevenue: response.data.totalRevenue || 0,
      totalProfit: response.data.totalProfit || 0,
      totalCosts: response.data.totalCosts || 0,
      totalVolume: response.data.totalVolume || 0,
      profitMargin: response.data.profitMargin || 0,
      tradeCount: response.data.trade_count || 0,
      accuracy: response.data.accuracy || 0,
      currentBalance: response.data.currentBalance || 0,
      chartData: Array.isArray(response.data.chartData) ? response.data.chartData : []
    };
  } catch (error: any) {
    console.error('Error fetching performance metrics:', error);
    
    // Log detailed error info for debugging
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      console.error('Error response headers:', error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Error request:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error message:', error.message);
    }
    
    // Return a safe fallback object
    return {
      totalRevenue: 0,
      totalProfit: 0,
      totalCosts: 0,
      totalVolume: 0,
      profitMargin: 0,
      tradeCount: 0,
      accuracy: 0,
      currentBalance: 0,
      chartData: []
    };
  }
};

// Market Data
export const fetchMarketData = async (
  startDate?: string,
  endDate?: string,
  minPrice?: number,
  maxPrice?: number,
  resolution: string = '1h'
) => {
  try {
    const params: any = { resolution };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (minPrice !== undefined) params.min_price = minPrice;
    if (maxPrice !== undefined) params.max_price = maxPrice;
    
    const response = await api.get('/api/market-data', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching market data:', error);
    return [];
  }
};

// Register a new user
export const register = async (data: RegisterRequest): Promise<{ message: string; user_id: number }> => {
  try {
    console.log('Attempting to register user:', data.email);
    
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('Registration failed:', responseData);
      throw new Error(responseData.detail || 'Registration failed');
    }
    
    console.log('Registration successful:', responseData);
    return responseData;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

// Login a user
export const login = async (data: LoginRequest): Promise<AuthResponse> => {
  try {
    console.log('Attempting to login user:', data.username);
    
    // Convert to form data as required by OAuth2
    const formData = new FormData();
    formData.append('username', data.username);
    formData.append('password', data.password);
    
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      body: formData,
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('Login failed:', responseData);
      throw new Error(responseData.detail || 'Login failed');
    }
    
    console.log('Login successful');
    
    // Store the token in localStorage
    if (responseData.access_token) {
      localStorage.setItem('user', JSON.stringify(responseData));
    }
    
    return responseData;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

// Logout a user
export const logout = (): void => {
  localStorage.removeItem('user');
};

/**
 * Refresh the user's access token
 * This recreates a token with a new expiration time
 * @returns A promise with the new token data
 */
export const refreshToken = async (): Promise<AuthResponse | null> => {
  try {
    const user = getCurrentUser();
    if (!user) return null;
    
    const response = await axios.post(`${BASE_URL}/api/auth/refresh`, {}, {
      headers: {
        Authorization: `Bearer ${user.access_token}`
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error refreshing token:', error);
    logout(); // If refresh fails, log the user out
    return null;
  }
};

// Get the current user from localStorage
export const getCurrentUser = (): AuthResponse | null => {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    return JSON.parse(userStr);
  }
  return null;
};

// Get the user's profile
export const getUserProfile = async (): Promise<UserProfile> => {
  try {
    const user = getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const response = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${user.access_token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch user profile');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Get user profile error:', error);
    throw error;
  }
};

// Add authorization header to requests
export const getAuthHeader = (): { Authorization: string } | {} => {
  const user = getCurrentUser();
  if (user && user.access_token) {
    return { Authorization: `Bearer ${user.access_token}` };
  }
  return {};
};

// Error handling interceptor
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    // If the error is 401 Unauthorized and we haven't tried to refresh the token yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        console.log('Attempting to refresh token for unauthorized request...');
        
        // Try to refresh the token
        const user = getCurrentUser();
        if (user) {
          console.log('User found in local storage, attempting token refresh');
          const result = await refreshToken();
          
          if (result && result.access_token) {
            console.log('Token refresh successful, updating stored token and retrying request');
            
            // Update the stored user with the new token
            localStorage.setItem('user', JSON.stringify(result));
            
            // Update the auth token in the API instance for all future requests
            api.defaults.headers.common['Authorization'] = `Bearer ${result.access_token}`;
            
            // Update the original request with the new token
            originalRequest.headers.Authorization = `Bearer ${result.access_token}`;
            
            // Retry the original request with the new token
            return api(originalRequest);
          } else {
            console.log('Token refresh failed, redirecting to login');
            logout();
            window.location.href = '/login?timeout=true';
            return Promise.reject(error);
          }
        }
      } catch (refreshError) {
        console.error('Token refresh error:', refreshError);
        logout();
        window.location.href = '/login?timeout=true';
        return Promise.reject(error);
      }
    }
    
    return Promise.reject(error);
  }
);

// Diagnostic function to test API connectivity
export const testApiConnection = async () => {
  try {
    console.log('Starting API connectivity test...');
    console.log('System Date:', new Date().toISOString());
    
    // First, try the dedicated status endpoint
    try {
      console.log('Testing connection to API status endpoint (/api/status)...');
      const statusResponse = await api.get('/api/status', { timeout: 10000 });
      console.log('API status response:', statusResponse.data);
      
      // Check for database configuration
      if (statusResponse.data?.config) {
        console.log('Database config:', statusResponse.data.config);
        
        // If database access failed, log the error
        if (statusResponse.data.config.database_access === 'Failed') {
          console.warn('Database access failed:', statusResponse.data.config.database_error);
        } else {
          console.log('Database access successful!');
        }
        
        // Print project and dataset info for verification
        console.log(`Using project: ${statusResponse.data.config.project_id}`);
        console.log(`Using dataset: ${statusResponse.data.config.dataset_id}`);
        console.log(`Using table: ${statusResponse.data.config.main_table}`);
      }
      
      // Now test the prices endpoint with today's date
      try {
        console.log('Testing data access with price data endpoint...');
        const todayStr = new Date().toISOString().split('T')[0];
        console.log('Using date:', todayStr);
        
        const dataTestResponse = await api.get('/api/market-data/realtime', { 
          params: { date: todayStr },
          timeout: 15000  // Increased timeout for BigQuery
        });
        
        console.log('Price data response status:', dataTestResponse.status);
        console.log('Price data response type:', typeof dataTestResponse.data);
        console.log('Price data length:', Array.isArray(dataTestResponse.data) ? dataTestResponse.data.length : 'not an array');
        
        if (Array.isArray(dataTestResponse.data) && dataTestResponse.data.length > 0) {
          console.log('Sample price data point:', dataTestResponse.data[0]);
        } else {
          console.warn('No price data returned from API, array is empty.');
        }
        
        return {
          success: true,
          message: 'Successfully connected to API and verified data access',
          endpoint: '/api/market-data/realtime',
          dataAvailable: Array.isArray(dataTestResponse.data) && dataTestResponse.data.length > 0,
          config: statusResponse.data?.config || 'Not available',
          sampleData: Array.isArray(dataTestResponse.data) && dataTestResponse.data.length > 0 ? 
                    dataTestResponse.data[0] : 'No data available'
        };
      } catch (priceError: any) {
        console.warn('Price data access failed:', priceError);
        
        // Try to get more diagnostic information using the diagnostic endpoint
        try {
          console.log('Testing BigQuery diagnostic endpoint...');
          const diagnosticResponse = await api.get('/api/diagnostic/query', { timeout: 10000 });
          console.log('Diagnostic response:', diagnosticResponse.data);
          
          return {
            success: true,
            message: 'Connected to API but price data failed, diagnostic data available',
            endpoint: '/api/status',
            priceError: priceError.message,
            diagnosticData: diagnosticResponse.data,
            config: statusResponse.data?.config || 'Not available'
          };
        } catch (diagError) {
          console.warn('Diagnostic query also failed:', diagError);
          return {
            success: true,
            message: 'Connected to API but data access failed',
            endpoint: '/api/status',
            priceError: priceError.message,
            config: statusResponse.data?.config || 'Not available'
          };
        }
      }
    } catch (statusError: any) {
      console.warn('Status endpoint test failed:', statusError);
      
      // Fall back to checking other endpoints
      // Check the server directly first
      try {
        console.log(`Testing direct connection to API server (${apiUrl})...`);
        const response = await fetch(apiUrl, { 
          method: 'GET',
          mode: 'cors',
          cache: 'no-cache',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        console.log('Direct connection response status:', response.status);
        console.log('Direct connection headers:', [...response.headers.entries()]);
        
        if (response.ok) {
          let responseText;
          try {
            responseText = await response.text();
            console.log('Direct connection response text:', responseText);
          } catch (e) {
            console.log('Could not read response text:', e);
          }
          
          console.log('Direct connection successful!');
          return {
            success: true,
            message: 'Successfully connected to API server directly',
            endpoint: apiUrl,
            status: response.status,
            responseText
          };
        }
      } catch (directError) {
        console.warn('Direct connection failed:', directError);
      }
      
      // Check other endpoints as fallbacks
      const endpoints = [
        { url: '/', description: 'API root' },
        { url: '/api/market-data/realtime', params: { date: new Date().toISOString().split('T')[0] }, description: 'Prices realtime endpoint' },
        { url: '/api/market-data', params: { date: new Date().toISOString().split('T')[0] }, description: 'Market data endpoint' }
      ];
      
      // Try each endpoint with a shorter timeout
      for (const endpoint of endpoints) {
        try {
          console.log(`Testing connection to ${endpoint.description} (${endpoint.url})...`);
          const response = await api.get(endpoint.url, { 
            params: endpoint.params,
            timeout: 5000
          });
          console.log(`Successfully connected to ${endpoint.description}:`, response.data);
          return { 
            success: true, 
            message: `Successfully connected to ${endpoint.description}`,
            endpoint: endpoint.url,
            data: response.data
          };
        } catch (err) {
          console.warn(`Failed to connect to ${endpoint.description}:`, err);
          // Continue to next endpoint
        }
      }
      
      // If we get here, most endpoints failed
      console.error('All API endpoints failed to respond');
      return { 
        success: false, 
        message: 'Failed to connect to any API endpoint',
        apiUrl,
        systemDate: new Date().toISOString(),
        endpoints: endpoints.map(e => e.url)
      };
    }
  } catch (error) {
    console.error('API connectivity test failed:', error);
    return { 
      success: false, 
      message: 'API connectivity test failed with an unexpected error',
      error: String(error)
    };
  }
};

/**
 * Generate forecasts by calling the forecast endpoint
 * @param userId The user ID to associate with the forecasts
 * @param saveToDatabase Whether to save the forecasts to the database
 * @returns A promise with the forecast generation result
 */
export const generateForecasts = async (userId: number = 1, saveToDatabase: boolean = true): Promise<{
  status: string;
  saved_to_database: boolean;
  forecasts: Record<string, any[]>;
}> => {
  try {
    const response = await api.get(`/api/forecast/generate?save_to_database=${saveToDatabase}&user_id=${userId}`, {
      timeout: 30000 // Keep increased timeout for BigQuery operations
    });
    return response.data;
  } catch (error) {
    console.error('Error generating forecasts:', error);
    throw error;
  }
};

/**
 * Fetch saved forecasts from the database
 * @param userId Optional user ID to filter forecasts
 * @param resolution Optional resolution (15, 30, 60) to filter forecasts
 * @param limit Maximum number of forecasts to return
 * @param activeOnly Whether to only return active forecasts
 * @returns A promise with the saved forecasts
 */
export interface SavedForecast {
  forecast_id: number;
  market: string;
  timestamp: string;
  max_value: number;
  min_value: number;
  avg_value: number;
  generated_at: string;
  model_info: string;
  resolution_minutes: number;
  accuracy: number | null;
  confidence_upper: number;
  confidence_lower: number;
  user_id: number;
  is_active: boolean;
  last_updated: string;
}

export const fetchSavedForecasts = async (options: {
  userId?: number;
  resolution?: number;
  limit?: number;
  activeOnly?: boolean;
  date?: string;
} = {}): Promise<{
  forecasts: SavedForecast[];
  count: number;
  status: string;
}> => {
  try {
    const params: Record<string, string | number | boolean> = {};
    
    if (options.userId !== undefined) params.user_id = options.userId;
    if (options.resolution !== undefined) params.resolution = options.resolution;
    if (options.limit !== undefined) params.limit = options.limit;
    if (options.activeOnly !== undefined) params.active_only = options.activeOnly;
    if (options.date !== undefined) params.date = options.date;
    
    const response = await api.get('/api/forecast/saved', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching saved forecasts:', error);
    return { forecasts: [], count: 0, status: 'error' };
  }
};

/**
 * Convert API forecasts to the frontend Forecast format
 * @param apiForecasts The forecasts from the API
 * @returns Formatted forecasts for the frontend
 */
export const formatForecasts = (apiForecasts: Record<string, any[]>): Forecast[] => {
  const formattedForecasts: Forecast[] = [];
  
  // Process each resolution's forecasts
  Object.entries(apiForecasts).forEach(([resolution, forecasts]) => {
    forecasts.forEach((forecast) => {
      formattedForecasts.push({
        id: `${resolution}-${forecast.Delivery_Period}`,
        timestamp: new Date().toISOString(), // Current time as generation time
        period: forecast.Delivery_Period,
        predictedLow: forecast.PredictedLow,
        predictedHigh: forecast.PredictedHigh,
        confidence: forecast.Confidence_Upper ? 
          ((forecast.Confidence_Upper - forecast.Confidence_Lower) / (forecast.PredictedHigh - forecast.PredictedLow) * 50) : 
          95, // Default confidence if not provided
        status: 'completed'
      });
    });
  });
  
  return formattedForecasts;
};

export default api; 