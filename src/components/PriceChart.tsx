import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  ReferenceLine,
  Label
} from 'recharts';
import { PriceData, Trade } from '../types';

interface PriceChartProps {
  data: PriceData[];
  trades?: Trade[];
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

// Helper to format time for display
const formatCurrentTime = (): string => {
  const now = new Date();
  // Format to match the exact format used in the chart data points
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

// Helper to format time from timestamp
const formatTimeFromTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    // Format to match the exact format used in the chart data points
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch (e) {
    console.error('Error formatting timestamp:', e);
    return '00:00';
  }
};

// Function to position time marker based on available tick values
const calculateTimePosition = (timeStr: string, dataPoints: any[]): number => {
  try {
    // Parse the target time
    const [hoursStr, minutesStr] = timeStr.split(':');
    const targetHours = parseInt(hoursStr, 10);
    const targetMinutes = parseInt(minutesStr, 10);
    const targetDecimal = targetHours + (targetMinutes / 60); // Convert to decimal hours
    
    // Get all unique time values from the data to use as possible tick values
    const uniqueTimes = [...new Set(dataPoints.map(p => p.time))].sort();
    
    // Map these times to decimal hours for comparison
    const timeToDecimal = uniqueTimes.map(time => {
      const [h, m] = time.split(':').map(Number);
      return { 
        time, 
        decimal: h + (m / 60) 
      };
    }).sort((a, b) => a.decimal - b.decimal);
    
    console.log("Available time values from data:", timeToDecimal.map(t => t.time).join(', '));
    
    // Find the two time values that our target time falls between
    let beforeTick = timeToDecimal[0];
    let afterTick = timeToDecimal[timeToDecimal.length - 1];
    
    for (let i = 0; i < timeToDecimal.length - 1; i++) {
      if (timeToDecimal[i].decimal <= targetDecimal && targetDecimal <= timeToDecimal[i + 1].decimal) {
        beforeTick = timeToDecimal[i];
        afterTick = timeToDecimal[i + 1];
        break;
      }
    }
    
    // Calculate the percentage between the two times
    const timeRange = afterTick.decimal - beforeTick.decimal;
    const timePosition = targetDecimal - beforeTick.decimal;
    const percentBetweenTimes = timeRange > 0 ? timePosition / timeRange : 0;
    
    // Calculate the index positions in the original data array
    const beforeIndex = uniqueTimes.indexOf(beforeTick.time);
    const afterIndex = uniqueTimes.indexOf(afterTick.time);
    
    // Calculate the visual percentage based on the indices
    const totalPoints = uniqueTimes.length - 1; // Total segments
    const segmentPercent = 100 / totalPoints; // Percentage per segment
    
    // Calculate the final position
    const position = (beforeIndex * segmentPercent) + (percentBetweenTimes * segmentPercent);
    
    console.log(`Time ${timeStr} (${targetDecimal}) positioned ${percentBetweenTimes.toFixed(2)}% between ${beforeTick.time} and ${afterTick.time}`);
    console.log(`Final position: ${position.toFixed(1)}%`);
    
    return position;
  } catch (e) {
    console.error('Error calculating time position:', e);
    return 50; // Default fallback
  }
};

// Custom component for the current time indicator label
const TimeIndicatorLabel = ({ x, y, payload }: any) => {
  return (
    <g className="time-indicator-label">
      <rect 
        x={x - 30} 
        y={y - 20} 
        width="60" 
        height="20" 
        rx="4" 
        fill="rgba(14, 165, 233, 0.8)" 
        className="time-indicator-bg"
      />
      <text 
        x={x} 
        y={y - 7} 
        textAnchor="middle" 
        fill="#ffffff" 
        fontSize="12"
        fontWeight="bold"
      >
        NOW
      </text>
    </g>
  );
};

// Custom component for trade markers
const TradeMarker = ({ x, y, payload, trade }: any) => {
  const isBuy = trade.type === 'buy';
  const bgColor = isBuy ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)';
  const label = isBuy ? 'BUY' : 'SELL';
  
  // Format price and quantity for display
  const price = typeof trade.price === 'number' ? `€${trade.price.toFixed(2)}` : '';
  const quantity = typeof trade.quantity === 'number' ? `${trade.quantity} MWh` : '';
  const status = trade.status || 'pending';
  
