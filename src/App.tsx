import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { LayoutDashboard, LineChart, History, Battery, Calendar, Download, HelpCircle, Book, Lightbulb, AlertCircle, Zap, Clock, Globe, Sparkles, Search, CalendarDays, LogIn, UserPlus, LogOut, User } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart as RechartsLineChart, Line, Legend, ReferenceLine, Label } from 'recharts';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import SessionTimer from './components/SessionTimer';
import { useAuth } from './context/AuthContext';
import { logout } from './services/api';

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, isAuthenticated, handleLogout } = useAuth();
  const [sessionTimeoutNotice, setSessionTimeoutNotice] = useState<string | null>(null);
  
  // Check if we're on an auth page
  const isAuthPage = ['/login', '/register'].includes(location.pathname);

  // Redirect to dashboard if authenticated and on login/register page
  useEffect(() => {
    if (isAuthenticated && isAuthPage) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, isAuthPage, navigate]);

  // Check for session timeout message in URL (e.g., /login?timeout=true)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const timeout = params.get('timeout');
    if (timeout === 'true' && location.pathname === '/login') {
      setSessionTimeoutNotice("Your session has expired due to inactivity. Please log in again.");
    } else {
      setSessionTimeoutNotice(null);
    }
  }, [location]);

  // Only render auth pages without header if on auth page
  if (isAuthPage) {
    return (
      <div className="min-h-screen text-white">
        <div className="background-effects" />
        {sessionTimeoutNotice && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 max-w-md w-full bg-amber-600/80 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            <span>{sessionTimeoutNotice}</span>
          </div>
        )}
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <div className="background-effects" />
      
      <header className="bg-dark-900/50 backdrop-blur-md border-b border-primary-700/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-500 via-cyan-400 to-teal-300 rounded-lg p-2">
                <Sparkles className="w-6 h-6 text-dark-900" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-200 text-transparent bg-clip-text">
                  LumaraX
                </h1>
                <p className="text-xs text-primary-400">Intelligent Energy Trading</p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-4">
                {isAuthenticated ? (
                  <>
                    <div className="flex items-center space-x-2 text-primary-300">
                      <User className="w-4 h-4" />
                      <span>{currentUser?.email}</span>
                    </div>
                    <button
                      onClick={() => handleLogout()}
                      className="flex items-center space-x-2 px-4 py-2 bg-red-600/30 rounded-lg text-white hover:bg-red-600/50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className="flex items-center space-x-2 px-4 py-2 bg-primary-600/30 rounded-lg text-white hover:bg-primary-600/50 transition-colors"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Login</span>
                    </Link>
                    <Link
                      to="/register"
                      className="flex items-center space-x-2 px-4 py-2 bg-primary-600 rounded-lg text-white hover:bg-primary-500 transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Register</span>
                    </Link>
                  </>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Globe className="w-5 h-5 text-primary-400" />
                <select className="bg-transparent border-none text-primary-200 focus:outline-none">
                  <option value="germany">Market: Germany</option>
                  <option value="uk" disabled>Market: UK (Coming Soon)</option>
                  <option value="spain" disabled>Market: Spain (Coming Soon)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </header>

      {isAuthenticated && <SessionTimer warningThreshold={1} />}

      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
}

export default App;