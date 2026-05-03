import { useEffect, useRef, useCallback } from "react";

export function useWebSocket(onMessage: (msg: unknown) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    const ws = new WebSocket("ws://localhost:7842");
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        onMessageRef.current(JSON.parse(e.data));
      } catch {}
    };

    ws.onclose = () => {
      setTimeout(connect, 2000);
    };

    return ws;
  }, []);

  useEffect(() => {
    const ws = connect();
    return () => ws.close();
  }, [connect]);
}