  return (
    <g className={`trade-marker ${isBuy ? 'buy-marker' : 'sell-marker'}`}>
      {/* Main marker */}
      <rect 
        x={x - 25} 
        y={y - 20} 
        width="50" 
        height="20" 
        rx="4" 
        fill={bgColor}
        className={isBuy ? 'buy-marker-bg' : 'sell-marker-bg'}
      />
      <text 
        x={x} 
        y={y - 7} 
        textAnchor="middle" 
        fill="#ffffff" 
        fontSize="10"
        fontWeight="bold"
      >
        {label}
      </text>
      
      {/* Extended tooltip on hover (using CSS to control visibility) */}
      <g className="trade-details">
        <rect 
          x={x - 60}
          y={y + 5}
          width="120"
          height="65"
          rx="4"
          fill="rgba(15, 23, 42, 0.95)"
          stroke={isBuy ? "rgba(34, 197, 94, 0.8)" : "rgba(239, 68, 68, 0.8)"}
          strokeWidth="1"
          className="trade-details-bg"
        />
        
        {/* Trade details text */}
        <text x={x - 55} y={y + 20} fill="#ffffff" fontSize="9" className="trade-details-text">
          <tspan x={x - 55} dy="0">Type: {trade.type.toUpperCase()}</tspan>
          <tspan x={x - 55} dy="12">Price: {price}</tspan>
          <tspan x={x - 55} dy="12">Quantity: {quantity}</tspan>
          <tspan x={x - 55} dy="12">Status: {status.toUpperCase()}</tspan>
        </text>
      </g>
    </g>
  );
};

