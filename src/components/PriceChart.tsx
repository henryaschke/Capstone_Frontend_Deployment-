import React, { useMemo, useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line
} from 'recharts';
import { PriceData } from '../types';

interface PriceChartProps {
  data: PriceData[];
}

// Helper function to check if a time string is valid
const isValidTimeString = (time: string): boolean => {
  return /^\d{1,2}:\d{2}(:\d{2})?$/.test(time) || 
         /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(time) ||
         /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(time);
};

// Helper to extract hour from time string
const getHourFromTimeString = (time: string): number => {
  if (time.includes(':')) {
    return parseInt(time.split(':')[0], 10);
  }
  return 0;
};

const PriceChart: React.FC<PriceChartProps> = ({ data }) => {
  // State to control which resolutions to display
  const [showResolution15, setShowResolution15] = useState(true);
  const [showResolution30, setShowResolution30] = useState(true);
  const [showResolution60, setShowResolution60] = useState(true);
  
  // Process data with a completely different approach
  const processedData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.warn('No data provided to PriceChart');
      return [];
    }

    try {
      // Log raw data for debugging
      console.log('Raw data first few items:', data.slice(0, 5));
      
      // Step 1: Filter out invalid data points
      const validData = data.filter(d => d && d.time && isValidTimeString(d.time));
      
      console.log('Original data length:', data.length);
      console.log('Valid data length:', validData.length);
      
      if (validData.length === 0) {
        console.error('No valid data points found for chart');
        return [];
      }
      
      // Step 2: Create a consistent time format with a fixed date
      const baseDate = '2025-03-10';
      
      const formattedData = validData.map(d => {
        let timeStr = d.time;
        
        // If it's just a time without date, add the base date
        if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeStr)) {
          timeStr = `${baseDate} ${timeStr}`;
        }
        
        // Create a proper date object
        const dateObj = new Date(timeStr);
        
        // Format time as HH:MM for display
        const hours = dateObj.getHours().toString().padStart(2, '0');
        const minutes = dateObj.getMinutes().toString().padStart(2, '0');
        const formattedTime = `${hours}:${minutes}`;
        
        // Create a numeric time value for sorting (hours since midnight)
        const timeValue = dateObj.getHours() + (dateObj.getMinutes() / 60);
        
        // Ensure all price values are numbers or null (not undefined)
        // Also log the first few data points to help with debugging
        const result = {
          ...d,
          originalTime: d.time,
          time: formattedTime,
          timeValue,
          dateObj,
          // Convert undefined values to null for better chart handling
          // 15-minute resolution
          clearedHighPrice: typeof d.clearedHighPrice === 'number' ? d.clearedHighPrice : null,
          clearedLowPrice: typeof d.clearedLowPrice === 'number' ? d.clearedLowPrice : null,
          forecastedHighNordpool: typeof d.forecastedHighNordpool === 'number' ? d.forecastedHighNordpool : null,
          forecastedLowNordpool: typeof d.forecastedLowNordpool === 'number' ? d.forecastedLowNordpool : null,
          
          // 30-minute resolution
          cleared30HighPrice: typeof d.cleared30HighPrice === 'number' ? d.cleared30HighPrice : null,
          cleared30LowPrice: typeof d.cleared30LowPrice === 'number' ? d.cleared30LowPrice : null,
          forecasted30HighNordpool: typeof d.forecasted30HighNordpool === 'number' ? d.forecasted30HighNordpool : null,
          forecasted30LowNordpool: typeof d.forecasted30LowNordpool === 'number' ? d.forecasted30LowNordpool : null,
          
          // 60-minute resolution
          cleared60HighPrice: typeof d.cleared60HighPrice === 'number' ? d.cleared60HighPrice : null,
          cleared60LowPrice: typeof d.cleared60LowPrice === 'number' ? d.cleared60LowPrice : null,
          forecasted60HighNordpool: typeof d.forecasted60HighNordpool === 'number' ? d.forecasted60HighNordpool : null,
          forecasted60LowNordpool: typeof d.forecasted60LowNordpool === 'number' ? d.forecasted60LowNordpool : null,
          
          // LumaraX forecasts
          lumaraxHighForecast: typeof d.lumaraxHighForecast === 'number' ? d.lumaraxHighForecast : null,
          lumaraxLowForecast: typeof d.lumaraxLowForecast === 'number' ? d.lumaraxLowForecast : null
        };
        
        return result;
      });
      
      // Log a few data points to help with debugging
      if (formattedData.length > 0) {
        console.log('Sample data point:', formattedData[0]);
        
        // Check if we have any non-null price values for each resolution
        // 15-minute resolution
        const has15ClearedHighPrice = formattedData.some(d => d.clearedHighPrice !== null);
        const has15ClearedLowPrice = formattedData.some(d => d.clearedLowPrice !== null);
        const has15ForecastedHighNordpool = formattedData.some(d => d.forecastedHighNordpool !== null);
        const has15ForecastedLowNordpool = formattedData.some(d => d.forecastedLowNordpool !== null);
        
        // 30-minute resolution
        const has30ClearedHighPrice = formattedData.some(d => d.cleared30HighPrice !== null);
        const has30ClearedLowPrice = formattedData.some(d => d.cleared30LowPrice !== null);
        const has30ForecastedHighNordpool = formattedData.some(d => d.forecasted30HighNordpool !== null);
        const has30ForecastedLowNordpool = formattedData.some(d => d.forecasted30LowNordpool !== null);
        
        // 60-minute resolution
        const has60ClearedHighPrice = formattedData.some(d => d.cleared60HighPrice !== null);
        const has60ClearedLowPrice = formattedData.some(d => d.cleared60LowPrice !== null);
        const has60ForecastedHighNordpool = formattedData.some(d => d.forecasted60HighNordpool !== null);
        const has60ForecastedLowNordpool = formattedData.some(d => d.forecasted60LowNordpool !== null);
        
        console.log('Data contains (15-minute resolution):', {
          clearedHighPrice: has15ClearedHighPrice,
          clearedLowPrice: has15ClearedLowPrice,
          forecastedHighNordpool: has15ForecastedHighNordpool,
          forecastedLowNordpool: has15ForecastedLowNordpool
        });
        
        console.log('Data contains (30-minute resolution):', {
          cleared30HighPrice: has30ClearedHighPrice,
          cleared30LowPrice: has30ClearedLowPrice,
          forecasted30HighNordpool: has30ForecastedHighNordpool,
          forecasted30LowNordpool: has30ForecastedLowNordpool
        });
        
        console.log('Data contains (60-minute resolution):', {
          cleared60HighPrice: has60ClearedHighPrice,
          cleared60LowPrice: has60ClearedLowPrice,
          forecasted60HighNordpool: has60ForecastedHighNordpool,
          forecasted60LowNordpool: has60ForecastedLowNordpool
        });
        
        // Check for any non-null values
        const hasAnyValues = formattedData.some(d => 
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
        );
        
        console.log('Has any non-null price values:', hasAnyValues);
        
        // Log all fields from the first item to see what's available
        console.log('All fields from first item:', Object.keys(formattedData[0]));
        
        // Log some actual values to help with debugging
        console.log('First item clearedHighPrice:', formattedData[0].clearedHighPrice);
        console.log('First item clearedLowPrice:', formattedData[0].clearedLowPrice);
        console.log('First item forecastedHighNordpool:', formattedData[0].forecastedHighNordpool);
        console.log('First item forecastedLowNordpool:', formattedData[0].forecastedLowNordpool);
      }
      
      // Step 3: Sort by time value
      const sortedData = formattedData.sort((a, b) => a.timeValue - b.timeValue);
      
      // Step 4: Log the processed data for debugging
      console.log('Processed data length:', sortedData.length);
      
      return sortedData;
    } catch (error) {
      console.error('Error processing chart data:', error);
      return [];
    }
  }, [data]);
  
  // Log data changes
  useEffect(() => {
    console.log('PriceChart received data length:', data?.length || 0);
    console.log('Processed data length:', processedData?.length || 0);
  }, [data, processedData]);
  
  // If there's no data, show an empty state message
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 w-full text-center p-4 rounded-lg bg-dark-800/30 border border-gray-700/30">
        <div className="text-gray-400 mb-4">No price data available</div>
        <div className="text-sm text-gray-500">
          The server is not providing any price data at this time. Please check your connection or try again later.
        </div>
      </div>
    );
  }
  
  // If processedData is empty after processing (but data wasn't empty), also show an error
  if (processedData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 w-full text-center p-4 rounded-lg bg-dark-800/30 border border-gray-700/30">
        <div className="text-gray-400 mb-4">Could not process price data</div>
        <div className="text-sm text-gray-500">
          The data received could not be processed. Please check the console for more details.
        </div>
      </div>
    );
  }

  // Count how many data points we have for each series
  // 15-minute resolution
  const cleared15HighCount = processedData.filter(d => d.clearedHighPrice !== null).length;
  const cleared15LowCount = processedData.filter(d => d.clearedLowPrice !== null).length;
  const forecast15HighCount = processedData.filter(d => d.forecastedHighNordpool !== null).length;
  const forecast15LowCount = processedData.filter(d => d.forecastedLowNordpool !== null).length;
  
  // 30-minute resolution
  const cleared30HighCount = processedData.filter(d => d.cleared30HighPrice !== null).length;
  const cleared30LowCount = processedData.filter(d => d.cleared30LowPrice !== null).length;
  const forecast30HighCount = processedData.filter(d => d.forecasted30HighNordpool !== null).length;
  const forecast30LowCount = processedData.filter(d => d.forecasted30LowNordpool !== null).length;
  
  // 60-minute resolution
  const cleared60HighCount = processedData.filter(d => d.cleared60HighPrice !== null).length;
  const cleared60LowCount = processedData.filter(d => d.cleared60LowPrice !== null).length;
  const forecast60HighCount = processedData.filter(d => d.forecasted60HighNordpool !== null).length;
  const forecast60LowCount = processedData.filter(d => d.forecasted60LowNordpool !== null).length;
  
  console.log('Data point counts (15-minute):', {
    clearedHigh: cleared15HighCount,
    clearedLow: cleared15LowCount,
    forecastHigh: forecast15HighCount,
    forecastLow: forecast15LowCount
  });
  
  console.log('Data point counts (30-minute):', {
    clearedHigh: cleared30HighCount,
    clearedLow: cleared30LowCount,
    forecastHigh: forecast30HighCount,
    forecastLow: forecast30LowCount
  });
  
  console.log('Data point counts (60-minute):', {
    clearedHigh: cleared60HighCount,
    clearedLow: cleared60LowCount,
    forecastHigh: forecast60HighCount,
    forecastLow: forecast60LowCount
  });
  
  // Check if we have any non-null values to display for each resolution
  const has15MinData = cleared15HighCount > 0 || cleared15LowCount > 0 || 
                      forecast15HighCount > 0 || forecast15LowCount > 0;
                      
  const has30MinData = cleared30HighCount > 0 || cleared30LowCount > 0 || 
                      forecast30HighCount > 0 || forecast30LowCount > 0;
                      
  const has60MinData = cleared60HighCount > 0 || cleared60LowCount > 0 || 
                      forecast60HighCount > 0 || forecast60LowCount > 0;
  
  // Update state based on available data
  useEffect(() => {
    setShowResolution15(has15MinData);
    setShowResolution30(has30MinData);
    setShowResolution60(has60MinData);
  }, [has15MinData, has30MinData, has60MinData]);
  
  // If no data for any resolution, show a message
  if (!has15MinData && !has30MinData && !has60MinData) {
    return (
      <div className="p-4 text-center bg-gray-800 rounded-lg">
        <p className="text-gray-300">No price data available for any resolution</p>
        <p className="text-sm text-gray-400 mt-2">Check your data mapping in the fetchData function</p>
        <div className="mt-4 p-2 bg-gray-700 rounded text-xs text-left overflow-auto max-h-40">
          <p>Data diagnostics:</p>
          <p>Total data points: {processedData.length}</p>
          <p>15-min data: {has15MinData ? 'Yes' : 'No'}</p>
          <p>30-min data: {has30MinData ? 'Yes' : 'No'}</p>
          <p>60-min data: {has60MinData ? 'Yes' : 'No'}</p>
          <p>Sample point: {JSON.stringify(processedData[0])}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-4 bg-gray-900 p-4 rounded-lg">
      <h2 className="text-xl font-bold text-white mb-4">Real-Time Price Chart</h2>
      
      {/* Resolution toggles */}
      <div className="flex flex-wrap gap-4 mb-4">
        {has15MinData && (
          <div className="flex items-center">
            <input
              type="checkbox"
              id="resolution15"
              checked={showResolution15}
              onChange={() => setShowResolution15(!showResolution15)}
              className="mr-2"
            />
            <label htmlFor="resolution15" className="text-white">15-minute ({cleared15HighCount + cleared15LowCount + forecast15HighCount + forecast15LowCount} points)</label>
          </div>
        )}
        {has30MinData && (
          <div className="flex items-center">
            <input
              type="checkbox"
              id="resolution30"
              checked={showResolution30}
              onChange={() => setShowResolution30(!showResolution30)}
              className="mr-2"
            />
            <label htmlFor="resolution30" className="text-white">30-minute ({cleared30HighCount + cleared30LowCount + forecast30HighCount + forecast30LowCount} points)</label>
          </div>
        )}
        {has60MinData && (
          <div className="flex items-center">
            <input
              type="checkbox"
              id="resolution60"
              checked={showResolution60}
              onChange={() => setShowResolution60(!showResolution60)}
              className="mr-2"
            />
            <label htmlFor="resolution60" className="text-white">60-minute ({cleared60HighCount + cleared60LowCount + forecast60HighCount + forecast60LowCount} points)</label>
          </div>
        )}
      </div>
      
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={processedData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            
            <XAxis 
              dataKey="time" 
              stroke="#94a3b8"
              padding={{ left: 10, right: 10 }}
            />
            
            <YAxis 
              stroke="#94a3b8"
              domain={[0, 'auto']}
            />
            
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                borderColor: 'rgba(56, 189, 248, 0.3)',
                color: 'white'
              }}
              formatter={(value: any) => {
                return value !== null ? value.toFixed(2) : 'N/A';
              }}
            />
            
            <Legend />

            {/* 15-minute resolution */}
            {showResolution15 && has15MinData && (
              <>
                {/* Cleared Prices */}
                {cleared15HighCount > 0 && (
                  <Line
                    type="monotone"
                    dataKey="clearedHighPrice"
                    stroke="#3b82f6" // Blue
                    strokeWidth={2}
                    dot={{ r: 1 }}
                    activeDot={{ r: 6 }}
                    connectNulls={true}
                    name="15min Cleared High"
                    isAnimationActive={false}
                  />
                )}
                
                {cleared15LowCount > 0 && (
                  <Line
                    type="monotone"
                    dataKey="clearedLowPrice"
                    stroke="#2563eb" // Darker blue
                    strokeWidth={2}
                    dot={{ r: 1 }}
                    activeDot={{ r: 6 }}
                    connectNulls={true}
                    name="15min Cleared Low"
                    isAnimationActive={false}
                  />
                )}

                {/* Nordpool Forecasts */}
                {forecast15HighCount > 0 && (
                  <Line
                    type="monotone"
                    dataKey="forecastedHighNordpool"
                    stroke="#10b981" // Green
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 1 }}
                    activeDot={{ r: 6 }}
                    connectNulls={true}
                    name="15min Forecast High"
                    isAnimationActive={false}
                  />
                )}
                
                {forecast15LowCount > 0 && (
                  <Line
                    type="monotone"
                    dataKey="forecastedLowNordpool"
                    stroke="#059669" // Darker green
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 1 }}
                    activeDot={{ r: 6 }}
                    connectNulls={true}
                    name="15min Forecast Low"
                    isAnimationActive={false}
                  />
                )}
              </>
            )}

            {/* 30-minute resolution */}
            {showResolution30 && has30MinData && (
              <>
                {/* Cleared Prices */}
                {cleared30HighCount > 0 && (
                  <Line
                    type="monotone"
                    dataKey="cleared30HighPrice"
                    stroke="#f59e0b" // Amber
                    strokeWidth={2}
                    dot={{ r: 1 }}
                    activeDot={{ r: 6 }}
                    connectNulls={true}
                    name="30min Cleared High"
                    isAnimationActive={false}
                  />
                )}
                
                {cleared30LowCount > 0 && (
                  <Line
                    type="monotone"
                    dataKey="cleared30LowPrice"
                    stroke="#d97706" // Darker amber
                    strokeWidth={2}
                    dot={{ r: 1 }}
                    activeDot={{ r: 6 }}
                    connectNulls={true}
                    name="30min Cleared Low"
                    isAnimationActive={false}
                  />
                )}

                {/* Nordpool Forecasts */}
                {forecast30HighCount > 0 && (
                  <Line
                    type="monotone"
                    dataKey="forecasted30HighNordpool"
                    stroke="#fbbf24" // Light amber
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 1 }}
                    activeDot={{ r: 6 }}
                    connectNulls={true}
                    name="30min Forecast High"
                    isAnimationActive={false}
                  />
                )}
                
                {forecast30LowCount > 0 && (
                  <Line
                    type="monotone"
                    dataKey="forecasted30LowNordpool"
                    stroke="#b45309" // Very dark amber
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 1 }}
                    activeDot={{ r: 6 }}
                    connectNulls={true}
                    name="30min Forecast Low"
                    isAnimationActive={false}
                  />
                )}
              </>
            )}

            {/* 60-minute resolution */}
            {showResolution60 && has60MinData && (
              <>
                {/* Cleared Prices */}
                {cleared60HighCount > 0 && (
                  <Line
                    type="monotone"
                    dataKey="cleared60HighPrice"
                    stroke="#ec4899" // Pink
                    strokeWidth={2}
                    dot={{ r: 1 }}
                    activeDot={{ r: 6 }}
                    connectNulls={true}
                    name="60min Cleared High"
                    isAnimationActive={false}
                  />
                )}
                
                {cleared60LowCount > 0 && (
                  <Line
                    type="monotone"
                    dataKey="cleared60LowPrice"
                    stroke="#be185d" // Darker pink
                    strokeWidth={2}
                    dot={{ r: 1 }}
                    activeDot={{ r: 6 }}
                    connectNulls={true}
                    name="60min Cleared Low"
                    isAnimationActive={false}
                  />
                )}

                {/* Nordpool Forecasts */}
                {forecast60HighCount > 0 && (
                  <Line
                    type="monotone"
                    dataKey="forecasted60HighNordpool"
                    stroke="#f472b6" // Light pink
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 1 }}
                    activeDot={{ r: 6 }}
                    connectNulls={true}
                    name="60min Forecast High"
                    isAnimationActive={false}
                  />
                )}
                
                {forecast60LowCount > 0 && (
                  <Line
                    type="monotone"
                    dataKey="forecasted60LowNordpool"
                    stroke="#831843" // Very dark pink
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 1 }}
                    activeDot={{ r: 6 }}
                    connectNulls={true}
                    name="60min Forecast Low"
                    isAnimationActive={false}
                  />
                )}
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {/* Debug information */}
      <div className="mt-4 p-2 bg-gray-800 rounded text-xs text-gray-400 font-mono overflow-auto max-h-40">
        <p>Data points: {processedData.length}</p>
        <p>15-min: {cleared15HighCount} cleared high, {cleared15LowCount} cleared low, {forecast15HighCount} forecast high, {forecast15LowCount} forecast low</p>
        <p>30-min: {cleared30HighCount} cleared high, {cleared30LowCount} cleared low, {forecast30HighCount} forecast high, {forecast30LowCount} forecast low</p>
        <p>60-min: {cleared60HighCount} cleared high, {cleared60LowCount} cleared low, {forecast60HighCount} forecast high, {forecast60LowCount} forecast low</p>
      </div>
    </div>
  );
};

export default PriceChart; 