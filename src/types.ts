export type Tab = 'dashboard1' | 'dashboard2' | 'history' | 'guide' | 'algorithm' | 'battery';

export interface BatteryState {
  level: number;
  history: {
    time: string;
    level: number;
  }[];
  capacity: {
    total: number;
    usable: number;
    percentage: number;
  };
  chargingState?: 'charging' | 'discharging' | 'idle';
  chargingRate?: number; // in MWh per hour, positive for charging, negative for discharging
}

export interface PriceData {
  time: string;
  clearedHighPrice?: number | null;
  clearedLowPrice?: number | null;
  forecastedHighNordpool?: number | null;
  forecastedLowNordpool?: number | null;
  cleared30HighPrice?: number | null;
  cleared30LowPrice?: number | null;
  forecasted30HighNordpool?: number | null;
  forecasted30LowNordpool?: number | null;
  cleared60HighPrice?: number | null;
  cleared60LowPrice?: number | null;
  forecasted60HighNordpool?: number | null;
  forecasted60LowNordpool?: number | null;
  lumaraxHighForecast?: number | null;
  lumaraxLowForecast?: number | null;
  deliveryPeriod?: string;
  market?: string;
  cleared?: boolean;
  buyTrade?: {
    price: number;
    quantity: number;
  };
  sellTrade?: {
    price: number;
    quantity: number;
  };
  vwap?: number | null;
  vwap3h?: number | null;
  vwap1h?: number | null;
  open?: number | null;
  close?: number | null;
  buyVolume?: number | null;
  sellVolume?: number | null;
  transactionVolume?: number | null;
  contractOpenTime?: string | null;
  contractCloseTime?: string | null;
  id?: string | null;
  deliveryDay?: string | null;
  resolutionMinutes?: number | null;
}

export interface Trade {
  id: string;
  type: 'buy' | 'sell';
  price: number;
  quantity: number;
  timestamp: string;
  executionTime: string;
  profit: number;
  resolution: string;
  deliveryPeriod: string;
  averagePrice: number;
  closePrice: number;
  volume: number;
  status?: 'pending' | 'executed' | 'failed' | 'completed' | 'cancelled';
  errorMessage?: string;
}

export interface DateRange {
  start: string;
  end: string;
}

export interface MarketData {
  id: string;
  date: string;
  resolution: string;
  deliveryPeriod: string;
  lowPrice: number;
  highPrice: number;
  averagePrice: number;
  closePrice: number;
  volume: number;
  openPrice?: number;
  buyVolume?: number;
  sellVolume?: number;
  market?: string;
  contractOpenTime?: string;
  contractCloseTime?: string;
  vwap1h?: number;
  vwap3h?: number;
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