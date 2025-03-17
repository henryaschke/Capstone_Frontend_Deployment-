import React from 'react';

interface CustomTradeMarkerProps {
  type: 'buy' | 'sell';
  price: number;
  quantity: number;
}

export const CustomTradeMarker: React.FC<CustomTradeMarkerProps> = ({ type, price, quantity }) => {
  const color = type === 'buy' ? '#22c55e' : '#ef4444';
  
  return (
    <g filter={type === 'buy' ? 'url(#buyGlow)' : 'url(#sellGlow)'}>
      <circle 
        cx="0" 
        cy="0" 
        r="6" 
        fill={color} 
      />
      <text
        x="0"
        y="-15"
        textAnchor="middle"
        fill={color}
        fontSize="12"
      >
        {`${type === 'buy' ? '↑' : '↓'} ${quantity} MWh`}
      </text>
      <text
        x="0"
        y="-3"
        textAnchor="middle"
        fill={color}
        fontSize="12"
      >
        €{price.toFixed(2)}
      </text>
    </g>
  );
};