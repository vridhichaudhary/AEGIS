const defaultWebSocketUrl = () => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  const apiBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : 'https://aegis-5lpx.onrender.com');
  if (apiBase.startsWith('http')) {
    const url = new URL(apiBase);
    const protocol = (url.protocol === 'https:' || !import.meta.env.DEV) ? 'wss:' : 'ws:';
    // Use /ws endpoint as per backend update
    return `${protocol}//${url.host}/ws`;
  }

  // Fallback to window location
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = import.meta.env.DEV ? 'localhost:8000' : window.location.host;
  return `${protocol}//${host}/ws`;
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
      console.error('WebSocket Error:', err);
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
