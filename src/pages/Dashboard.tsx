import React, { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, LineChart, History, Battery, Calendar, Download, HelpCircle, Book, Lightbulb, AlertCircle, Zap, Clock, Globe, Sparkles, Search, CalendarDays, Wifi, WifiOff, Info } from 'lucide-react';
import { TabContent } from '../components/TabContent';
import { usePriceData, useTradeHistory } from '../hooks/useApi';
import { getPastDate, getFutureDate } from '../utils/dateUtils';
import { testApiConnection, generateSamplePriceData, fetchPriceData, fetchBatteryStatus, api } from '../services/api';
import type { Tab, BatteryState, PriceData, Trade, DateRange, MarketData, Forecast } from '../types';
import { useNavigate } from 'react-router-dom';
import { TabList, TabPanel, TabPanels, Tabs } from '@chakra-ui/react';
import { Box, Flex, VStack, Heading, Text } from '@chakra-ui/react';
import { useAuth } from '../context/AuthContext';

const BASE_URL = 'https://fastapi-service-920719150185.us-central1.run.app';

interface NavButtonProps {
  tab: Tab;
  icon: React.ElementType;
  label: string;
  activeTab: Tab;
  onClick: (tab: Tab) => void;
}

const NavButton: React.FC<NavButtonProps> = ({ tab, icon: Icon, label, activeTab, onClick }) => (
  <button
    onClick={() => onClick(tab)}
    className={`flex items-center px-6 py-3 rounded-lg transition-all duration-300 ${
      activeTab === tab
        ? 'active-nav-item text-white shadow-lg transform scale-105'
        : 'text-gray-300 hover:bg-primary-700/30'
    }`}
  >
    <Icon className="w-5 h-5 mr-2" />
    <span className="font-medium">{label}</span>
  </button>
);

