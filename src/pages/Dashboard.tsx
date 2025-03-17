import React, { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, LineChart, History, Battery, Calendar, Download, HelpCircle, Book, Lightbulb, AlertCircle, Zap, Clock, Globe, Sparkles, Search, CalendarDays, Wifi, WifiOff, Info } from 'lucide-react';
import { TabContent } from '../components/TabContent';
import { usePriceData } from '../hooks/useApi';
import { getPastDate, getFutureDate } from '../utils/dateUtils';
import { testApiConnection, generateSamplePriceData, fetchPriceData } from '../services/api';
import type { Tab, BatteryState, PriceData, Trade, DateRange, MarketData, Forecast } from '../types';

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

  // Define fetchData function at component level so it can be used anywhere
  const fetchData = async () => {
    try {
      console.log('Fetching price data...');
      setPriceLoading(true);
      setPriceError(null);
      
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`https://fastapi-service-920719150185.us-central1.run.app/api/prices/realtime?date=${today}`);
      
      if (response.ok) {
        const data = await response.json();
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
    const data: PriceData[] = [];
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
        
        // Create data points for 15-minute resolution
        // First, create the cleared data point (only for historical times)
        if (isHistorical) {
          data.push({
            time: timeStr,
            // 15-minute cleared prices (historical data)
            clearedHighPrice: basePrice + 10,
            clearedLowPrice: basePrice - 10,
            // No forecast data for this point
            forecastedHighNordpool: null,
            forecastedLowNordpool: null,
            // No 30-minute or 60-minute data for this point
            cleared30HighPrice: null,
            cleared30LowPrice: null,
            forecasted30HighNordpool: null,
            forecasted30LowNordpool: null,
            cleared60HighPrice: null,
            cleared60LowPrice: null,
            forecasted60HighNordpool: null,
            forecasted60LowNordpool: null,
            // No LumaraX forecasts for now
            lumaraxHighForecast: null,
            lumaraxLowForecast: null,
            deliveryPeriod: `${timeStr}-${(hour + (minute + 15 >= 60 ? 1 : 0)).toString().padStart(2, '0')}:${((minute + 15) % 60).toString().padStart(2, '0')}`,
            market: 'Germany',
            cleared: true,
            resolutionMinutes: 15
          });
        }
        
        // Then, create the forecast data point for 15-minute resolution (for all times)
        data.push({
          time: timeStr,
          // No cleared data for this point
          clearedHighPrice: null,
          clearedLowPrice: null,
          // 15-minute Nordpool forecasts
          forecastedHighNordpool: basePrice + 15,
          forecastedLowNordpool: basePrice - 15,
          // No 30-minute or 60-minute data for this point
          cleared30HighPrice: null,
          cleared30LowPrice: null,
          cleared60HighPrice: null,
          cleared60LowPrice: null,
          // No LumaraX forecasts for now
          lumaraxHighForecast: null,
          lumaraxLowForecast: null,
          deliveryPeriod: `${timeStr}-${(hour + (minute + 15 >= 60 ? 1 : 0)).toString().padStart(2, '0')}:${((minute + 15) % 60).toString().padStart(2, '0')}`,
          market: 'Germany',
          cleared: false,
          resolutionMinutes: 15
        });
        
        // Only create 30-minute resolution data points for even 15-minute intervals (00, 30)
        if (minute % 30 === 0) {
          // Create 30-minute resolution data
          const timeStr30 = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          
          // Add some variation to the base price for 30-minute resolution
          const basePrice30 = basePrice + 5;
          
          // Create cleared data point for 30-minute resolution (only for historical times)
          if (isHistorical) {
            data.push({
              time: timeStr30,
              // No 15-minute data for this point
              clearedHighPrice: null,
              clearedLowPrice: null,
              forecastedHighNordpool: null,
              forecastedLowNordpool: null,
              // 30-minute cleared prices
              cleared30HighPrice: basePrice30 + 12,
              cleared30LowPrice: basePrice30 - 8,
              // No 30-minute forecast data for this point
              forecasted30HighNordpool: null,
              forecasted30LowNordpool: null,
              // No 60-minute data for this point
              cleared60HighPrice: null,
              cleared60LowPrice: null,
              // No LumaraX forecasts for now
              lumaraxHighForecast: null,
              lumaraxLowForecast: null,
              deliveryPeriod: `${timeStr30}-${(hour + (minute + 30 >= 60 ? 1 : 0)).toString().padStart(2, '0')}:${((minute + 30) % 60).toString().padStart(2, '0')}`,
              market: 'Germany',
              cleared: true,
              resolutionMinutes: 30
            });
          }
          
          // Create forecast data point for 30-minute resolution (for all times)
          data.push({
            time: timeStr30,
            // No 15-minute data for this point
            clearedHighPrice: null,
            clearedLowPrice: null,
            forecastedHighNordpool: null,
            forecastedLowNordpool: null,
            // No 30-minute cleared data for this point
            cleared30HighPrice: null,
            cleared30LowPrice: null,
            // 30-minute Nordpool forecasts
            forecasted30HighNordpool: basePrice30 + 18,
            forecasted30LowNordpool: basePrice30 - 12,
            // No 60-minute data for this point
            cleared60HighPrice: null,
            cleared60LowPrice: null,
            forecasted60HighNordpool: null,
            forecasted60LowNordpool: null,
            // No LumaraX forecasts for now
            lumaraxHighForecast: null,
            lumaraxLowForecast: null,
            deliveryPeriod: `${timeStr30}-${(hour + (minute + 30 >= 60 ? 1 : 0)).toString().padStart(2, '0')}:${((minute + 30) % 60).toString().padStart(2, '0')}`,
            market: 'Germany',
            cleared: false,
            resolutionMinutes: 30
          });
        }
        
        // Only create 60-minute resolution data points at the start of each hour (XX:00)
        if (minute === 0) {
          // Create 60-minute resolution data
          const timeStr60 = `${hour.toString().padStart(2, '0')}:00`;
          
          // Add some variation to the base price for 60-minute resolution
          const basePrice60 = basePrice + 10;
          
          // Create cleared data point for 60-minute resolution (only for historical times)
          if (isHistorical) {
            data.push({
              time: timeStr60,
              // No 15-minute or 30-minute data for this point
              clearedHighPrice: null,
              clearedLowPrice: null,
              forecastedHighNordpool: null,
              forecastedLowNordpool: null,
              cleared30HighPrice: null,
              cleared30LowPrice: null,
              forecasted30HighNordpool: null,
              forecasted30LowNordpool: null,
              // 60-minute cleared prices
              cleared60HighPrice: basePrice60 + 15,
              cleared60LowPrice: basePrice60 - 5,
              // No 60-minute forecast data for this point
              forecasted60HighNordpool: null,
              forecasted60LowNordpool: null,
              // No LumaraX forecasts for now
              lumaraxHighForecast: null,
              lumaraxLowForecast: null,
              deliveryPeriod: `${timeStr60}-${(hour + 1).toString().padStart(2, '0')}:00`,
              market: 'Germany',
              cleared: true,
              resolutionMinutes: 60
            });
          }
          
          // Create forecast data point for 60-minute resolution (for all times)
          data.push({
            time: timeStr60,
            // No 15-minute or 30-minute data for this point
            clearedHighPrice: null,
            clearedLowPrice: null,
            forecastedHighNordpool: null,
            forecastedLowNordpool: null,
            cleared30HighPrice: null,
            cleared30LowPrice: null,
            forecasted30HighNordpool: null,
            forecasted30LowNordpool: null,
            // No 60-minute cleared data for this point
            cleared60HighPrice: null,
            cleared60LowPrice: null,
            // 60-minute Nordpool forecasts
            forecasted60HighNordpool: basePrice60 + 20,
            forecasted60LowNordpool: basePrice60 - 10,
            // No LumaraX forecasts for now
            lumaraxHighForecast: null,
            lumaraxLowForecast: null,
            deliveryPeriod: `${timeStr60}-${(hour + 1).toString().padStart(2, '0')}:00`,
            market: 'Germany',
            cleared: false,
            resolutionMinutes: 60
          });
        }
      }
    }
    
    return data;
  };

  // Define fetchMarketData function to get real market data
  const fetchMarketData = async () => {
    try {
      console.log('Fetching market data from API with date range:', dateRange);
      
      // Add date range parameters to the API request
      const url = new URL('https://fastapi-service-920719150185.us-central1.run.app/api/market-data/germany');
      if (dateRange.start) {
        url.searchParams.append('start_date', dateRange.start);
      }
      if (dateRange.end) {
        url.searchParams.append('end_date', dateRange.end);
      }
      
      const response = await fetch(url.toString());
      
      if (response.ok) {
        const data = await response.json();
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
      console.error('Exception fetching market data:', error);
      generateSampleMarketData();
    }
  };
  
  // Generate sample market data as a fallback
  const generateSampleMarketData = () => {
    const sampleMarketData: MarketData[] = Array.from({ length: 20 }, (_, i) => ({
      id: `M${i}`,
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      resolution: ['15min', '30min', '1h'][Math.floor(Math.random() * 3)],
      deliveryPeriod: `${Math.floor(Math.random() * 24)}:00-${Math.floor(Math.random() * 24)}:00`,
      lowPrice: 50 + Math.random() * 20,
      highPrice: 80 + Math.random() * 20,
      averagePrice: 65 + Math.random() * 20,
      closePrice: 70 + Math.random() * 20,
      volume: Math.floor(Math.random() * 1000) + 100
    }));
    setMarketData(sampleMarketData);
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

    const initialTrades: Trade[] = Array.from({ length: 10 }, (_, i) => ({
      id: `T${i + 1}`,
      type: Math.random() > 0.5 ? 'buy' : 'sell',
      price: 65 + Math.random() * 20,
      quantity: Math.floor(Math.random() * 50) + 10,
      timestamp: new Date(Date.now() - i * 3600000).toISOString(),
      executionTime: new Date(Date.now() + 3600000).toISOString(),
      profit: Math.random() * 1000 - 500,
      resolution: '15min',
      deliveryPeriod: `${Math.floor(Math.random() * 24)}:00-${Math.floor(Math.random() * 24)}:00`,
      averagePrice: 70 + Math.random() * 10,
      closePrice: 75 + Math.random() * 10,
      volume: Math.floor(Math.random() * 1000) + 100
    }));
    setTrades(initialTrades);

    // Initial data fetch
    fetchData();

    // Set up polling interval
    const interval = setInterval(() => {
      fetchData();
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Add a new useEffect to refetch market data when dateRange changes
  useEffect(() => {
    console.log('Date range changed, refetching market data:', dateRange);
    fetchMarketData();
  }, [dateRange]);

  const updateBatteryLevel = async (action: 'buy' | 'sell', quantity: number) => {
    try {
      setBatteryActionLoading(true);
      
      // Simulate API call with a short delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setBatteryState(prev => {
        const newLevel = Math.max(0, Math.min(100, 
          action === 'buy' 
            ? prev.level + (quantity / prev.capacity.usable * 100) 
            : prev.level - (quantity / prev.capacity.usable * 100)
        ));

        const now = new Date();
        const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        const newHistory = [...prev.history.slice(-23), { time: timeStr, level: newLevel }];

        // Safely access price data
        const lastPrice = Array.isArray(priceData) && priceData.length > 0 
          ? priceData[priceData.length - 1]?.clearedHighPrice || 0 
          : 0;

        const newTrade: Trade = {
          id: `T${Date.now()}`,
          type: action,
          price: lastPrice,
          quantity,
          timestamp: new Date().toISOString(),
          executionTime: new Date(selectedTimeWindow.date + 'T' + selectedTimeWindow.time).toISOString(),
          profit: action === 'sell' ? quantity * 2 : -quantity * 2,
          resolution: '15min',
          deliveryPeriod: `${selectedTimeWindow.time}-${selectedTimeWindow.time}`,
          averagePrice: 70,
          closePrice: 75,
          volume: quantity
        };

        setTrades(prev => [newTrade, ...prev.slice(0, 9)]);

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
                <span>Connected to API</span>
              </div>
            ) : (
              <div className="flex items-center text-orange-400">
                <WifiOff className="h-4 w-4 mr-2" />
                <span>Demo Mode (No API)</span>
              </div>
            )}
          </div>
        </div>

        {/* Loader for price data */}
        {priceLoading && !priceData && (
          <div className="mb-4 p-4 bg-dark-800/50 rounded-lg text-primary-300">
            <div className="flex items-center">
              <span className="mr-2">Loading price data...</span>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary-400"></div>
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
        
        {/* Demo data notice */}
        {!apiConnected && !priceError && (
          <div className="mb-4 p-4 bg-blue-900/20 border border-blue-500/50 rounded-lg text-blue-300">
            <div className="flex items-center">
              <Info className="h-5 w-5 mr-2 text-blue-400" />
              <span>Demo Mode Active</span>
            </div>
            <div className="mt-2 text-sm text-blue-300/80">
              The application is running in demo mode with simulated data. To view real data, ensure your backend server is running and accessible.
            </div>
            <button 
              onClick={() => {
                setTimeoutCount(0);
                setApiConnected(null);
              }} 
              className="mt-2 px-3 py-1 bg-blue-500/30 hover:bg-blue-500/50 rounded text-sm"
            >
              Check Connection
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
          priceData={priceData && priceData.length > 0 ? priceData : generateSamplePriceData()}
          trades={trades}
          dateRange={dateRange}
          priceFilter={priceFilter}
          selectedTimeWindow={selectedTimeWindow}
          updateBatteryLevel={updateBatteryLevel}
          setSelectedTimeWindow={setSelectedTimeWindow}
          getValidTimeOptions={getValidTimeOptions}
          setDateRange={setDateRange}
          forecasts={forecasts}
          marketData={marketData}
          batteryActionLoading={batteryActionLoading}
          updateForecasts={updateForecasts}
        />
      </main>
    </>
  );
}

export default Dashboard;