import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getCurrentUser, AuthResponse, logout } from '../services/api';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  currentUser: AuthResponse | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<AuthResponse | null>>;
  isAuthenticated: boolean;
  handleLogout: (isTimeout?: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthResponse | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [lastActivity, setLastActivity] = useState<Date>(new Date());
  const navigate = useNavigate();

  // Function to handle user logout
  const handleLogout = (isTimeout?: boolean) => {
    logout();
    setCurrentUser(null);
    setIsAuthenticated(false);
    
    // If session timed out, redirect with timeout parameter
    if (isTimeout) {
      navigate('/login?timeout=true');
    } else {
      navigate('/login');
    }
  };

  // Check if user is already logged in when app loads
  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      // Verify if the token has expired
      const tokenData = parseJwt(user.access_token);
      const currentTime = Math.floor(Date.now() / 1000);
      
      if (tokenData && tokenData.exp && tokenData.exp > currentTime) {
        setCurrentUser(user);
        setIsAuthenticated(true);
        setLastActivity(new Date());
      } else {
        // Token has expired, log the user out with timeout message
        handleLogout(true);
      }
    }
  }, []);

  // Update isAuthenticated state whenever currentUser changes
  useEffect(() => {
    setIsAuthenticated(!!currentUser);
  }, [currentUser]);

  // Setup user activity tracking
  useEffect(() => {
    if (!isAuthenticated) return;

    // Update last activity timestamp when user interacts with the app
    const updateActivity = () => {
      console.log('User activity detected, updating last activity timestamp');
      setLastActivity(new Date());
    };
    
    // Track user activity events
    window.addEventListener('mousedown', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('touchstart', updateActivity);
    window.addEventListener('scroll', updateActivity);

    // Check for session timeout every minute
    const intervalId = setInterval(() => {
      if (!currentUser) return;
      
      const currentTime = new Date();
      const inactiveTime = currentTime.getTime() - lastActivity.getTime();
      const sessionTimeoutMs = 5 * 60 * 1000; // 5 minutes in milliseconds
      
      // If user has been inactive for longer than the timeout period
      if (inactiveTime > sessionTimeoutMs) {
        console.log('Session timeout due to inactivity');
        handleLogout(true);
      }
      
      // Also check if the token has expired
      const tokenData = parseJwt(currentUser.access_token);
      const nowInSeconds = Math.floor(Date.now() / 1000);
      
      // Warn when within 5 minutes of expiration (handled by SessionTimer)
      // Only log out if actually expired
      if (tokenData && tokenData.exp && tokenData.exp <= nowInSeconds) {
        console.log('Session timeout due to token expiration');
        handleLogout(true);
      }
    }, 60000); // Check every minute

    return () => {
      // Cleanup event listeners and interval
      window.removeEventListener('mousedown', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      clearInterval(intervalId);
    };
  }, [isAuthenticated, currentUser, lastActivity]);

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, isAuthenticated, handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Helper function to decode JWT payload
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

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 