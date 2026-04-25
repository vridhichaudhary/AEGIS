const defaultWebSocketUrl = () => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  const apiBase = import.meta.env.VITE_API_BASE_URL;
  if (apiBase && apiBase.startsWith('http')) {
    const url = new URL(apiBase);
    const protocol = (url.protocol === 'https:' || !import.meta.env.DEV) ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}/ws/events`;
  }

  // Fallback to window location
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = import.meta.env.DEV ? 'localhost:8000' : window.location.host;
  return `${protocol}//${host}/ws/events`;
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
