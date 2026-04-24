const defaultWebSocketUrl = () => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = import.meta.env.DEV ? 'localhost:8000' : window.location.host;
  return `${protocol}//${host}/ws/events`;
};

export const connectWebSocket = (url = defaultWebSocketUrl()) => {
  const ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('Connected to WebSocket:', url);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('Disconnected from WebSocket:', url);
  };

  return ws;
};
