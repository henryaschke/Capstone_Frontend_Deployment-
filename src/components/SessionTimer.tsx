import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { refreshToken } from '../services/api';

interface SessionTimerProps {
  warningThreshold?: number; // Time in minutes to show warning before expiry
}

const SessionTimer: React.FC<SessionTimerProps> = ({ warningThreshold = 5 }) => {
  const { currentUser, handleLogout, setCurrentUser } = useAuth();
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [showExtendOption, setShowExtendOption] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser?.access_token) return;

    // Decode the JWT token to get expiration time
    const parseJwt = (token: string): any => {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        return JSON.parse(jsonPayload);
      } catch (error) {
        console.error('Error parsing JWT token:', error);
        return null;
      }
    };

    const tokenData = parseJwt(currentUser.access_token);
    if (!tokenData?.exp) return;

    const warningThresholdMs = warningThreshold * 60 * 1000;

    // Update remaining time every second
    const interval = setInterval(() => {
      const expiryTime = tokenData.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const remaining = expiryTime - now;

      setTimeRemaining(remaining > 0 ? remaining : 0);

      // Show warning when approaching expiry
      if (remaining > 0 && remaining <= warningThresholdMs) {
        setShowWarning(true);
        setShowExtendOption(true);
      } else if (remaining <= 0) {
        // Handle expired session
        handleLogout(true);
        clearInterval(interval);
      } else {
        setShowWarning(false);
        setShowExtendOption(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentUser, handleLogout, warningThreshold]);

  // Format remaining time as mm:ss
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Function to extend session
  const extendSession = async () => {
    try {
      // Show loading state
      setIsRefreshing(true);
      setShowExtendOption(false);
      setRefreshError(null);
      
      // Call the backend to refresh the token
      const newToken = await refreshToken();
      
      if (newToken) {
        // If token refresh was successful, update the current user in auth context
        setCurrentUser(newToken);
        // Reset the warning and option flags - the useEffect will handle updating the timer
        setShowWarning(false);
        console.log('Session extended successfully');
      } else {
        // If token refresh failed, keep showing the warning
        setShowExtendOption(true);
        setRefreshError('Failed to extend session. Please try again or log in again.');
        console.error('Failed to extend session');
      }
    } catch (error) {
      console.error('Error extending session:', error);
      setShowExtendOption(true);
      setRefreshError('An error occurred while extending your session.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Don't render anything if no token or not near expiry
  if (!showWarning || !timeRemaining) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-amber-600/90 text-white px-4 py-3 rounded-lg shadow-lg z-50 max-w-md">
      <div className="flex items-start">
        <Clock className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="font-medium">Your session is about to expire</h3>
          <p className="text-sm mt-1">
            You will be logged out in <span className="font-bold">{formatTime(timeRemaining)}</span>
          </p>
          
          {refreshError && (
            <p className="text-sm mt-1 text-red-200 bg-red-900/30 p-1 rounded">
              {refreshError}
            </p>
          )}
          
          {isRefreshing ? (
            <div className="mt-2 flex items-center">
              <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
              <span className="text-sm">Extending session...</span>
            </div>
          ) : showExtendOption && (
            <button
              onClick={extendSession}
              className="mt-2 bg-white/20 hover:bg-white/30 rounded px-3 py-1 text-sm flex items-center"
            >
              <RefreshCw className="w-3 h-3 mr-2" />
              Extend Session
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionTimer; 