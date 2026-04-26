const defaultWebSocketUrl = () => {
  // 1. Check for explicit WS URL override
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

<<<<<<< HEAD
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
=======
  const apiBase =
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV ? 'http://localhost:8000' : 'https://aegis-5lpx.onrender.com');

  if (apiBase.startsWith('http')) {
    const url = new URL(apiBase);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}/ws`;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = import.meta.env.DEV ? 'localhost:8000' : window.location.host;
  return `${protocol}//${host}/ws`;
>>>>>>> 8f85542c (websocket issue resolved)
};

export const connectWebSocket = (onMessage, url = defaultWebSocketUrl()) => {
  let ws = null;
  let retryCount = 0;
  let reconnectTimer = null;
  let heartbeatTimer = null;
  let manuallyClosed = false;
  const maxRetries = 8;
  const heartbeatMs = 25000;

  const clearTimers = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  const startHeartbeat = () => {
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
      }
    }, heartbeatMs);
  };

  const scheduleReconnect = () => {
    if (manuallyClosed || retryCount >= maxRetries) {
      if (retryCount >= maxRetries) {
        console.error('Max WebSocket reconnections reached.');
      }
      return;
    }

    const delay = Math.min(1000 * 2 ** retryCount, 15000);
    reconnectTimer = setTimeout(() => {
      retryCount += 1;
      connect();
    }, delay);
  };

  const connect = () => {
    clearTimers();
    const socketUrl = `${url}${url.includes('?') ? '&' : '?'}transport=websocket`;
    ws = new WebSocket(socketUrl);

    ws.onopen = () => {
      retryCount = 0;
      startHeartbeat();
      console.log('Connected to WebSocket:', socketUrl);
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed?.type === 'pong') {
          return;
        }
      } catch {
        // Non-JSON payloads should still reach the caller.
      }

      if (onMessage) {
        onMessage(event);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket connection failed:', socketUrl, error);
    };

    ws.onclose = (event) => {
      clearTimers();
      if (!manuallyClosed) {
        console.warn(`WebSocket disconnected (code ${event.code}). Reconnecting...`);
        scheduleReconnect();
      }
    };
  };

  connect();

  return {
    close: () => {
      manuallyClosed = true;
      clearTimers();
      if (ws) {
        ws.close(1000, 'Client closed connection');
      }
    },
  };
};
