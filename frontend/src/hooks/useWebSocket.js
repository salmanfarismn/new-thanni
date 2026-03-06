import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useWebSocket - Custom hook for real-time WebSocket connections.
 * 
 * Connects to ws://host/ws?token=<jwt> with:
 *   - Auto-reconnect with exponential backoff
 *   - Heartbeat ping/pong
 *   - Event handler registration
 *   - Connection state tracking
 * 
 * Usage:
 *   const { lastEvent, isConnected, on } = useWebSocket();
 *   useEffect(() => on('new_order', (data) => { ... }), [on]);
 */
export function useWebSocket() {
    const [isConnected, setIsConnected] = useState(false);
    const [lastEvent, setLastEvent] = useState(null);
    const wsRef = useRef(null);
    const handlersRef = useRef({});
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttemptRef = useRef(0);
    const heartbeatRef = useRef(null);
    const mountedRef = useRef(true);

    const MAX_RECONNECT_DELAY = 30000; // 30 seconds
    const HEARTBEAT_INTERVAL = 25000;  // 25 seconds
    const BASE_RECONNECT_DELAY = 1000; // 1 second

    const getWebSocketUrl = useCallback(() => {
        const token = localStorage.getItem('token');
        if (!token) return null;

        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
        const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
        const host = backendUrl.replace(/^https?:\/\//, '');
        return `${wsProtocol}://${host}/ws?token=${token}`;
    }, []);

    const startHeartbeat = useCallback(() => {
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send('ping');
            }
        }, HEARTBEAT_INTERVAL);
    }, []);

    const stopHeartbeat = useCallback(() => {
        if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
        }
    }, []);

    const connect = useCallback(() => {
        const url = getWebSocketUrl();
        if (!url || !mountedRef.current) return;

        // Close existing connection
        if (wsRef.current) {
            wsRef.current.close();
        }

        try {
            const ws = new WebSocket(url);
            wsRef.current = ws;

            ws.onopen = () => {
                if (!mountedRef.current) return;
                setIsConnected(true);
                reconnectAttemptRef.current = 0;
                startHeartbeat();
                console.log('[WS] Connected');
            };

            ws.onmessage = (event) => {
                if (!mountedRef.current) return;

                // Ignore pong responses
                if (event.data === 'pong') return;

                try {
                    const parsed = JSON.parse(event.data);
                    setLastEvent(parsed);

                    // Dispatch to registered handlers
                    const eventType = parsed.type;
                    if (eventType && handlersRef.current[eventType]) {
                        handlersRef.current[eventType].forEach(handler => {
                            try {
                                handler(parsed.data, parsed);
                            } catch (err) {
                                console.error(`[WS] Handler error for ${eventType}:`, err);
                            }
                        });
                    }
                } catch (err) {
                    // Not JSON, ignore
                }
            };

            ws.onclose = (event) => {
                if (!mountedRef.current) return;
                setIsConnected(false);
                stopHeartbeat();

                // Don't reconnect if closed intentionally (code 1000) or auth failed (4001)
                if (event.code === 1000 || event.code === 4001) {
                    console.log(`[WS] Closed intentionally (code: ${event.code})`);
                    return;
                }

                // Reconnect with exponential backoff
                const delay = Math.min(
                    BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current),
                    MAX_RECONNECT_DELAY
                );
                reconnectAttemptRef.current++;
                console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current})`);

                reconnectTimeoutRef.current = setTimeout(() => {
                    if (mountedRef.current) connect();
                }, delay);
            };

            ws.onerror = () => {
                // onerror always fires before onclose, so we just log
                console.log('[WS] Connection error');
            };
        } catch (err) {
            console.error('[WS] Failed to create WebSocket:', err);
        }
    }, [getWebSocketUrl, startHeartbeat, stopHeartbeat]);

    // Register event handlers
    const on = useCallback((eventType, handler) => {
        if (!handlersRef.current[eventType]) {
            handlersRef.current[eventType] = new Set();
        }
        handlersRef.current[eventType].add(handler);

        // Return cleanup function
        return () => {
            handlersRef.current[eventType]?.delete(handler);
        };
    }, []);

    // Connect on mount
    useEffect(() => {
        mountedRef.current = true;
        connect();

        return () => {
            mountedRef.current = false;
            stopHeartbeat();
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close(1000, 'Component unmounting');
            }
        };
    }, [connect, stopHeartbeat]);

    return { lastEvent, isConnected, on };
}
