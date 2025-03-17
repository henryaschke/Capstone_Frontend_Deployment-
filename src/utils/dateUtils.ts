/**
 * Format a date string to YYYY-MM-DD
 */
export const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '';
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

/**
 * Format a date string to HH:MM
 */
export const formatTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '';
    }
    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${hours}:${minutes}`;
  } catch (error) {
    console.error('Error formatting time:', error);
    return '';
  }
};

/**
 * Format a date string to YYYY-MM-DD HH:MM
 */
export const formatDateTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '';
    }
    
    return `${formatDate(dateString)} ${formatTime(dateString)}`;
  } catch (error) {
    console.error('Error formatting date and time:', error);
    return '';
  }
};

/**
 * Get a date string for X days ago
 */
export const getPastDate = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDate(date.toISOString());
};

/**
 * Get a date string for X days in the future
 */
export const getFutureDate = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatDate(date.toISOString());
};

/**
 * Get today's date string
 */
export const getToday = (): string => {
  return formatDate(new Date().toISOString());
}; 