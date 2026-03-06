"""
WebSocket Connection Manager for ThanniCanuuu Real-Time Operations.

Manages authenticated WebSocket connections for vendors and agents,
broadcasting events only to authorized recipients within the same vendor scope.

Event types:
  - new_order: When a new order is created
  - order_delivered: When an agent completes a delivery
  - payment_update: When payment status changes
  - damage_report: When an agent reports damage/returns
  - stock_update: When stock levels change
"""
import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Set, Optional
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections keyed by vendor_id.
    
    Structure:
        vendor_connections[vendor_id] = set of WebSocket connections (vendor users)
        agent_connections[vendor_id][agent_id] = WebSocket connection
    """

    def __init__(self):
        # vendor_id -> set of vendor WebSocket connections
        self.vendor_connections: Dict[str, Set[WebSocket]] = {}
        # vendor_id -> { agent_id -> WebSocket }
        self.agent_connections: Dict[str, Dict[str, WebSocket]] = {}
        # WebSocket -> metadata for cleanup
        self._ws_metadata: Dict[WebSocket, dict] = {}
        self._lock = asyncio.Lock()

    async def connect_vendor(self, websocket: WebSocket, vendor_id: str):
        """Register a vendor WebSocket connection."""
        await websocket.accept()
        async with self._lock:
            if vendor_id not in self.vendor_connections:
                self.vendor_connections[vendor_id] = set()
            self.vendor_connections[vendor_id].add(websocket)
            self._ws_metadata[websocket] = {
                "type": "vendor",
                "vendor_id": vendor_id,
                "connected_at": datetime.now(timezone.utc).isoformat()
            }
        logger.info(f"Vendor {vendor_id} connected via WebSocket. Active: {len(self.vendor_connections.get(vendor_id, set()))}")

    async def connect_agent(self, websocket: WebSocket, vendor_id: str, agent_id: str):
        """Register an agent WebSocket connection."""
        await websocket.accept()
        async with self._lock:
            if vendor_id not in self.agent_connections:
                self.agent_connections[vendor_id] = {}
            # Replace existing connection for same agent (e.g., tab refresh)
            old_ws = self.agent_connections[vendor_id].get(agent_id)
            if old_ws:
                self._ws_metadata.pop(old_ws, None)
                try:
                    await old_ws.close()
                except Exception:
                    pass
            self.agent_connections[vendor_id][agent_id] = websocket
            self._ws_metadata[websocket] = {
                "type": "agent",
                "vendor_id": vendor_id,
                "agent_id": agent_id,
                "connected_at": datetime.now(timezone.utc).isoformat()
            }
        logger.info(f"Agent {agent_id} (vendor {vendor_id}) connected via WebSocket")

    async def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection on disconnect."""
        async with self._lock:
            meta = self._ws_metadata.pop(websocket, None)
            if not meta:
                return

            vendor_id = meta["vendor_id"]
            if meta["type"] == "vendor":
                conns = self.vendor_connections.get(vendor_id, set())
                conns.discard(websocket)
                if not conns:
                    self.vendor_connections.pop(vendor_id, None)
                logger.info(f"Vendor {vendor_id} disconnected from WebSocket")
            elif meta["type"] == "agent":
                agent_id = meta["agent_id"]
                agents = self.agent_connections.get(vendor_id, {})
                if agents.get(agent_id) is websocket:
                    agents.pop(agent_id, None)
                if not agents:
                    self.agent_connections.pop(vendor_id, None)
                logger.info(f"Agent {agent_id} (vendor {vendor_id}) disconnected from WebSocket")

    async def _send_json(self, websocket: WebSocket, data: dict) -> bool:
        """Send JSON data to a WebSocket, returning False on failure."""
        try:
            await websocket.send_json(data)
            return True
        except Exception:
            return False

    async def broadcast_to_vendor(self, vendor_id: str, event: dict):
        """Send event to all vendor connections for a given vendor_id."""
        event["timestamp"] = datetime.now(timezone.utc).isoformat()
        event["vendor_id"] = vendor_id

        conns = self.vendor_connections.get(vendor_id, set()).copy()
        dead = []
        for ws in conns:
            if not await self._send_json(ws, event):
                dead.append(ws)

        # Cleanup dead connections
        for ws in dead:
            await self.disconnect(ws)

    async def send_to_agent(self, vendor_id: str, agent_id: str, event: dict):
        """Send event to a specific agent."""
        event["timestamp"] = datetime.now(timezone.utc).isoformat()
        event["vendor_id"] = vendor_id

        ws = self.agent_connections.get(vendor_id, {}).get(agent_id)
        if ws:
            if not await self._send_json(ws, event):
                await self.disconnect(ws)

    async def broadcast_to_all_agents(self, vendor_id: str, event: dict):
        """Send event to all agents under a vendor."""
        event["timestamp"] = datetime.now(timezone.utc).isoformat()
        event["vendor_id"] = vendor_id

        agents = self.agent_connections.get(vendor_id, {}).copy()
        dead = []
        for agent_id, ws in agents.items():
            if not await self._send_json(ws, event):
                dead.append(ws)

        for ws in dead:
            await self.disconnect(ws)

    async def broadcast_event(
        self,
        vendor_id: str,
        event_type: str,
        data: dict,
        target_agent_id: Optional[str] = None
    ):
        """
        High-level event broadcaster.
        
        Sends to:
          - All vendor connections for this vendor_id (always)
          - Specific agent if target_agent_id is provided
          - All agents if target_agent_id is None
        """
        event = {
            "type": event_type,
            "data": data
        }

        # Always notify vendor
        await self.broadcast_to_vendor(vendor_id, event)

        # Notify agent(s)
        if target_agent_id:
            await self.send_to_agent(vendor_id, target_agent_id, event)
        else:
            await self.broadcast_to_all_agents(vendor_id, event)

    def get_connection_stats(self) -> dict:
        """Get current connection statistics."""
        total_vendors = sum(len(conns) for conns in self.vendor_connections.values())
        total_agents = sum(len(agents) for agents in self.agent_connections.values())
        return {
            "vendor_connections": total_vendors,
            "agent_connections": total_agents,
            "vendor_ids": list(self.vendor_connections.keys()),
        }


# Singleton instance
ws_manager = ConnectionManager()
