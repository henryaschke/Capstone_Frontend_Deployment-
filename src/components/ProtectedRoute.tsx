import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children?: React.ReactNode;
  requiredRole?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRole 
}) => {
  const { currentUser, isAuthenticated } = useAuth();
  
  // Check if user is authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // Check if user has required role (if specified)
  if (requiredRole && currentUser?.user_role !== requiredRole) {
    return <Navigate to="/" replace />;
  }
  
  // Render children or outlet
  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute; 