function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard1');
  const [batteryState, setBatteryState] = useState<BatteryState>({
    level: 50,
    history: Array.from({ length: 24 }, (_, i) => ({
      time: `${i}:00`,
      level: 50
    })),
    capacity: {
      total: 2.5,
      usable: 2.0,
      percentage: 80
    }
  });

  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [timeoutCount, setTimeoutCount] = useState(0);

  // Update dateRange logic to work in 2025
  const currentDate = new Date();
  const sevenDaysAgo = new Date(currentDate);
  sevenDaysAgo.setDate(currentDate.getDate() - 7);
  
  const [dateRange, setDateRange] = useState<DateRange>({
    start: currentDate.toISOString().split('T')[0], // Today - focus on today for 15-min data
    end: currentDate.toISOString().split('T')[0] // Today
  });

  // Debug date information
  useEffect(() => {
    console.log('Current system date:', currentDate.toISOString());
    console.log('Using date range:', dateRange);
  }, []);

  const [priceData, setPriceData] = useState<PriceData[]>([]);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState<Error | null>(null);

  const [trades, setTrades] = useState<Trade[]>([]);
  const [priceFilter, setPriceFilter] = useState({ min: '', max: '' });
  const [selectedTimeWindow, setSelectedTimeWindow] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '12:00',
    duration: '30'
  });
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [batteryActionLoading, setBatteryActionLoading] = useState(false);

  // Add trade history state using the hook
  const { data: tradeHistoryData, loading: tradeHistoryLoading, error: tradeHistoryError, refetch: refetchTradeHistory } = 
    useTradeHistory(dateRange.start, dateRange.end);

  // Update trades state when tradeHistoryData changes
  useEffect(() => {
    console.log('Trade history data updated:', tradeHistoryData);
    if (tradeHistoryData && tradeHistoryData.length > 0) {
      console.log(`Setting ${tradeHistoryData.length} trades in state`);
      // Convert API Trade type to the frontend Trade type if needed
      setTrades(tradeHistoryData as unknown as Trade[]);
    }
  }, [tradeHistoryData]);

  // Refetch trade history when activeTab changes to dashboard2
  useEffect(() => {
    if (activeTab === 'dashboard2') {
      console.log('Dashboard2 tab active, refetching trade history');
      refetchTradeHistory();
    }
  }, [activeTab, refetchTradeHistory]);

  // Also refetch when dateRange changes while on dashboard2
  useEffect(() => {
    if (activeTab === 'dashboard2') {
      console.log('Date range changed, refetching trade history');
      refetchTradeHistory();
    }
  }, [dateRange, activeTab, refetchTradeHistory]);

  // Define fetchData function at component level so it can be used anywhere
  const fetchData = async () => {
    try {
      console.log('Fetching price data...');
      setPriceLoading(true);
      setPriceError(null);
      
      const today = new Date().toISOString().split('T')[0];
      
      // Use api instance instead of direct fetch() call
      const response = await api.get('/api/market-data/realtime', {
        params: { date: today }
      });
      
      if (response.status === 200) {
        const data = response.data;
        console.log('Received price data:', data);
        
        // Log the first item to see its structure
        if (Array.isArray(data) && data.length > 0) {
          console.log('First data item structure:', data[0]);
          console.log('Available fields:', Object.keys(data[0]));
        }
        
        if (Array.isArray(data) && data.length > 0) {
          // Process the data to ensure it's in the right format
          const processedData = data.map((item, index) => {
            // Extract time from different possible formats
            let timeStr = '';
            
            if (item.Delivery_Period) {
              // Format: "2025-03-10 15:00:00" or "15:00-15:15" or "00:00 - 00:15"
              // Handle the space before the dash if present
              const cleanPeriod = item.Delivery_Period.replace(' - ', '-');
              const periodParts = cleanPeriod.split('-');
              if (periodParts.length > 1) {
                // It's a range like "15:00-15:15"
                timeStr = periodParts[0].trim();
              } else {
                // It's a datetime like "2025-03-10 15:00:00"
                const timeParts = cleanPeriod.split(' ');
                if (timeParts.length > 1) {
                  timeStr = timeParts[1].trim();
                } else {
                  timeStr = cleanPeriod.trim();
                }
              }
              
              // Ensure timeStr is in HH:MM format
              if (timeStr.length > 5) {
                timeStr = timeStr.substring(0, 5);
              }
              
              console.log(`Extracted time from "${item.Delivery_Period}": "${timeStr}"`);
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
            
            // Helper function to safely parse numeric values
            const parseNumeric = (value: any): number | null => {
              if (value === undefined || value === null) return null;
              if (typeof value === 'number') return value;
              if (typeof value === 'string') {
                const parsed = parseFloat(value);
                return isNaN(parsed) ? null : parsed;
              }
              return null;
            };
            
            // Get the resolution in minutes
            let resolutionMinutes = parseNumeric(item.Resolution_Minutes);
            
            // If resolution is not specified, try to determine it from the Delivery_Period
            if (!resolutionMinutes && item.Delivery_Period) {
              const cleanPeriod = item.Delivery_Period.replace(' - ', '-');
              const periodParts = cleanPeriod.split('-');
              
              if (periodParts.length > 1) {
                // It's a range like "15:00-15:15" or "00:00-00:30" or "00:00-01:00"
                const startTime = periodParts[0].trim();
                const endTime = periodParts[1].trim();
                
                // Parse start and end times
                const startParts = startTime.split(':').map(p => parseInt(p, 10));
                const endParts = endTime.split(':').map(p => parseInt(p, 10));
                
                if (startParts.length >= 2 && endParts.length >= 2) {
                  const startMinutes = startParts[0] * 60 + startParts[1];
                  const endMinutes = endParts[0] * 60 + endParts[1];
                  
                  // Calculate the difference in minutes
                  const diffMinutes = (endMinutes - startMinutes + 24 * 60) % (24 * 60);
                  
                  // Determine resolution based on the difference
                  if (diffMinutes === 15) {
                    resolutionMinutes = 15;
                  } else if (diffMinutes === 30) {
                    resolutionMinutes = 30;
                  } else if (diffMinutes === 60) {
                    resolutionMinutes = 60;
                  }
                  
                  console.log(`Determined resolution from period "${item.Delivery_Period}": ${resolutionMinutes} minutes`);
                }
              }
            }
            
            // Default to 15 if still not determined
            resolutionMinutes = resolutionMinutes || 15;
            
            // Log the raw item for debugging (only first few items)
            if (index < 3) {
              console.log(`Processing item ${index} with resolution ${resolutionMinutes}:`, item);
            }
            
            // Map database fields to our model based on resolution and cleared status
            const result: PriceData = {
              time: timeStr,
              deliveryPeriod: item.Delivery_Period || '',
              market: item.Market || '',
              cleared: item.Cleared !== undefined ? item.Cleared : true,
              resolutionMinutes: resolutionMinutes,
              
              // Initialize all price fields as null
              clearedHighPrice: null,
              clearedLowPrice: null,
              forecastedHighNordpool: null,
              forecastedLowNordpool: null,
              cleared30HighPrice: null,
              cleared30LowPrice: null,
              forecasted30HighNordpool: null,
              forecasted30LowNordpool: null,
              cleared60HighPrice: null,
              cleared60LowPrice: null,
              forecasted60HighNordpool: null,
              forecasted60LowNordpool: null,
              
              // Additional fields from schema
              vwap: parseNumeric(item.VWAP),
              vwap3h: parseNumeric(item.VWAP3H),
              vwap1h: parseNumeric(item.VWAP1H),
              open: parseNumeric(item.Open),
              close: parseNumeric(item.Close),
              buyVolume: parseNumeric(item.Buy_Volume),
              sellVolume: parseNumeric(item.Sell_Volume),
              transactionVolume: parseNumeric(item.Transaction_Volume),
              contractOpenTime: item.Contract_Open_Time,
              contractCloseTime: item.Contract_Close_Time,
              id: item.ID || item.Id || item.id,
              deliveryDay: item.Delivery_Day || item.delivery_day
            };
            
            // Parse High and Low values
            const highValue = parseNumeric(item.High);
            const lowValue = parseNumeric(item.Low);
            
            // Set price values based on resolution and cleared status
            if (resolutionMinutes === 15) {
              // 15-minute resolution products
              if (item.Cleared === true) {
                result.clearedHighPrice = highValue;
                result.clearedLowPrice = lowValue;
              } else {
                result.forecastedHighNordpool = highValue;
                result.forecastedLowNordpool = lowValue;
              }
            } else if (resolutionMinutes === 30) {
              // 30-minute resolution products
              if (item.Cleared === true) {
                result.cleared30HighPrice = highValue;
                result.cleared30LowPrice = lowValue;
              } else {
                result.forecasted30HighNordpool = highValue;
                result.forecasted30LowNordpool = lowValue;
              }
            } else if (resolutionMinutes === 60) {
              // 60-minute resolution products
              if (item.Cleared === true) {
                result.cleared60HighPrice = highValue;
                result.cleared60LowPrice = lowValue;
              } else {
                result.forecasted60HighNordpool = highValue;
                result.forecasted60LowNordpool = lowValue;
              }
            }
            
            // Log the processed result for debugging (only first few items)
            if (index < 3) {
              console.log(`Processed result ${index}:`, result);
            }
            
            return result;
          }).filter(Boolean); // Remove null items
          
          // Log some statistics about the data
          if (processedData.length > 0) {
            const samplePoint = processedData[0];
            console.log('Sample data point:', samplePoint);
            
            // Count data points by resolution and cleared status
            const resolution15Count = processedData.filter(d => d.resolutionMinutes === 15).length;
            const resolution30Count = processedData.filter(d => d.resolutionMinutes === 30).length;
            const resolution60Count = processedData.filter(d => d.resolutionMinutes === 60).length;
            
            const cleared15Count = processedData.filter(d => d.resolutionMinutes === 15 && d.cleared === true).length;
            const forecast15Count = processedData.filter(d => d.resolutionMinutes === 15 && d.cleared === false).length;
            const cleared30Count = processedData.filter(d => d.resolutionMinutes === 30 && d.cleared === true).length;
            const forecast30Count = processedData.filter(d => d.resolutionMinutes === 30 && d.cleared === false).length;
            const cleared60Count = processedData.filter(d => d.resolutionMinutes === 60 && d.cleared === true).length;
            const forecast60Count = processedData.filter(d => d.resolutionMinutes === 60 && d.cleared === false).length;
            
            console.log('Data breakdown by resolution:', {
              '15min': resolution15Count,
              '30min': resolution30Count,
              '60min': resolution60Count
            });
            
            console.log('Data breakdown by resolution and cleared status:', {
              '15min_cleared': cleared15Count,
              '15min_forecast': forecast15Count,
              '30min_cleared': cleared30Count,
              '30min_forecast': forecast30Count,
              '60min_cleared': cleared60Count,
              '60min_forecast': forecast60Count
            });
            
            // Check for non-zero values
            const nonZeroClearedHighPrice = processedData.some(d => d && d.clearedHighPrice && d.clearedHighPrice > 0);
            const nonZeroClearedLowPrice = processedData.some(d => d && d.clearedLowPrice && d.clearedLowPrice > 0);
            const nonZeroForecastedHighNordpool = processedData.some(d => d && d.forecastedHighNordpool && d.forecastedHighNordpool > 0);
            const nonZeroForecastedLowNordpool = processedData.some(d => d && d.forecastedLowNordpool && d.forecastedLowNordpool > 0);
            
            console.log('Data contains non-zero values:', {
              clearedHighPrice: nonZeroClearedHighPrice,
              clearedLowPrice: nonZeroClearedLowPrice,
              forecastedHighNordpool: nonZeroForecastedHighNordpool,
              forecastedLowNordpool: nonZeroForecastedLowNordpool
            });
            
            // Calculate min/max values for each series
            const clearedHighPrices = processedData
              .filter(d => d !== null && d.clearedHighPrice !== null)
              .map(d => d.clearedHighPrice) as number[];
              
            const clearedLowPrices = processedData
              .filter(d => d !== null && d.clearedLowPrice !== null)
              .map(d => d.clearedLowPrice) as number[];
              
            const forecastedHighPrices = processedData
              .filter(d => d !== null && d.forecastedHighNordpool !== null)
              .map(d => d.forecastedHighNordpool) as number[];
              
            const forecastedLowPrices = processedData
              .filter(d => d !== null && d.forecastedLowNordpool !== null)
              .map(d => d.forecastedLowNordpool) as number[];
            
            if (clearedHighPrices.length > 0) {
              const minHigh = Math.min(...clearedHighPrices);
              const maxHigh = Math.max(...clearedHighPrices);
              console.log('Cleared High price range:', { min: minHigh, max: maxHigh, count: clearedHighPrices.length });
            }
            
            if (clearedLowPrices.length > 0) {
              const minLow = Math.min(...clearedLowPrices);
              const maxLow = Math.max(...clearedLowPrices);
              console.log('Cleared Low price range:', { min: minLow, max: maxLow, count: clearedLowPrices.length });
            }
            
            if (forecastedHighPrices.length > 0) {
              const minHigh = Math.min(...forecastedHighPrices);
              const maxHigh = Math.max(...forecastedHighPrices);
              console.log('Forecasted High price range:', { min: minHigh, max: maxHigh, count: forecastedHighPrices.length });
            }
            
            if (forecastedLowPrices.length > 0) {
              const minLow = Math.min(...forecastedLowPrices);
              const maxLow = Math.max(...forecastedLowPrices);
              console.log('Forecasted Low price range:', { min: minLow, max: maxLow, count: forecastedLowPrices.length });
            }
            
            // Log raw data for debugging
            console.log('First few raw data items:', data.slice(0, 3));
            
            // Log a few sample points from each category
            const clearedSamples = processedData.filter(d => d.cleared === true).slice(0, 2);
            const unclearedSamples = processedData.filter(d => d.cleared === false).slice(0, 2);
            
            console.log('Sample cleared data points:', clearedSamples);
            console.log('Sample uncleared (forecast) data points:', unclearedSamples);
          }
          
          console.log('Processed data:', processedData);
          
          // Check if we have any non-null price values
          const hasAnyPriceValues = processedData.some(d => d && (
            // 15-minute resolution
            d.clearedHighPrice !== null || 
            d.clearedLowPrice !== null || 
            d.forecastedHighNordpool !== null || 
            d.forecastedLowNordpool !== null ||
            // 30-minute resolution
            d.cleared30HighPrice !== null ||
            d.cleared30LowPrice !== null ||
            d.forecasted30HighNordpool !== null ||
            d.forecasted30LowNordpool !== null ||
            // 60-minute resolution
            d.cleared60HighPrice !== null ||
            d.cleared60LowPrice !== null ||
            d.forecasted60HighNordpool !== null ||
            d.forecasted60LowNordpool !== null
          ));
          
          // Count data points by price field
          const clearedHighCount = processedData.filter(d => d.clearedHighPrice !== null).length;
          const clearedLowCount = processedData.filter(d => d.clearedLowPrice !== null).length;
          const forecastHighCount = processedData.filter(d => d.forecastedHighNordpool !== null).length;
          const forecastLowCount = processedData.filter(d => d.forecastedLowNordpool !== null).length;
          
          console.log('Price data counts:', {
            clearedHigh: clearedHighCount,
            clearedLow: clearedLowCount,
            forecastHigh: forecastHighCount,
            forecastLow: forecastLowCount
          });
          
          if (!hasAnyPriceValues) {
            console.warn('No price values found in API data, using sample data as fallback');
            setPriceData(generateSamplePriceData());
          } else {
            // Filter out null items before setting state
            setPriceData(processedData.filter(d => d !== null) as PriceData[]);
          }
        } else {
          console.warn('No data received from API, using sample data');
          setPriceData(generateSamplePriceData());
        }
      } else {
        console.error('API request failed:', response.status);
        setPriceData(generateSamplePriceData());
      }
    } catch (error) {
      console.error('Error fetching price data:', error);
      setPriceError(error instanceof Error ? error : new Error('Unknown error'));
      setPriceData(generateSamplePriceData());
    } finally {
      setPriceLoading(false);
    }
  };

  // Generate sample price data as a fallback
  const generateSamplePriceData = (): PriceData[] => {
    console.warn('Server not reachable - no backup data provided');
    return []; // Return empty array instead of generating fake data
  };

  // Define fetchMarketData function to get real market data
  const fetchMarketData = async () => {
    try {
      console.log('Fetching market data from API with date range:', dateRange);
      
      // Use the API instance from api.ts which has authentication interceptors
      const params: any = {};
      if (dateRange.start) {
        params.start_date = dateRange.start;
      }
      if (dateRange.end) {
        params.end_date = dateRange.end;
      }
      
      const response = await api.get('/api/market-data/germany', { params });
      
      if (response.status === 200) {
        const data = response.data;
        console.log('Received market data:', data);
        
        if (Array.isArray(data) && data.length > 0) {
          // Process the data to match our MarketData interface
          const processedData: MarketData[] = data.map(item => {
            // Helper function to safely parse numeric values
            const parseNumeric = (value: any): number => {
              if (value === undefined || value === null) return 0;
              if (typeof value === 'number') return value;
              if (typeof value === 'string') {
                const parsed = parseFloat(value);
                return isNaN(parsed) ? 0 : parsed;
              }
              return 0;
            };
            
            // Check for direct field names first, then fall back to DB column names
            // This makes the component resilient to both formats
            const getField = (directField: string, dbField: string) => {
              return item[directField] !== undefined ? item[directField] : item[dbField];
            };
            
            // Get resolution (could be in either format)
            let resolutionStr = item.resolution || '15min';
            if (!item.resolution) {
              const resolutionMinutes = parseNumeric(item.Resolution_Minutes);
              if (resolutionMinutes === 30) resolutionStr = '30min';
              else if (resolutionMinutes === 60) resolutionStr = '1h';
              else resolutionStr = '15min';
            }
            
            return {
              id: item.id || item.ID || `MD-${Math.random().toString(36).substring(2, 9)}`,
              date: item.date || item.Delivery_Day || new Date().toISOString().split('T')[0],
              resolution: resolutionStr,
              deliveryPeriod: item.deliveryPeriod || item.Delivery_Period || '',
              lowPrice: parseNumeric(getField('lowPrice', 'Low')),
              highPrice: parseNumeric(getField('highPrice', 'High')),
              averagePrice: parseNumeric(getField('averagePrice', 'VWAP')),
              closePrice: parseNumeric(getField('closePrice', 'Close')),
              volume: parseNumeric(getField('volume', 'Transaction_Volume')),
              // Additional fields that might be useful
              openPrice: parseNumeric(getField('openPrice', 'Open')),
              buyVolume: parseNumeric(getField('buyVolume', 'Buy_Volume')),
              sellVolume: parseNumeric(getField('sellVolume', 'Sell_Volume')),
              market: item.market || item.Market || 'Germany',
              contractOpenTime: item.contractOpenTime || item.Contract_Open_Time,
              contractCloseTime: item.contractCloseTime || item.Contract_Close_Time
            };
          });
          
          console.log('Processed market data:', processedData);
          setMarketData(processedData);
        } else {
          console.warn('No market data received from API, using sample data');
          generateSampleMarketData();
        }
      } else {
        console.error('Error fetching market data:', response.statusText);
        generateSampleMarketData();
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
      generateSampleMarketData();
    }
  };
  
  // Generate sample market data as a fallback
  const generateSampleMarketData = () => {
    console.warn('Server not reachable - no backup data provided');
    setMarketData([]); // Set empty array instead of generating fake data
  };

  // Initialize demo data
  useEffect(() => {
    // Fetch real market data
    fetchMarketData();
    
    // Generate sample forecasts
    const sampleForecasts: Forecast[] = Array.from({ length: 10 }, (_, i) => ({
      id: `F${i}`,
      timestamp: new Date(Date.now() + i * 60 * 60 * 1000).toISOString(),
      period: `${Math.floor(Math.random() * 24)}:00-${Math.floor(Math.random() * 24)}:00`,
      predictedLow: 50 + Math.random() * 20,
      predictedHigh: 80 + Math.random() * 20,
      confidence: Math.random() * 100,
      status: ['pending', 'completed', 'failed'][Math.floor(Math.random() * 3)] as 'pending' | 'completed' | 'failed'
    }));
    setForecasts(sampleForecasts);

    // Initial data fetch
    fetchData();

    // Set up polling interval
    const interval = setInterval(() => {
      fetchData();
    }, 300000); // Poll every 5 minutes instead of 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Add a new useEffect to refetch market data when dateRange changes
  useEffect(() => {
    console.log('Date range changed, refetching market data:', dateRange);
    fetchMarketData();
  }, [dateRange]);

  // Update battery level based on user action (buy/sell)
  const updateBatteryLevel = async (action: 'buy' | 'sell', quantity: number) => {
    try {
      setBatteryActionLoading(true);
      console.log(`${action.toUpperCase()} action for ${quantity} MWh`);
      
      // Here you would call an API to update the battery level
      // For now, we'll just simulate it
      setBatteryState(prev => {
        // Calculate new battery level
        const newLevel = Math.min(100, Math.max(0, action === 'buy'
            ? prev.level + (quantity / prev.capacity.usable * 100)
            : prev.level - (quantity / prev.capacity.usable * 100)
        ));

        const now = new Date();
        const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        const newHistory = [...prev.history.slice(-23), { time: timeStr, level: newLevel }];

        // We no longer create mock trades here - all trades should come from the API
        
        // After a trade is placed, we should refetch the trade history from the API
        refetchTradeHistory();

        return {
          ...prev,
          level: newLevel,
          lastAction: {
            type: action,
            quantity,
            timestamp: new Date().toISOString()
          },
          history: newHistory
        };
      });
    } catch (error) {
      console.error(`Error during battery ${action} action:`, error);
    } finally {
      setBatteryActionLoading(false);
    }
  };

  const getValidTimeOptions = () => {
    const duration = parseInt(selectedTimeWindow.duration);
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += duration) {
        options.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
      }
    }
    return options;
  };

  // Test API connection with more detailed information
  useEffect(() => {
    const testConnection = async () => {
      try {
        console.log('Testing API connection...');
        console.log('System date:', new Date().toISOString());
        console.log('Current date range:', dateRange);
        
        const result = await testApiConnection();
        console.log('API connection test result:', result);
        
        if (result.success) {
          setApiConnected(true);
          
          // Extra check - explicitly try to fetch price data
          try {
            console.log('Testing direct price data fetch...');
            const priceDataTest = await fetchPriceData(dateRange.start, dateRange.end);
            console.log('Direct price data test result:', 
              Array.isArray(priceDataTest) ? 
                `Received ${priceDataTest.length} data points` : 
                'Not an array');
            
            // Log the first few data points to help with debugging
            if (Array.isArray(priceDataTest) && priceDataTest.length > 0) {
              console.log('Sample data points:', priceDataTest.slice(0, 3));
              
              // Check if we have 15-minute data
              const has15MinData = priceDataTest.some(point => 
                point.deliveryPeriod && point.deliveryPeriod.includes('15')
              );
              console.log('Has 15-minute data:', has15MinData);
              
              // Check cleared vs uncleared data
              const clearedCount = priceDataTest.filter(point => point.cleared).length;
              const unclearedCount = priceDataTest.filter(point => !point.cleared).length;
              console.log(`Data breakdown: ${clearedCount} cleared (historical), ${unclearedCount} uncleared (forecast)`);
            }
            
            // Force a refetch of price data to ensure we're using the latest data
            fetchData();
          } catch (priceErr) {
            console.error('Direct price data test failed:', priceErr);
          }
        } else {
          // If connection failed, try again up to 3 times
          if (timeoutCount < 3) {
            setTimeoutCount(prev => prev + 1);
            setTimeout(testConnection, 3000); // Try again after 3 seconds
          } else {
            setApiConnected(false);
            console.warn('API is not available after multiple attempts, using demo mode');
          }
        }
      } catch (err) {
        console.error('Error testing API connection:', err);
        setApiConnected(false);
      }
    };
    
    // Don't block rendering, run after initial render
    const timer = setTimeout(testConnection, 1000);
    return () => clearTimeout(timer);
  }, [timeoutCount, dateRange]);

  // Set up interval to refetch price data, but less frequently
  useEffect(() => {
    if (apiConnected) {
      const interval = setInterval(() => {
        console.log('Refetching price data on interval');
        fetchData();
        // Also refetch market data periodically
        fetchMarketData();
      }, 600000); // 10 minutes
      
      return () => clearInterval(interval);
    }
  }, [apiConnected]);

  // Add a separate effect to fetch market data when API connection changes
  useEffect(() => {
    if (apiConnected) {
      console.log('API connected, fetching market data...');
      fetchMarketData();
    } else if (apiConnected === false) {
      console.log('API not connected, using sample market data');
      generateSampleMarketData();
    }
  }, [apiConnected]);

  // Function to update forecasts from the algorithm
  const updateForecasts = (newForecasts: Forecast[]) => {
    console.log('Updating forecasts with:', newForecasts);
    setForecasts(newForecasts);
  };

  useEffect(() => {
    // Fetch battery data using the imported function
    const fetchBatteryData = async () => {
      try {
        // Directly use the imported function
        const data = await fetchBatteryStatus();
        
        console.log('Battery status from API service:', data);
        
        // Set the battery state with the data from the API
        setBatteryState(prev => ({
          ...prev,
          level: data.level || 0,
          capacity: {
            ...prev.capacity,
            total: data.capacity?.total || prev.capacity.total,
            usable: data.capacity?.usable || prev.capacity.usable,
            percentage: prev.capacity.percentage
          },
          chargingState: data.charging_state || 'idle',
          chargingRate: data.charging_rate || 0
        }));
      } catch (error) {
        console.error('Error fetching battery status:', error);
      }
    };
    
    fetchBatteryData();
    
    // Set up interval to fetch battery status every 30 seconds
    const batteryInterval = setInterval(fetchBatteryData, 30000);
    
    return () => {
      clearInterval(batteryInterval);
    };
  }, []);

  // Add a try-catch block for the entire render function to prevent the blue screen
  try {
  return (
    <>
      <nav className="bg-dark-800/30 backdrop-blur-md shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-4 py-3">
            <NavButton
              tab="dashboard1"
              icon={LayoutDashboard}
              label="Spot Prices & Trading"
              activeTab={activeTab}
              onClick={setActiveTab}
            />
            <NavButton
              tab="dashboard2"
              icon={LineChart}
              label="User Performance"
              activeTab={activeTab}
              onClick={setActiveTab}
            />
            <NavButton
              tab="algorithm"
              icon={Zap}
              label="LumaraX Algorithm"
              activeTab={activeTab}
              onClick={setActiveTab}
            />
            <NavButton
              tab="history"
              icon={History}
              label="Market Data"
              activeTab={activeTab}
              onClick={setActiveTab}
            />
            <NavButton
              tab="guide"
              icon={HelpCircle}
              label="User Guide"
              activeTab={activeTab}
              onClick={setActiveTab}
            />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* API Connection Status Indicator */}
        <div className="mb-4 flex justify-between items-center">
          <div>
            {/* Removed the annoying header text */}
          </div>
          <div className="flex items-center">
            {apiConnected === null ? (
              <div className="flex items-center text-gray-400">
                <div className="animate-pulse rounded-full h-3 w-3 bg-gray-400 mr-2"></div>
                <span>Checking connection...</span>
              </div>
            ) : apiConnected ? (
              <div className="flex items-center text-green-400">
                <Wifi className="h-4 w-4 mr-2" />
                  <span>Connected to LumaraX Energy Systems</span>
              </div>
            ) : (
              <div className="flex items-center text-orange-400">
                <WifiOff className="h-4 w-4 mr-2" />
                <span>Demo Mode (No API)</span>
              </div>
            )}
          </div>
        </div>

          {/* Loading message when data is being loaded */}
          {(!priceData?.length || !trades?.length) && (
            <div className="mb-4 p-4 bg-blue-900/20 border border-blue-500/50 rounded-lg text-blue-300">
            <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-400 mr-3"></div>
                <span>Data is loading, please wait...</span>
              </div>
              <div className="mt-2 text-sm text-blue-300/80">
                This may take a few moments as we retrieve the latest market information.
            </div>
          </div>
        )}
        
        {/* Error message for price data */}
        {priceError && (
          <div className="mb-4 p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-300">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-red-400" />
              <span>Error loading price data: {priceError instanceof Error ? priceError.message : String(priceError)}</span>
            </div>
            <div className="mt-2 text-sm text-red-300/80">
              Using demo data for visualization. The data shown is simulated and does not represent actual market data.
            </div>
            <button 
              onClick={fetchData} 
              className="mt-2 px-3 py-1 bg-red-500/30 hover:bg-red-500/50 rounded text-sm"
            >
              Retry
            </button>
          </div>
        )}
        
        {/* Empty data notice */}
        {apiConnected && !priceError && (!priceData || priceData.length === 0) && (
          <div className="mb-4 p-4 bg-yellow-900/20 border border-yellow-500/50 rounded-lg text-yellow-300">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-yellow-400" />
              <span>No price data available from API</span>
            </div>
            <div className="mt-2 text-sm text-yellow-300/80">
              Using fallback data for visualization. Check your date range or backend data source.
            </div>
            <button 
              onClick={fetchData} 
              className="mt-2 px-3 py-1 bg-yellow-500/30 hover:bg-yellow-500/50 rounded text-sm"
            >
              Retry
            </button>
          </div>
        )}
        
        <TabContent
          activeTab={activeTab}
          batteryState={batteryState}
            priceData={priceData || []}
            trades={trades || []}
          dateRange={dateRange}
          priceFilter={priceFilter}
          selectedTimeWindow={selectedTimeWindow}
          updateBatteryLevel={updateBatteryLevel}
          setSelectedTimeWindow={setSelectedTimeWindow}
          getValidTimeOptions={getValidTimeOptions}
          setDateRange={setDateRange}
            forecasts={forecasts || []}
            marketData={marketData || []}
          batteryActionLoading={batteryActionLoading}
          updateForecasts={updateForecasts}
        />
      </main>
    </>
  );
  } catch (error) {
    // Render an emergency fallback UI if the entire dashboard fails to render
    console.error('Critical error rendering dashboard:', error);
    return (
      <div className="min-h-screen bg-dark-900 text-white p-6 flex flex-col items-center justify-center">
        <div className="max-w-2xl w-full bg-dark-800 rounded-lg shadow-xl p-8 border border-red-500/50">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Application Error</h1>
          <p className="text-gray-300 mb-4">
            We've encountered a critical error while rendering the dashboard. This could be due to missing data or a connection issue.
          </p>
          <div className="bg-dark-700 p-4 rounded mb-4 overflow-auto max-h-32">
            <code className="text-red-300 text-sm whitespace-pre-wrap">{error instanceof Error ? error.message : 'Unknown error'}</code>
          </div>
          <p className="text-gray-400 mb-6">Please try the following:</p>
          <ul className="list-disc pl-5 mb-6 text-gray-300">
            <li>Reload the page</li>
            <li>Clear your browser cache</li>
            <li>Log out and log back in</li>
            <li>Check if the backend server is running</li>
            <li>Contact support if the problem persists</li>
          </ul>
          <div className="flex space-x-4">
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Reload Page
            </button>
            <button 
              onClick={() => window.location.href = '/login'} 
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default Dashboard;