import React, { useState, useMemo, useEffect } from 'react';
import { LayoutDashboard, LineChart, History, Battery, Calendar, Download, HelpCircle, Book, Lightbulb, AlertCircle, Zap, Clock, Globe, Sparkles, Search, CalendarDays, Plus, BarChart2, Cpu, Database, HardDrive, RefreshCw, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart as RechartsLineChart, Line, Legend, ReferenceLine, Label } from 'recharts';
import { BatteryVisualization } from './BatteryVisualization';
import { DateRangeFilter } from './DateRangeFilter';
import { CustomTradeMarker } from './CustomTradeMarker';
import PriceChart from './PriceChart';
import type { Tab, BatteryState, PriceData, Trade, DateRange, MarketData, Forecast } from '../types';
import { generateForecasts, formatForecasts, fetchSavedForecasts, SavedForecast } from '../services/api';

interface TabContentProps {
  activeTab: Tab;
  batteryState: BatteryState;
  priceData: PriceData[];
  trades: Trade[];
  dateRange: DateRange;
  priceFilter: { min: string; max: string };
  selectedTimeWindow: { date: string; time: string; duration: string };
  updateBatteryLevel: (action: 'buy' | 'sell', quantity: number) => void;
  setSelectedTimeWindow: React.Dispatch<React.SetStateAction<{ date: string; time: string; duration: string }>>;
  getValidTimeOptions: () => string[];
  setDateRange: React.Dispatch<React.SetStateAction<DateRange>>;
  forecasts: Forecast[];
  marketData: MarketData[];
  batteryActionLoading?: boolean;
  updateForecasts?: (forecasts: Forecast[]) => void;
}

