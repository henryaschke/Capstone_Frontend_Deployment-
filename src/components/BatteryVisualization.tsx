import React from 'react';
import { Battery } from 'lucide-react';
import type { BatteryState } from '../types';

interface BatteryVisualizationProps {
  batteryState: BatteryState;
}

export const BatteryVisualization: React.FC<BatteryVisualizationProps> = ({ batteryState }) => {
  return (
    <div className="glass-card rounded-lg p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Battery Status</h2>
        <Battery className="w-6 h-6 text-primary-400" />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="battery-container h-48 rounded-lg relative">
          <div 
            className="battery-level absolute bottom-0 w-full transition-all duration-500"
            style={{ height: `${batteryState.level}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">
              {batteryState.level.toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-400">Total Capacity</p>
            <p className="text-lg font-semibold text-white">{batteryState.capacity.total} MWh</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Usable Capacity</p>
            <p className="text-lg font-semibold text-white">{batteryState.capacity.usable} MWh</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Usable Capacity</p>
            <p className="text-lg font-semibold text-white">{batteryState.capacity.percentage}%</p>
          </div>
        </div>
      </div>
    </div>
  );
};