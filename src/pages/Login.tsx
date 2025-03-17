import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, LogIn, AlertCircle } from 'lucide-react';
import { login, LoginRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';

function Login() {
  const [formData, setFormData] = useState<LoginRequest>({
    username: '',
    password: ''
  });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  
  const navigate = useNavigate();
  const { setCurrentUser } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.username)) {
      setError('Please enter a valid email address');
      return;
    }
    
    // Validate password is not empty
    if (!formData.password) {
      setError('Password is required');
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('Submitting login form:', { email: formData.username });
      const response = await login(formData);
      console.log('Login successful, setting current user');
      setCurrentUser(response);
      navigate('/');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="background-effects" />
      
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="bg-gradient-to-r from-blue-500 via-cyan-400 to-teal-300 rounded-lg p-2">
              <Sparkles className="w-8 h-8 text-dark-900" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-cyan-300 to-teal-200 text-transparent bg-clip-text">
                LumaraX
              </h1>
              <p className="text-sm text-primary-400">Intelligent Energy Trading</p>
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">Welcome back</h2>
          <p className="text-gray-400">Please enter your credentials to continue</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center text-red-300">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>{error}</span>
          </div>
        )}

        <div className="glass-card rounded-xl p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email address
              </label>
              <input
                type="email"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg bg-dark-800/50 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg bg-dark-800/50 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                placeholder="Enter your password"
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-700 bg-dark-800/50 text-primary-500 focus:ring-primary-500"
                />
                <label className="ml-2 block text-sm text-gray-300">
                  Remember me
                </label>
              </div>
              <a href="#" className="text-sm text-primary-400 hover:text-primary-300">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center space-x-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-900 transition-colors ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <LogIn className="w-5 h-5" />
              <span>{loading ? 'Signing in...' : 'Sign in'}</span>
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-400">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary-400 hover:text-primary-300">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/"
            className="text-gray-400 hover:text-gray-300 text-sm"
          >
            Return to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Login;