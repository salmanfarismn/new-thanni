import os
import httpx
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

class WhatsAppCloudAPI:
    def __init__(self):
        self.phone_number_id = os.environ.get('WHATSAPP_PHONE_NUMBER_ID')
        self.access_token = os.environ.get('WHATSAPP_ACCESS_TOKEN')
        self.api_version = os.environ.get('WHATSAPP_API_VERSION', 'v21.0')
        self.base_url = f"https://graph.facebook.com/{self.api_version}/{self.phone_number_id}"
        
        if not self.phone_number_id or not self.access_token:
            logger.warning("WhatsApp credentials not configured")
    
    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
    
    async def send_text_message(self, to: str, text: str) -> Dict[str, Any]:
        """Send a simple text message"""
        url = f"{self.base_url}/messages"
        
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "text",
            "text": {
                "preview_url": False,
                "body": text
            }
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload, headers=self._get_headers())
                response.raise_for_status()
                result = response.json()
                logger.info(f"Message sent to {to}: {result}")
                return {"success": True, "data": result}
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error sending message: {e.response.text}")
            return {"success": False, "error": e.response.text}
        except Exception as e:
            logger.error(f"Error sending message: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def send_interactive_buttons(
        self, 
        to: str, 
        body_text: str, 
        buttons: List[Dict[str, str]],
        header: Optional[str] = None,
        footer: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send interactive button message
        
        Args:
            to: Recipient phone number with country code (e.g., "919876543210")
            body_text: Main message text
            buttons: List of buttons (max 3), each with 'id' and 'title'
                     Example: [{"id": "20L", "title": "20 Litre"}, {"id": "25L", "title": "25 Litre"}]
            header: Optional header text
            footer: Optional footer text
        """
        if len(buttons) > 3:
            logger.warning("WhatsApp allows max 3 buttons, truncating")
            buttons = buttons[:3]
        
        url = f"{self.base_url}/messages"
        
        interactive_payload = {
            "type": "button",
            "body": {"text": body_text},
            "action": {
                "buttons": [
                    {
                        "type": "reply",
                        "reply": {
                            "id": btn["id"],
                            "title": btn["title"][:20]  # Max 20 chars for title
                        }
                    }
                    for btn in buttons
                ]
            }
        }
        
        if header:
            interactive_payload["header"] = {"type": "text", "text": header}
        
        if footer:
            interactive_payload["footer"] = {"text": footer}
        
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "interactive",
            "interactive": interactive_payload
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload, headers=self._get_headers())
                response.raise_for_status()
                result = response.json()
                logger.info(f"Interactive buttons sent to {to}: {result}")
                return {"success": True, "data": result}
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error sending buttons: {e.response.text}")
            # Fallback to text message if buttons fail
            await self.send_text_message(to, body_text)
            return {"success": False, "error": e.response.text, "fallback": True}
        except Exception as e:
            logger.error(f"Error sending buttons: {str(e)}")
            await self.send_text_message(to, body_text)
            return {"success": False, "error": str(e), "fallback": True}
    
    async def mark_message_as_read(self, message_id: str) -> Dict[str, Any]:
        """Mark a message as read"""
        url = f"{self.base_url}/messages"
        
        payload = {
            "messaging_product": "whatsapp",
            "status": "read",
            "message_id": message_id
        }
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=payload, headers=self._get_headers())
                response.raise_for_status()
                return {"success": True}
        except Exception as e:
            logger.error(f"Error marking message as read: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def verify_webhook(self, mode: str, token: str, challenge: str, verify_token: str) -> Optional[str]:
        """Verify webhook during setup"""
        if mode == "subscribe" and token == verify_token:
            logger.info("Webhook verified successfully")
            return challenge
        logger.warning(f"Webhook verification failed: mode={mode}, token={token}")
        return None
    
    def extract_message_data(self, webhook_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Extract message data from webhook payload"""
        try:
            entry = webhook_data.get("entry", [])[0]
            changes = entry.get("changes", [])[0]
            value = changes.get("value", {})
            
            if "messages" not in value:
                return None
            
            message = value["messages"][0]
            
            # Extract contact info
            contacts = value.get("contacts", [])
            contact_name = contacts[0].get("profile", {}).get("name", "Customer") if contacts else "Customer"
            
            # Extract message content
            message_type = message.get("type", "text")
            from_number = message.get("from")
            message_id = message.get("id")
            timestamp = message.get("timestamp")
            
            # Extract text or button response
            message_text = None
            button_id = None
            
            if message_type == "text":
                message_text = message.get("text", {}).get("body", "")
            elif message_type == "interactive":
                interactive_type = message.get("interactive", {}).get("type")
                if interactive_type == "button_reply":
                    button_id = message.get("interactive", {}).get("button_reply", {}).get("id")
                    message_text = message.get("interactive", {}).get("button_reply", {}).get("title")
                elif interactive_type == "list_reply":
                    button_id = message.get("interactive", {}).get("list_reply", {}).get("id")
                    message_text = message.get("interactive", {}).get("list_reply", {}).get("title")
            
            return {
                "from": from_number,
                "name": contact_name,
                "message_id": message_id,
                "timestamp": timestamp,
                "type": message_type,
                "text": message_text or "",
                "button_id": button_id
            }
        
        except (KeyError, IndexError) as e:
            logger.error(f"Error extracting message data: {str(e)}")
            return None

# Global instance
whatsapp_api = WhatsAppCloudAPI()
