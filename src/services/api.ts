import axios from 'axios';

// Show API URL being used for debugging
const apiUrl = import.meta.env.VITE_API_URL || 'https://fastapi-service-920719150185.us-central1.run.app';
console.log('Using API URL:', apiUrl);

// Create an API instance with default config
const api = axios.create({
  baseURL: apiUrl,
  timeout: 10000, // 10 seconds
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

export interface Trade {
  id?: number;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: string;
  profit_loss?: number;
  status?: 'pending' | 'completed' | 'cancelled';
}

export interface PerformanceMetric {
  totalProfit: number;
  totalRevenue: number;
  profitMargin: number;
  accuracy: number;
  totalVolume?: number;
  totalCosts?: number;
  chartData?: {
    date: string;
    revenue: number;
    profit: number;
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

// Price Data
export const fetchPriceData = async (startDate?: string, endDate?: string) => {
  try {
    console.log(`Fetching price data from ${startDate} to ${endDate}`);
    
    // Prepare query parameters
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    
    // First try to get data from the API
    try {
      const response = await api.get('/api/prices/realtime', { params });
      console.log('API response:', response.data);
      
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        return processApiResponse(response.data);
      }
    } catch (error) {
      console.error('Error fetching from primary endpoint:', error);
      // Continue to fallback
    }
    
    // Try alternative endpoint if first one fails
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const response = await api.get(`/api/prices/realtime?date=${todayStr}`);
      
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        return processApiResponse(response.data);
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
  const data = [];
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // Generate data for every 15 minutes (96 points for a day)
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      // Determine if this point is historical based on current time
      const isHistorical = (hour < currentHour) || (hour === currentHour && minute <= currentMinute);
      
      // Create a time string in HH:MM format
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      // Base price varies by time of day
      let basePrice = 100;
      
      // Morning peak (7-9 AM)
      if (hour >= 7 && hour <= 9) {
        basePrice = 150;
      }
      // Evening peak (5-8 PM)
      else if (hour >= 17 && hour <= 20) {
        basePrice = 180;
      }
      // Night low (11 PM - 5 AM)
      else if (hour >= 23 || hour <= 5) {
        basePrice = 70;
      }
      
      // Add some randomness
      const randomFactor = Math.random() * 30 - 15; // -15 to +15
      basePrice += randomFactor;
      
      // Create data point
      data.push({
        time: timeStr,
        clearedHighPrice: isHistorical ? basePrice + 10 : null,
        clearedLowPrice: isHistorical ? basePrice - 10 : null,
        forecastedHighNordpool: !isHistorical ? basePrice + 15 : null,
        forecastedLowNordpool: !isHistorical ? basePrice - 15 : null,
        lumaraxHighForecast: !isHistorical ? basePrice + 20 : null,
        lumaraxLowForecast: !isHistorical ? basePrice - 20 : null,
        deliveryPeriod: `${timeStr}-${(hour + (minute + 15 >= 60 ? 1 : 0)).toString().padStart(2, '0')}:${((minute + 15) % 60).toString().padStart(2, '0')}`,
        market: 'Germany',
        cleared: isHistorical
      });
    }
  }
  
  return data;
}

// Battery Status - use with fallback
export const fetchBatteryStatus = async () => {
  try {
    const response = await api.get('/api/battery/status');
    return response.data;
  } catch (error) {
    console.error('Error fetching battery status:', error);
    // Return fallback data
    return {
      level: 50,
      capacity: {
        total: 2.5,
        usable: 2.0
      },
      lastUpdated: new Date().toISOString()
    };
  }
};

export const fetchBatteryHistory = async (days: number = 7) => {
  try {
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
export const fetchTradeHistory = async (startDate?: string, endDate?: string, tradeType?: 'buy' | 'sell') => {
  try {
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (tradeType) params.type = tradeType;
    
    const response = await api.get('/api/trades/history', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching trade history:', error);
    return [];
  }
};

export const executeTrade = async (tradeRequest: Omit<Trade, 'id' | 'timestamp' | 'profit_loss'>) => {
  try {
    const response = await api.post('/api/trades/execute', tradeRequest);
    return response.data;
  } catch (error) {
    console.error('Error executing trade:', error);
    throw error;
  }
};

// Performance Metrics
export const fetchPerformanceMetrics = async (startDate?: string, endDate?: string) => {
  try {
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    
    const response = await api.get('/api/performance/metrics', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    return {
      totalProfit: 0,
      totalRevenue: 0,
      profitMargin: 0,
      accuracy: 0
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
    
    const response = await fetch('https://fastapi-service-920719150185.us-central1.run.app/api/auth/register', {
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
    
    const response = await fetch('https://fastapi-service-920719150185.us-central1.run.app/api/auth/login', {
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
    
    const response = await axios.post(`${apiUrl}/api/auth/refresh`, {}, {
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
    
    const response = await fetch('https://fastapi-service-920719150185.us-central1.run.app/api/auth/me', {
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
            
            // Update the original request with the new token
            originalRequest.headers.Authorization = `Bearer ${result.access_token}`;
            
            // Retry the original request with the new token
            return api(originalRequest);
          } else {
            console.log('Token refresh failed, redirecting to login');
            logout();
            window.location.href = '/login';
            return Promise.reject(error);
          }
        } else {
          console.log('No user found in local storage, cannot refresh token');
          
          // For GET requests, try to proceed without authentication
          if (originalRequest.method?.toUpperCase() === 'GET') {
            console.log('Retrying GET request without authentication');
            delete originalRequest.headers.Authorization;
            return api(originalRequest);
          }
          
          logout();
          window.location.href = '/login';
          return Promise.reject(error);
        }
      } catch (refreshError) {
        console.error('Error during token refresh:', refreshError);
        
        // If we can't refresh the token, redirect to login
        logout();
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }
    
    // Public endpoints should proceed without auth
    if (error.response?.status === 401 && 
        (originalRequest.url.includes('/api/status') || 
         originalRequest.url.includes('/api/auth/login'))) {
      console.log('Retrying public endpoint without authentication');
      delete originalRequest.headers.Authorization;
      return api(originalRequest);
    }
    
    console.error('API Error:', error);
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
        
        const dataTestResponse = await api.get('/api/prices/realtime', { 
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
          endpoint: '/api/prices/realtime',
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
        { url: '/api/prices/realtime', params: { date: new Date().toISOString().split('T')[0] }, description: 'Prices realtime endpoint' },
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
    const response = await api.get(`/api/forecast/test?save_to_database=${saveToDatabase}&user_id=${userId}`);
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