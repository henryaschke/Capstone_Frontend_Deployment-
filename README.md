# Energy Trading Platform Frontend

**Author:** Henry Aschke

*This project was inspired by the Venture Lab program and created under the guidance of Solomon Shiferaw in the "Capstone Integration Project" at IE University.*

A modern, responsive web application for energy trading, featuring real-time market data visualization, battery management, trading capabilities, and advanced analytics.

## Features

- 📊 **Interactive Price Visualization**
  - Multi-resolution real-time price charts (15min, 30min, 60min)
  - Interactive time period selection with date range filtering
  - Custom trade markers with execution visualization
  - Price forecast overlay with confidence intervals
  - Historical vs. real-time data comparison
  - Automatic data refresh and caching mechanisms
  - Multi-market data support (Germany extensible to other markets)

- 🔋 **Battery Management Dashboard**
  - Real-time battery status visualization with percentage and absolute values
  - Historical battery level tracking with time-series charts
  - Interactive charge/discharge controls with validation
  - Automatic capacity optimization suggestions
  - Battery state synchronization with trade execution
  - Battery performance analytics and utilization metrics

- 💹 **Trading Interface**
  - Real-time trade execution scheduling with timing validation
  - Comprehensive trade history with filtering capabilities
  - Automated trading controls with customizable parameters
  - Pending trade management (execution, cancellation)
  - Portfolio balance management with deposit/withdrawal
  - Trade execution visualization on price charts
  - Trade profitability tracking and analysis

- 📈 **Market Analysis Tools**
  - Price forecasting visualization with multiple models
  - Market trend identification and visualization
  - Historical data comparison across time periods
  - Price anomaly detection and highlighting
  - Technical indicators and market patterns
  - Market volatility analysis and visualization
  - Multi-resolution data aggregation and comparison

- 📱 **Responsive User Interface**
  - Adaptive layout for desktop, tablet, and mobile devices
  - Dark/light mode support for different environments
  - Real-time notifications for trade execution and system status
  - Keyboard shortcuts for power users
  - Tabbed interface for efficient workflow management
  - Tooltip guidance for complex features
  - Accessibility compliance with WCAG standards

- 🔒 **Authentication & User Management**
  - Secure JWT-based authentication
  - User registration with email validation
  - User profile management
  - Role-based access control
  - Session management with automatic refresh
  - Secure password handling
  - Login persistence with token storage

- 📊 **Performance Analytics**
  - Comprehensive revenue and profit visualization
  - Time-series performance charts with customizable periods
  - Trading volume and count metrics
  - Profit margin calculations and tracking
  - Strategy performance comparison
  - Export capabilities for reporting

- 🔄 **Real-time Data Synchronization**
  - WebSocket/polling for live data updates
  - Intelligent caching to minimize API calls
  - Offline mode with data persistence
  - Automatic reconnection handling
  - Data synchronization across multiple tabs/devices
  - Loading state management for smooth user experience

## Components

### Core Components
- `Dashboard.tsx` - Main application dashboard with tabbed interface
- `PriceChart.tsx` - Interactive chart for price visualization with trade markers
- `TabContent.tsx` - Content manager for dashboard tabs
- `SessionTimer.tsx` - Session management and timeout handling
- `ProtectedRoute.tsx` - Authentication wrapper for protected routes

### Feature Components
- `BatteryVisualization.tsx` - Battery status visualization with capacity tracking
- `CustomTradeMarker.tsx` - Trade execution visualization on price charts
- `DateRangeFilter.tsx` - Time period selection with calendar integration
- `TradeHistory.tsx` - Comprehensive trade history with filtering
- `TradeForm.tsx` - Trade execution form with validation
- `PerformanceChart.tsx` - Performance visualization with metrics
- `MarketDataTable.tsx` - Tabular market data visualization
- `ForecastOverlay.tsx` - Price forecast visualization on charts
- `PortfolioBalance.tsx` - Portfolio management with transactions
- `NotificationCenter.tsx` - System notifications and alerts

### Page Components
- `Login.tsx` - User authentication interface
- `Register.tsx` - User registration with validation
- `Dashboard.tsx` - Main application interface
- `Profile.tsx` - User profile management

### Utility Components
- `Tooltip.tsx` - Contextual help and information
- `Modal.tsx` - Reusable modal dialog
- `Spinner.tsx` - Loading state indication
- `ErrorBoundary.tsx` - Error handling and reporting
- `Toast.tsx` - Temporary notifications

## API Services

### Authentication Services
- `register()` - User registration
- `login()` - User authentication
- `logout()` - Session termination
- `refreshToken()` - Authentication token refresh
- `getCurrentUser()` - Current user information
- `getUserProfile()` - Detailed user profile

### Market Data Services
- `fetchPriceData()` - Get price data with caching
- `fetchMarketData()` - Get market data with parameters
- `generateSamplePriceData()` - Generate fallback data

### Battery Services
- `fetchBatteryStatus()` - Get current battery status
- `fetchBatteryHistory()` - Get historical battery levels
- `chargeBattery()` - Execute battery charge
- `dischargeBattery()` - Execute battery discharge

### Trading Services
- `executeTrade()` - Schedule trade for execution
- `executeAllPendingTrades()` - Execute all pending trades
- `cancelAllPendingTrades()` - Cancel all pending trades
- `fetchTradeHistory()` - Get trading history with filtering
- `cancelTrade()` - Cancel specific pending trade
- `getTradeById()` - Get specific trade details

### Forecasting Services
- `generateForecasts()` - Generate price forecasts
- `fetchSavedForecasts()` - Get saved forecasts
- `formatForecasts()` - Process forecast data

### Performance Services
- `fetchPerformanceMetrics()` - Get performance analytics

## Tech Stack

- **Frontend Framework**: React with TypeScript
- **State Management**: React Context API
- **UI Components**: Chakra UI
- **Styling**: Tailwind CSS
- **Charts**: Chart.js with custom extensions
- **Build Tool**: Vite for fast development
- **HTTP Client**: Axios with interceptors
- **Authentication**: JWT with secure storage
- **Date Handling**: date-fns for manipulation
- **Form Handling**: React Hook Form with validation

## Setup & Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## Docker Deployment

Build and run using Docker:
```bash
docker build -t energy-trading-frontend .
docker run -p 3000:3000 energy-trading-frontend
```

## Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run test` - Run tests

### Project Structure
```
frontend/
├── src/
│   ├── components/     # React components
│   ├── pages/          # Page components
│   ├── hooks/          # Custom React hooks
│   ├── services/       # API services
│   ├── utils/          # Utility functions
│   ├── context/        # React context providers
│   └── types/          # TypeScript types
├── public/             # Static assets
└── scripts/            # Build and deployment scripts
```

## Testing

Run tests using:
```bash
npm test
```

## Performance Optimization

- Component memoization for expensive renders
- Virtualized lists for large datasets
- Lazy loading for code splitting
- API response caching
- Debounced inputs for search fields
- Image optimization for assets

## Browser Compatibility

- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - See LICENSE file for details 