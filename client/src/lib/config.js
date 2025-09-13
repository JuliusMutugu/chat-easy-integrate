// Environment configuration for client
export const getServerUrl = () => {
  // In production, use the current origin
  if (typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (isLocalhost) {
      return 'http://localhost:3000';
    } else {
      // In production, use the same origin as the current page
      return window.location.origin;
    }
  }
  
  // Fallback for SSR or Node.js environment
  return process.env.SERVER_URL || 'http://localhost:3000';
};

export const config = {
  serverUrl: getServerUrl(),
  production: typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
};
