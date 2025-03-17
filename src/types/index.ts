export type Tab = 'dashboard1' | 'dashboard2' | 'history' | 'guide' | 'algorithm';

export interface BatteryState {
  level: number;
  history: { time: string; level: number }[];
  capacity: {
    total: number;
    usable: number;
    percentage: number;
  };
}

export interface PriceData {
  time: string;
  clearedHighPrice?: number;
  forecastedHighNordpool?: number;
  lumaraxHighForecast?: number;
  clearedLowPrice?: number;
  forecastedLowNordpool?: number;
  lumaraxLowForecast?: number;
  buyTrade?: {
    price: number;
    quantity: number;
  };
  sellTrade?: {
    price: number;
    quantity: number;
  };
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