const defaultWebSocketUrl = () => {
  // 1. Check for explicit WS URL override
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  // 2. Derive from API Base URL
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'https://aegis-5lpx.onrender.com';
  
  if (apiBase.startsWith('http')) {
    const url = new URL(apiBase);
    // Use WSS for production, WS for localhost
    const protocol = (url.hostname === 'localhost' || url.hostname === '127.0.0.1') ? 'ws:' : 'wss:';
    return `${protocol}//${url.host}/ws`;
  }

  // 3. Last resort fallback
  return 'wss://aegis-5lpx.onrender.com/ws';
};

export const connectWebSocket = (onMessage, url = defaultWebSocketUrl()) => {
  let ws;
  let retryCount = 0;
  const maxRetries = 10;
  
  const connect = () => {
    // Add timestamp to bypass any handshake caching
    const socketUrl = `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
    ws = new WebSocket(socketUrl);

    ws.onopen = () => {
      console.log('Connected to WebSocket:', socketUrl);
      retryCount = 0;
    };

    ws.onmessage = (event) => {
      if (onMessage) onMessage(event);
    };

    ws.onerror = (err) => {
      console.error("WebSocket Error State:", ws.readyState);
      console.error("WebSocket Connection failed to:", socketUrl);
      console.error('Detailed Error:', err);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected.');
      if (retryCount < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
        console.log(`Retrying connection in ${delay/1000}s... (Attempt ${retryCount + 1}/${maxRetries})`);
        setTimeout(connect, delay);
        retryCount++;
      } else {
        console.error('Max WebSocket reconnections reached.');
      }
    };
  };

  connect();

  return {
    close: () => {
      if (ws) {
        ws.onclose = null; // Prevent reconnection on intentional close
        ws.close();
      }
    }
  };
};