const PriceChart: React.FC<PriceChartProps> = ({ data, trades = [] }) => {
  // Reference to the chart container
  const chartRef = useRef<HTMLDivElement>(null);
  
  // State to control which resolutions to display
  const [showResolution15, setShowResolution15] = useState(true);
  const [showResolution30, setShowResolution30] = useState(true);
  const [showResolution60, setShowResolution60] = useState(true);
  
  // Add state for current time
  const [currentTime, setCurrentTime] = useState(formatCurrentTime());
  
  // State to store actual x-axis tick positions
  const [xAxisTicks, setXAxisTicks] = useState<{time: string, position: number}[]>([]);
  
  // State to store the mapped current time and trade times
  const [mappedCurrentTime, setMappedCurrentTime] = useState<string | null>(null);
  const [mappedTradeTimes, setMappedTradeTimes] = useState<Map<string, string>>(new Map());
  
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
  
  // Get today's trades for display on chart
  const todaysTrades = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return trades.filter(trade => {
      // Filter for pending trades for today only
      // Only show pending trades - exclude executed and failed trades
      if (trade.status && trade.status.toLowerCase() !== 'pending') {
        return false;
      }
      
      // Check if trade is from today
      const tradeDate = new Date(trade.timestamp || trade.executionTime || '');
      return tradeDate.toISOString().split('T')[0] === today;
    });
  }, [trades]);
  
  // Calculate current time position as percentage based on processed data
  const currentTimePosition = useMemo(() => {
    return calculateTimePosition(currentTime, processedData);
  }, [currentTime, processedData]);
  
  // Calculate trade positions based on their times
  const tradePositions = useMemo(() => {
    return todaysTrades.map(trade => {
      const executionTime = new Date(trade.timestamp || trade.executionTime || '');
      const hours = executionTime.getHours().toString().padStart(2, '0');
      const minutes = executionTime.getMinutes().toString().padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;
      
      return {
        ...trade,
        position: calculateTimePosition(timeStr, processedData),
        timeStr
      };
    });
  }, [todaysTrades, processedData]);
  
  // Update current time when component mounts and whenever the data changes
  useEffect(() => {
    const updateCurrentTime = () => {
      const newTime = formatCurrentTime();
      setCurrentTime(newTime);
      console.log(`Updated current time to ${newTime}`);
    };
    
    // Update immediately on mount
    updateCurrentTime();
    
    // Update every minute
    const timer = setInterval(updateCurrentTime, 60000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Function to find actual tick positions in the rendered chart
  const findTickPositions = () => {
    try {
      if (!chartRef.current) return;
      
      // Find all x-axis tick text elements
      const tickElements = chartRef.current.querySelectorAll('.recharts-xAxis .recharts-cartesian-axis-tick-value tspan');
      
      if (!tickElements || tickElements.length === 0) {
        console.log("No tick elements found in DOM");
        return;
      }
      
      const chartWrapper = chartRef.current.querySelector('.recharts-wrapper');
      if (!chartWrapper) {
        console.log("Chart wrapper not found");
        return;
      }
      
      const chartWidth = chartWrapper.getBoundingClientRect().width || 0;
      if (chartWidth === 0) {
        console.log("Chart width is 0");
        return;
      }
      
      // Find the actual plot area dimensions
      const plotArea = chartRef.current.querySelector('.recharts-surface');
      const xAxis = chartRef.current.querySelector('.recharts-xAxis .recharts-cartesian-axis-line');
      const chartArea = chartRef.current.querySelector('.recharts-cartesian-grid-horizontal');
      
      if (plotArea && xAxis && chartArea) {
        // Get the position of the x-axis
        const xAxisRect = xAxis.getBoundingClientRect();
        const plotAreaRect = plotArea.getBoundingClientRect();
        const chartAreaRect = chartArea.getBoundingClientRect();
        
        // Calculate the distance from the top of the plot to the x-axis
        const topOffset = Math.round(chartAreaRect.top - plotAreaRect.top);
        const xAxisOffset = Math.round(xAxisRect.top - plotAreaRect.top);
        const chartHeight = Math.round(xAxisRect.top - chartAreaRect.top);
        
        // Add a small buffer to ensure lines don't extend below the x-axis
        const safeChartHeight = chartHeight - 5;
        
        // Update the CSS variables for line positioning
        const cssRoot = document.documentElement.style;
        cssRoot.setProperty('--chart-top-offset', `${topOffset}px`);
        cssRoot.setProperty('--chart-bottom-offset', `${xAxisOffset}px`);
        cssRoot.setProperty('--chart-height', `${safeChartHeight}px`);
        
        console.log(`Chart dimensions: top=${topOffset}px, xAxis=${xAxisOffset}px, height=${safeChartHeight}px`);
      }
      
      // Read the text and position of each tick
      const ticks: {time: string, position: number}[] = [];
      
      tickElements.forEach((tick: Element) => {
        const timeText = tick.textContent;
        if (!timeText) return;
        
        // Get the SVG position of the tick
        const parentElement = tick.parentElement;
        if (!parentElement) return;
        
        const svgX = parentElement.getAttribute('x');
        if (!svgX) return;
        
        // Convert to percentage of chart width
        const xPosition = (parseFloat(svgX) / chartWidth) * 100;
        
        ticks.push({ time: timeText, position: xPosition });
      });
      
      console.log("Found tick positions:", ticks);
      setXAxisTicks(ticks);
      
    } catch (error) {
      console.error("Error finding tick positions:", error);
    }
  };
  
  // Call findTickPositions after chart renders or updates
  useEffect(() => {
    // Wait for chart to render
    const timer = setTimeout(() => {
      findTickPositions();
    }, 500);
    
    // Also update on window resize since chart dimensions might change
    const handleResize = () => {
      findTickPositions();
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [processedData, showResolution15, showResolution30, showResolution60]);
  
  // Function to get position based on actual tick positions
  const getPositionFromTicks = (timeStr: string): number | null => {
    if (!xAxisTicks || xAxisTicks.length < 2) return null;
    
    // Try exact match first
    const exactMatch = xAxisTicks.find(tick => tick.time === timeStr);
    if (exactMatch) return exactMatch.position;
    
    // Parse the target time
    const [targetHours, targetMinutes] = timeStr.split(':').map(Number);
    const targetDecimal = targetHours + (targetMinutes / 60);
    
    // Convert tick times to decimal
    const ticksWithDecimal = xAxisTicks.map(tick => {
      const [h, m] = tick.time.split(':').map(Number);
      return {
        ...tick,
        decimal: h + (m / 60)
      };
    }).sort((a, b) => a.decimal - b.decimal);
    
    // Find where our time fits between ticks
    let beforeTick = ticksWithDecimal[0];
    let afterTick = ticksWithDecimal[ticksWithDecimal.length - 1];
    
    for (let i = 0; i < ticksWithDecimal.length - 1; i++) {
      if (ticksWithDecimal[i].decimal <= targetDecimal && targetDecimal <= ticksWithDecimal[i + 1].decimal) {
        beforeTick = ticksWithDecimal[i];
        afterTick = ticksWithDecimal[i + 1];
        break;
      }
    }
    
    // Calculate position between the two ticks
    const timeRange = afterTick.decimal - beforeTick.decimal;
    const timeOffset = targetDecimal - beforeTick.decimal;
    const ratio = timeRange === 0 ? 0 : timeOffset / timeRange;
    
    const positionRange = afterTick.position - beforeTick.position;
    const position = beforeTick.position + (ratio * positionRange);
    
    console.log(`DOM-based position for ${timeStr}: ${position.toFixed(1)}% (between ${beforeTick.time} and ${afterTick.time})`);
    return position;
  };
  
  // Get the actual positions based on rendered ticks if available
  const actualCurrentTimePosition = useMemo(() => {
    return getPositionFromTicks(currentTime) || currentTimePosition;
  }, [currentTime, xAxisTicks, currentTimePosition]);
  
  // Get actual trade positions
  const actualTradePositions = useMemo(() => {
    return tradePositions.map(trade => {
      const tickPosition = getPositionFromTicks(trade.timeStr);
      return {
        ...trade,
        position: tickPosition !== null ? tickPosition : trade.position
      };
    });
  }, [tradePositions, xAxisTicks]);
  
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
      
      {/* Add CSS for time indicator animation and trade markers */}
      <style>
        {`
          :root {
            --chart-top-offset: 20px;
            --chart-bottom-offset: 25px;
            --chart-height: 320px;
          }
          
          @keyframes pulse {
            0% { opacity: 0.7; }
            50% { opacity: 1; }
            100% { opacity: 0.7; }
          }
          
          .current-time-indicator {
            position: absolute;
            top: var(--chart-top-offset, 20px);
            height: var(--chart-height, 320px);
            width: 2px;
            background-color: #0ea5e9;
            z-index: 10;
            animation: pulse 2s infinite;
            box-shadow: 0 0 8px rgba(14, 165, 233, 0.6);
          }
          
          .time-indicator-label {
            position: absolute;
            top: -30px;
            transform: translateX(-50%);
            background-color: #0ea5e9;
            color: white;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 13px;
            font-weight: bold;
            box-shadow: 0 0 8px rgba(14, 165, 233, 0.8);
            z-index: 20;
            white-space: nowrap;
          }
          
          .trade-marker {
            position: absolute;
            top: 10px;
            transform: translateX(-50%);
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 13px;
            font-weight: bold;
            color: white;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.8);
            z-index: 15;
            white-space: nowrap;
          }
          
          .trade-line {
            position: absolute;
            top: var(--chart-top-offset, 20px);
            height: var(--chart-height, 320px);
            width: 2px;
            z-index: 5;
            opacity: 0.6;
          }
          
          .buy-marker {
            background-color: #22c55e;
          }
          
          .buy-line {
            background-color: #22c55e;
            opacity: 0.6;
          }
          
          .sell-marker {
            background-color: #ef4444;
          }
          
          .sell-line {
            background-color: #ef4444;
            opacity: 0.6;
          }
        `}
      </style>
      
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
        
        {/* Add current time info display */}
        <div className="ml-auto flex items-center">
          <div className="flex items-center space-x-2 bg-gray-800 px-3 py-1 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></div>
            <span className="text-white text-sm">Current Time: {currentTime}</span>
          </div>
        </div>
      </div>
      
      {/* Display today's trades summary if any */}
      {todaysTrades.length > 0 && (
        <div className="mb-4 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg">
          <div className="text-sm text-gray-300 flex items-center gap-1">
            <span className="font-medium">Today's Trades:</span>
            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-xs">
              {todaysTrades.filter(t => t.type === 'buy').length} Buy
            </span>
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs">
              {todaysTrades.filter(t => t.type === 'sell').length} Sell
            </span>
          </div>
        </div>
      )}
      
      <div className="h-[400px] w-full relative" ref={chartRef}>
        {/* Current time indicator overlay - dynamically positioned */}
        <div 
          className="current-time-indicator" 
          style={{ left: `${actualCurrentTimePosition}%` }}
        >
          <div className="time-indicator-label">
            NOW ({currentTime})
          </div>
        </div>
        
        {/* Dynamic trade markers based on actual trades */}
        {actualTradePositions.map((trade, index) => (
          <React.Fragment key={`trade-marker-${trade.id || index}`}>
            <div 
              className={`trade-marker ${trade.type === 'buy' ? 'buy-marker' : 'sell-marker'}`} 
              style={{ left: `${trade.position}%` }}
              title={`${trade.type.toUpperCase()} - €${trade.price} - ${trade.quantity} MWh`}
            >
              {trade.type.toUpperCase()}
            </div>
            <div 
              className={`trade-line ${trade.type === 'buy' ? 'buy-line' : 'sell-line'}`} 
              style={{ left: `${trade.position}%` }}
            ></div>
          </React.Fragment>
        ))}
        
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={processedData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            
            <XAxis 
              dataKey="time" 
              stroke="#94a3b8"
              padding={{ left: 10, right: 10 }}
              allowDataOverflow={true}
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
        <p>Current time: {currentTime}, Position: {actualCurrentTimePosition.toFixed(1)}%</p>
        <p>Today's trades: {todaysTrades.length}, Mapped positions: {actualTradePositions.map(t => `${t.timeStr}=${t.position.toFixed(1)}%`).join(', ')}</p>
      </div>
    </div>
  );
};

export default PriceChart; 