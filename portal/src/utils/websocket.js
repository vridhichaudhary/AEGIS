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

export const connectWebSocket = (url = defaultWebSocketUrl()) => {
  const ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('Connected to WebSocket:', url);
  };

  ws.onerror = () => {
    // Suppress generic error logging since StrictMode unmounts intentionally cause this
  };

  ws.onclose = () => {
    console.log('Disconnected from WebSocket:', url);
  };

  return ws;
};
