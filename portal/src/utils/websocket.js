import { getWebSocketBase } from './runtimeConfig';

const defaultWebSocketUrl = () => {
  return getWebSocketBase();
};

export const connectWebSocket = (onMessage, onStatus, url = defaultWebSocketUrl()) => {
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
        onStatus?.('offline');
      }
      return;
    }

    onStatus?.("reconnecting");
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
      if (manuallyClosed) {
        ws.close(1000, "Client closed connection");
        return;
      }
      retryCount = 0;
      startHeartbeat();
      onStatus?.("connected");
      console.log('Connected to WebSocket:', socketUrl);
    };

    ws.onmessage = (event) => {
      if (manuallyClosed) return;
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
      if (!manuallyClosed) console.error('WebSocket connection failed:', socketUrl, error);
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
      if (ws?.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Client closed connection');
      }
    },
  };
};