export const TabContent: React.FC<TabContentProps> = ({
  activeTab,
  batteryState,
  priceData,
  trades,
  dateRange,
  priceFilter,
  selectedTimeWindow,
  updateBatteryLevel,
  setSelectedTimeWindow,
  getValidTimeOptions,
  setDateRange,
  forecasts,
  marketData,
  batteryActionLoading,
  updateForecasts
}) => {
  // Add state for market data filters
  const [marketDataSearch, setMarketDataSearch] = useState('');
  const [marketDataResolution, setMarketDataResolution] = useState('');
  const [marketDataPriceMin, setMarketDataPriceMin] = useState('');
  const [marketDataPriceMax, setMarketDataPriceMax] = useState('');
  
  // Add pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 30; // Number of records to show per page

  // Filter market data based on search and filters
  const filteredMarketData = useMemo(() => {
    return marketData.filter(item => {
      // Filter by search term
      const searchLower = marketDataSearch.toLowerCase();
      if (searchLower && 
          !item.date.toLowerCase().includes(searchLower) && 
          !item.deliveryPeriod.toLowerCase().includes(searchLower) &&
          !item.market?.toLowerCase().includes(searchLower)) {
        return false;
      }
      
      // Filter by resolution
      if (marketDataResolution && item.resolution !== marketDataResolution) {
        return false;
      }
      
      // Filter by price range (min)
      if (marketDataPriceMin && item.lowPrice < parseFloat(marketDataPriceMin)) {
        return false;
      }
      
      // Filter by price range (max)
      if (marketDataPriceMax && item.highPrice > parseFloat(marketDataPriceMax)) {
        return false;
      }
      
      // Filter by date range
      const itemDate = new Date(item.date);
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      
      if (itemDate < startDate || itemDate > endDate) {
        return false;
      }
      
      return true;
    });
  }, [marketData, marketDataSearch, marketDataResolution, marketDataPriceMin, marketDataPriceMax, dateRange]);
  
  // Paginate market data
  const paginatedMarketData = useMemo(() => {
    const startIndex = (currentPage - 1) * recordsPerPage;
    const endIndex = startIndex + recordsPerPage;
    return filteredMarketData.slice(startIndex, endIndex);
  }, [filteredMarketData, currentPage, recordsPerPage]);
  
  // Calculate total number of pages
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredMarketData.length / recordsPerPage));
  }, [filteredMarketData, recordsPerPage]);
  
  // Handle page change
  const handlePageChange = (page: number) => {
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    setCurrentPage(page);
  };
  
  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [marketDataSearch, marketDataResolution, marketDataPriceMin, marketDataPriceMax, dateRange]);
  
  // Generate array of page numbers to display
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 3;
    
    if (totalPages <= maxPagesToShow) {
      // If we have 3 or fewer pages, show all pages
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // Otherwise, show current page and neighbors
      if (currentPage === 1) {
        // If on first page, show first 3 pages
        pageNumbers.push(1, 2, 3);
      } else if (currentPage === totalPages) {
        // If on last page, show last 3 pages
        pageNumbers.push(totalPages - 2, totalPages - 1, totalPages);
      } else {
        // Otherwise, show current page and its neighbors
        pageNumbers.push(currentPage - 1, currentPage, currentPage + 1);
      }
    }
    
    return pageNumbers;
  };

  const [algorithmLoading, setAlgorithmLoading] = useState(false);
  const [algorithmError, setAlgorithmError] = useState<string | null>(null);
  const [algorithmSuccess, setAlgorithmSuccess] = useState(false);

  // New state for saved forecasts
  const [savedForecasts, setSavedForecasts] = useState<SavedForecast[]>([]);
  const [forecastsLoading, setForecastsLoading] = useState(false);
  const [forecastsError, setForecastsError] = useState<string | null>(null);
  const [totalForecasts, setTotalForecasts] = useState(0);
  
  // Filter state
  const [forecastFilters, setForecastFilters] = useState({
    resolution: '',
    activeOnly: true,
    date: new Date().toISOString().split('T')[0],
    limit: 20,
    sortField: 'timestamp',
    sortDirection: 'desc' as 'asc' | 'desc'
  });

  // Effect to load saved forecasts on mount and when filters change
  useEffect(() => {
    const loadSavedForecasts = async () => {
      try {
        setForecastsLoading(true);
        setForecastsError(null);
        
        // Get the user ID from local storage if available
        const userDataStr = localStorage.getItem('user');
        const userId = userDataStr ? JSON.parse(userDataStr).user_id : undefined;
        
        // Convert resolution string to number if present
        const resolution = forecastFilters.resolution ? 
          parseInt(forecastFilters.resolution) : undefined;
        
        const result = await fetchSavedForecasts({
          userId,
          resolution,
          limit: forecastFilters.limit,
          activeOnly: forecastFilters.activeOnly,
          date: forecastFilters.date || undefined
        });
        
        if (result.status === 'success') {
          setSavedForecasts(result.forecasts);
          setTotalForecasts(result.count);
        } else {
          setForecastsError('Failed to load forecasts. Please try again.');
        }
      } catch (error) {
        console.error('Error loading saved forecasts:', error);
        setForecastsError('An error occurred while loading forecasts. Please try again.');
      } finally {
        setForecastsLoading(false);
      }
    };
    
    loadSavedForecasts();
  }, [forecastFilters]);

  // Sort forecasts based on current sort settings
  const sortedForecasts = useMemo(() => {
    if (!savedForecasts.length) return [];
    
    return [...savedForecasts].sort((a, b) => {
      let aValue = a[forecastFilters.sortField as keyof SavedForecast];
      let bValue = b[forecastFilters.sortField as keyof SavedForecast];
      
      // Handle null values
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return forecastFilters.sortDirection === 'asc' ? -1 : 1;
      if (bValue === null) return forecastFilters.sortDirection === 'asc' ? 1 : -1;
      
      // Handle special cases
      if (forecastFilters.sortField === 'timestamp' || forecastFilters.sortField === 'generated_at' || forecastFilters.sortField === 'last_updated') {
        aValue = new Date(aValue as string).getTime();
        bValue = new Date(bValue as string).getTime();
      }
      
      if (aValue === bValue) return 0;
      
      const compareResult = aValue < bValue ? -1 : 1;
      return forecastFilters.sortDirection === 'asc' ? compareResult : -compareResult;
    });
  }, [savedForecasts, forecastFilters.sortField, forecastFilters.sortDirection]);

  const runAlgorithm = async () => {
    try {
      setAlgorithmLoading(true);
      setAlgorithmError(null);
      setAlgorithmSuccess(false);
      
      console.log('Running AlgorithmX manually...');
      
      // Get the user ID from local storage if available
      const userDataStr = localStorage.getItem('user');
      const userId = userDataStr ? JSON.parse(userDataStr).user_id : 1;
      
      // Call the forecast generation API
      const result = await generateForecasts(userId, true);
      
      console.log('Forecast generation result:', result);
      
      if (result.status === 'success') {
        setAlgorithmSuccess(true);
        
        // Format the forecasts and update the state in the parent component
        const formattedForecasts = formatForecasts(result.forecasts);
        console.log('Formatted forecasts:', formattedForecasts);
        
        // Update forecasts in the parent component if callback is provided
        if (updateForecasts) {
          updateForecasts(formattedForecasts);
        }
        
        // Refresh the saved forecasts display
        setForecastFilters(prev => ({...prev})); // Trigger a re-fetch
      } else {
        setAlgorithmError('Failed to generate forecasts. Please try again.');
      }
    } catch (error) {
      console.error('Error running algorithm:', error);
      setAlgorithmError('An error occurred while generating forecasts. Please try again.');
    } finally {
      setAlgorithmLoading(false);
    }
  };

  // Helper function to sort the table
  const toggleSort = (field: string) => {
    setForecastFilters(prev => ({
      ...prev,
      sortField: field,
      sortDirection: 
        prev.sortField === field && prev.sortDirection === 'asc' 
          ? 'desc' 
          : 'asc'
    }));
  };

  // Helper function to format date strings
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      
      // Explicitly format with timezone adjustment
      return new Intl.DateTimeFormat('es-ES', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Europe/Madrid'
      }).format(date);
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString;
    }
  };

  // Component for column header with sort
  const SortableHeader = ({ field, label }: { field: string, label: string }) => (
    <th 
      className="pb-4 cursor-pointer hover:text-white transition-colors"
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{label}</span>
        {forecastFilters.sortField === field && (
          forecastFilters.sortDirection === 'asc' 
            ? <ChevronUp className="w-4 h-4" />
            : <ChevronDown className="w-4 h-4" />
        )}
      </div>
    </th>
  );

  switch (activeTab) {
    case 'dashboard1':
      return (
        <>
          <div className="glass-card rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Energy Price Data</h2>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-400">
                  {priceData.length} data points available
                </div>
                <button
                  onClick={() => console.log('Price data:', priceData)}
                  className="px-3 py-1 bg-primary-600/30 rounded-lg text-white hover:bg-primary-600/50 transition-colors text-sm"
                >
                  Debug Data
                </button>
              </div>
            </div>
            
            {/* Data summary for debugging */}
            <div className="mb-4 p-3 bg-dark-800/50 rounded-lg text-xs text-gray-400 overflow-x-auto">
              <div>Date Range: {dateRange.start} to {dateRange.end}</div>
              <div>Data Points: {priceData.length}</div>
              <div>
                Types: {priceData.some(d => d.clearedHighPrice !== undefined) ? 'Cleared ' : ''}
                {priceData.some(d => d.forecastedHighNordpool !== undefined) ? 'Nordpool ' : ''}
                {priceData.some(d => d.lumaraxHighForecast !== undefined) ? 'LumaraX' : ''}
              </div>
            </div>
            
            {/* Price Chart */}
            <PriceChart data={priceData} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="glass-card rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Place Buy Trade</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300">Execution Date</label>
                  <input
                    type="date"
                    value={selectedTimeWindow.date}
                    min={new Date().toISOString().split('T')[0]}
                    max={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    onChange={(e) => setSelectedTimeWindow(prev => ({ ...prev, date: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border-gray-600 bg-dark-800/50 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Execution Time</label>
                  <select
                    value={selectedTimeWindow.time}
                    onChange={(e) => setSelectedTimeWindow(prev => ({ ...prev, time: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border-gray-600 bg-dark-800/50 text-white"
                  >
                    {getValidTimeOptions().map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Duration</label>
                  <select
                    value={selectedTimeWindow.duration}
                    onChange={(e) => setSelectedTimeWindow(prev => ({ ...prev, duration: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border-gray-600 bg-dark-800/50 text-white"
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Quantity (MWh)</label>
                  <input
                    type="number"
                    className="mt-1 block w-full rounded-lg border-gray-600 bg-dark-800/50 text-white"
                    placeholder="Enter quantity"
                    max={batteryState.capacity.usable}
                    min="0.1"
                    step="0.1"
                  />
                </div>
                <button 
                  onClick={() => updateBatteryLevel('buy', 10)}
                  className="w-full bg-green-600/80 text-white py-3 px-4 rounded-lg hover:bg-green-500/80 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                >
                  Place Buy Order
                </button>
              </div>
            </div>

            <div className="glass-card rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Place Sell Trade</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300">Execution Date</label>
                  <input
                    type="date"
                    value={selectedTimeWindow.date}
                    min={new Date().toISOString().split('T')[0]}
                    max={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    onChange={(e) => setSelectedTimeWindow(prev => ({ ...prev, date: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border-gray-600 bg-dark-800/50 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Execution Time</label>
                  <select
                    value={selectedTimeWindow.time}
                    onChange={(e) => setSelectedTimeWindow(prev => ({ ...prev, time: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border-gray-600 bg-dark-800/50 text-white"
                  >
                    {getValidTimeOptions().map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Duration</label>
                  <select
                    value={selectedTimeWindow.duration}
                    onChange={(e) => setSelectedTimeWindow(prev => ({ ...prev, duration: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border-gray-600 bg-dark-800/50 text-white"
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Quantity (MWh)</label>
                  <input
                    type="number"
                    className="mt-1 block w-full rounded-lg border-gray-600 bg-dark-800/50 text-white"
                    placeholder="Enter quantity"
                    max={batteryState.capacity.usable}
                    min="0.1"
                    step="0.1"
                  />
                </div>
                <button 
                  onClick={() => updateBatteryLevel('sell', 10)}
                  className="w-full bg-red-600/80 text-white py-3 px-4 rounded-lg hover:bg-red-500/80 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                >
                  Place Sell Order
                </button>
              </div>
            </div>
          </div>

          <BatteryVisualization batteryState={batteryState} />
        </>
      );

    case 'dashboard2':
      return (
        <div className="space-y-6">
          <DateRangeFilter dateRange={dateRange} setDateRange={setDateRange} />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Total Revenue</h3>
              <p className="text-3xl font-bold text-white">€126,450</p>
              <p className="text-sm text-green-400 mt-2">+12.5% from last period</p>
            </div>

            <div className="glass-card rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Total Profit</h3>
              <p className="text-3xl font-bold text-green-400">€45,280</p>
              <p className="text-sm text-green-400 mt-2">+8.3% from last period</p>
            </div>

            <div className="glass-card rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Total Costs</h3>
              <p className="text-3xl font-bold text-red-400">€81,170</p>
              <p className="text-sm text-red-400 mt-2">+15.2% from last period</p>
            </div>

            <div className="glass-card rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Profit Margin</h3>
              <p className="text-3xl font-bold text-white">35.8%</p>
              <p className="text-sm text-yellow-400 mt-2">-2.1% from last period</p>
            </div>

            <div className="glass-card rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Total Traded Volume</h3>
              <p className="text-3xl font-bold text-white">2,450 MWh</p>
              <p className="text-sm text-green-400 mt-2">+18.5% from last period</p>
            </div>

            <div className="glass-card rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Accuracy</h3>
              <p className="text-3xl font-bold text-white">92%</p>
              <p className="text-sm text-green-400 mt-2">+3.5% from last period</p>
            </div>
          </div>

          <div className="glass-card rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Trading History</h2>
              <button className="px-4 py-2 bg-primary-600/30 rounded-lg text-white hover:bg-primary-600/50 transition-colors">
                <Download className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-400">
                    <th className="pb-4">Type</th>
                    <th className="pb-4">Price</th>
                    <th className="pb-4">Quantity</th>
                    <th className="pb-4">Time</th>
                    <th className="pb-4">Profit/Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade) => (
                    <tr key={trade.id} className="border-t border-gray-700">
                      <td className="py-4">
                        <span className={`px-3 py-1 rounded-full text-sm ${
                          trade.type === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {trade.type}
                        </span>
                      </td>
                      <td className="py-4">€{trade.price.toFixed(2)}</td>
                      <td className="py-4">{trade.quantity} MWh</td>
                      <td className="py-4">{new Date(trade.timestamp).toLocaleString()}</td>
                      <td className={`py-4 ${trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(2)}€
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );

    case 'algorithm':
      return (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <DateRangeFilter dateRange={dateRange} setDateRange={setDateRange} />
            <button
              onClick={runAlgorithm}
              disabled={algorithmLoading}
              className={`px-6 py-3 rounded-lg text-white flex items-center space-x-2 transition-colors ${
                algorithmLoading ? 'bg-gray-600 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-500'
              }`}
            >
              {algorithmLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating Forecasts...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Run AlgorithmX manually</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Algorithm Status</h3>
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full ${algorithmLoading ? 'bg-yellow-400' : algorithmSuccess ? 'bg-green-400' : 'bg-green-400'} mr-2`}></div>
                  <span className={algorithmLoading ? 'text-yellow-400' : algorithmSuccess ? 'text-green-400' : 'text-green-400'}>
                    {algorithmLoading ? 'Running' : algorithmSuccess ? 'Forecast Generated' : 'Active'}
                  </span>
                </div>
              </div>
              
              {algorithmError && (
                <div className="mt-2 p-3 bg-red-500/20 border border-red-500/50 rounded-md text-red-400">
                  {algorithmError}
                </div>
              )}
              
              {algorithmSuccess && (
                <div className="mt-2 p-3 bg-green-500/20 border border-green-500/50 rounded-md text-green-400">
                  Forecasts successfully generated and saved to the database!
                </div>
              )}
            </div>

            <div className="glass-card rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Performance Metrics</h3>
                <LineChart className="w-5 h-5 text-primary-400" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">ROI</span>
                  <span className="text-green-400">+18.5%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Accuracy</span>
                  <span className="text-white">92%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Forecasts Database</h2>
              <div className="flex space-x-4">
                <button className="px-4 py-2 bg-primary-600/30 rounded-lg text-white hover:bg-primary-600/50 transition-colors">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filters Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Resolution</label>
                <select
                  value={forecastFilters.resolution}
                  onChange={(e) => setForecastFilters({...forecastFilters, resolution: e.target.value})}
                  className="w-full rounded-lg border border-gray-700 bg-dark-800/50 text-white px-3 py-2"
                >
                  <option value="">All Resolutions</option>
                  <option value="15">15 Minutes</option>
                  <option value="30">30 Minutes</option>
                  <option value="60">60 Minutes</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Date</label>
                <input
                  type="date"
                  value={forecastFilters.date}
                  onChange={(e) => setForecastFilters({...forecastFilters, date: e.target.value})}
                  className="w-full rounded-lg border border-gray-700 bg-dark-800/50 text-white px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Show Records</label>
                <select
                  value={forecastFilters.limit}
                  onChange={(e) => setForecastFilters({...forecastFilters, limit: parseInt(e.target.value)})}
                  className="w-full rounded-lg border border-gray-700 bg-dark-800/50 text-white px-3 py-2"
                >
                  <option value="10">10 Records</option>
                  <option value="20">20 Records</option>
                  <option value="50">50 Records</option>
                  <option value="100">100 Records</option>
                </select>
              </div>

              <div className="flex items-end">
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={forecastFilters.activeOnly}
                    onChange={(e) => setForecastFilters({...forecastFilters, activeOnly: e.target.checked})}
                    className="rounded border-gray-700 bg-dark-800/50 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-gray-300">Active forecasts only</span>
                </label>
              </div>
            </div>

            {forecastsError && (
              <div className="p-4 mb-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
                {forecastsError}
              </div>
            )}

            {/* Loading state */}
            {forecastsLoading && (
              <div className="flex justify-center items-center p-8">
                <RefreshCw className="w-8 h-8 animate-spin text-primary-400" />
                <span className="ml-3 text-gray-400">Loading forecasts...</span>
              </div>
            )}
            
            {/* Table */}
            {!forecastsLoading && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-gray-400">
                      <SortableHeader field="timestamp" label="Timestamp" />
                      <SortableHeader field="resolution_minutes" label="Resolution" />
                      <SortableHeader field="min_value" label="Low Price" />
                      <SortableHeader field="max_value" label="High Price" />
                      <SortableHeader field="avg_value" label="Avg Price" />
                      <SortableHeader field="generated_at" label="Generated" />
                      <th className="pb-4">Confidence</th>
                      <th className="pb-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedForecasts.length > 0 ? (
                      sortedForecasts.map((forecast) => {
                        // Calculate confidence percentage based on range
                        const priceRange = forecast.max_value - forecast.min_value;
                        const confidenceRange = forecast.confidence_upper - forecast.confidence_lower;
                        const confidencePercentage = priceRange > 0 
                          ? 100 - (confidenceRange / priceRange * 50)
                          : 95;

                        return (
                          <tr key={forecast.forecast_id} className="border-t border-gray-700">
                            <td className="py-4">{formatDate(forecast.timestamp)}</td>
                            <td className="py-4">
                              <span className={`px-3 py-1 rounded-full text-xs ${
                                forecast.resolution_minutes === 15 ? 'bg-blue-500/20 text-blue-400' :
                                forecast.resolution_minutes === 30 ? 'bg-green-500/20 text-green-400' :
                                'bg-purple-500/20 text-purple-400'
                              }`}>
                                {forecast.resolution_minutes} min
                              </span>
                            </td>
                            <td className="py-4">€{forecast.min_value.toFixed(2)}</td>
                            <td className="py-4">€{forecast.max_value.toFixed(2)}</td>
                            <td className="py-4">€{forecast.avg_value.toFixed(2)}</td>
                            <td className="py-4 text-sm text-gray-400">{formatDate(forecast.generated_at)}</td>
                            <td className="py-4">{confidencePercentage.toFixed(1)}%</td>
                            <td className="py-4">
                              <span className={`px-3 py-1 rounded-full text-xs ${
                                forecast.is_active
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-red-500/20 text-red-400'
                              }`}>
                                {forecast.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-400">
                          No forecasts found matching your filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination info */}
            <div className="mt-4 text-sm text-gray-400">
              Showing {sortedForecasts.length} of {totalForecasts} forecasts
            </div>
          </div>
        </div>
      );

    case 'history':
      return (
        <div className="space-y-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-white">Market Data History</h2>
            <button className="px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-white text-sm flex items-center transition-colors">
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
          
          {/* Filter and Search Controls - Redesigned */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Date Range</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <label className="absolute -top-2.5 left-3 bg-dark-900 px-1 text-xs text-gray-400">From</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-gray-700 bg-dark-800/50 text-white px-3 py-2.5"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  />
                </div>
                <div className="relative">
                  <label className="absolute -top-2.5 left-3 bg-dark-900 px-1 text-xs text-gray-400">To</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-gray-700 bg-dark-800/50 text-white px-3 py-2.5"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Resolution</label>
              <div className="relative">
                <select 
                  className="w-full rounded-lg border border-gray-700 bg-dark-800/50 text-white px-3 py-2.5 appearance-none"
                  value={marketDataResolution}
                  onChange={(e) => setMarketDataResolution(e.target.value)}
                >
                  <option value="">All Resolutions</option>
                  <option value="15min">15 Minutes</option>
                  <option value="30min">30 Minutes</option>
                  <option value="1h">1 Hour</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <button className="mt-2 px-3 py-1.5 bg-primary-600/30 hover:bg-primary-600/50 rounded text-white text-sm w-full transition-colors"
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setDateRange({ start: today, end: today });
                }}
              >
                Today
              </button>
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Price Range</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <label className="absolute -top-2.5 left-3 bg-dark-900 px-1 text-xs text-gray-400">Min</label>
                  <input 
                    type="number" 
                    placeholder="0" 
                    className="w-full rounded-lg border border-gray-700 bg-dark-800/50 text-white px-3 py-2.5"
                    value={marketDataPriceMin}
                    onChange={(e) => setMarketDataPriceMin(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <label className="absolute -top-2.5 left-3 bg-dark-900 px-1 text-xs text-gray-400">Max</label>
                  <input 
                    type="number" 
                    placeholder="1000" 
                    className="w-full rounded-lg border border-gray-700 bg-dark-800/50 text-white px-3 py-2.5"
                    value={marketDataPriceMax}
                    onChange={(e) => setMarketDataPriceMax(e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Search</label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Search market data..." 
                  className="w-full rounded-lg border border-gray-700 bg-dark-800/50 text-white pl-10 pr-3 py-2.5"
                  value={marketDataSearch}
                  onChange={(e) => setMarketDataSearch(e.target.value)}
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>
          
          {/* Data Table - Redesigned */}
          <div className="bg-dark-800/30 rounded-lg overflow-hidden border border-gray-700">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-dark-800/50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Resolution</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Delivery Period</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Low Price</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">High Price</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Average</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Open</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Close</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Volume</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Market</th>
                  </tr>
                </thead>
                <tbody className="bg-dark-900/30 divide-y divide-gray-700">
                  {paginatedMarketData.map((item, index) => (
                    <tr key={item.id} className={`hover:bg-dark-700/30 transition-colors ${index % 2 === 0 ? 'bg-dark-800/10' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{item.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          item.resolution === '15min' ? 'bg-blue-500/20 text-blue-400' :
                          item.resolution === '30min' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-pink-500/20 text-pink-400'
                        }`}>
                          {item.resolution}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{item.deliveryPeriod}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">€{item.lowPrice.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">€{item.highPrice.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">€{item.averagePrice.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">€{item.openPrice?.toFixed(2) || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">€{item.closePrice.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{item.volume.toFixed(0)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{item.market || 'Germany'}</td>
                    </tr>
                  ))}
                  {filteredMarketData.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-6 py-8 text-center text-gray-400">
                        No market data available matching your filters. Try adjusting your search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Results summary and pagination */}
          <div className="flex justify-between items-center text-sm text-gray-400">
            <div>
              Showing {paginatedMarketData.length} of {filteredMarketData.length} records (Page {currentPage} of {totalPages})
            </div>
            <div className="flex space-x-2">
              <button 
                className={`px-3 py-1 rounded border ${
                  currentPage === 1 
                    ? 'bg-dark-800/30 border-gray-800 text-gray-500 cursor-not-allowed' 
                    : 'bg-dark-800/50 hover:bg-dark-700/50 border-gray-700 text-white'
                }`}
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              
              {getPageNumbers().map(page => (
                <button 
                  key={page}
                  className={`px-3 py-1 rounded border ${
                    currentPage === page 
                      ? 'bg-primary-600/50 hover:bg-primary-600/70 border-primary-700 text-white' 
                      : 'bg-dark-800/50 hover:bg-dark-700/50 border-gray-700 text-white'
                  }`}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </button>
              ))}
              
              <button 
                className={`px-3 py-1 rounded border ${
                  currentPage === totalPages 
                    ? 'bg-dark-800/30 border-gray-800 text-gray-500 cursor-not-allowed' 
                    : 'bg-dark-800/50 hover:bg-dark-700/50 border-gray-700 text-white'
                }`}
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      );

    case 'guide':
      return (
        <div className="space-y-6">
          <div className="glass-card rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Quick Start Guide</h2>
              <Book className="w-6 h-6 text-primary-400" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 rounded-lg bg-dark-800/30">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-primary-600/30 flex items-center justify-center">
                    <span className="text-primary-400 font-semibold">1</span>
                  </div>
                  <h3 className="text-white font-medium">Getting Started</h3>
                </div>
                <p className="text-gray-400 text-sm">Learn the basics of the platform and how to navigate through different sections.</p>
              </div>
              <div className="p-4 rounded-lg bg-dark-800/30">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-primary-600/30 flex items-center justify-center">
                    <span className="text-primary-400 font-semibold">2</span>
                  </div>
                  <h3 className="text-white font-medium">Trading Basics</h3>
                </div>
                <p className="text-gray-400 text-sm">Understand how to place trades and manage your positions effectively.</p>
              </div>
              <div className="p-4 rounded-lg bg-dark-800/30">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-primary-600/30 flex items-center justify-center">
                    <span className="text-primary-400 font-semibold">3</span>
                  </div>
                  <h3 className="text-white font-medium">Advanced Features</h3>
                </div>
                <p className="text-gray-400 text-sm">Explore advanced trading features and algorithmic capabilities.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">Trading Guidelines</h2>
                <Lightbulb className="w-6 h-6 text-primary-400" />
              </div>
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-dark-800/30">
                  <h3 className="text-white font-medium mb-2">Risk Management</h3>
                  <ul className="list-disc list-inside text-gray-400 text-sm space-y-2">
                    <li>Always set stop-loss orders</li>
                    <li>Don&apos;t risk more than 2% per trade</li>
                    <li>Maintain a balanced portfolio</li>
                    <li>Monitor market volatility</li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg bg-dark-800/30">
                  <h3 className="text-white font-medium mb-2">Best Practices</h3>
                  <ul className="list-disc list-inside text-gray-400 text-sm space-y-2">
                    <li>Keep detailed trading records</li>
                    <li>Review performance regularly</li>
                    <li>Stay updated with market news</li>
                    <li>Follow your trading plan</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">FAQ</h2>
                <HelpCircle className="w-6 h-6 text-primary-400" />
              </div>
              <div className="space-y-4">
                {[
                  {
                    question: "How do I start trading?",
                    answer: "Begin by reviewing the Quick Start Guide and setting up your trading parameters in the Algorithm section."
                  },
                  {
                    question: "What are the trading hours?",
                    answer: "Trading is available 24/7, but the most active periods are during European market hours."
                  },
                  {
                    question: "How is profit calculated?",
                    answer: "Profits are calculated based on the difference between buy and sell prices, minus any applicable fees."
                  },
                  {
                    question: "Is the platform secure?",
                    answer: "Yes, we implement industry-standard security measures and regular security audits."
                  }
                ].map((item, index) => (
                  <div key={index} className="p-4 rounded-lg bg-dark-800/30">
                    <h3 className="text-white font-medium mb-2">{item.question}</h3>
                    <p className="text-gray-400 text-sm">{item.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    
    default:
      return null;
  }
};