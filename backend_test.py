import requests
import sys
import json
from datetime import datetime

class WaterDeliveryAPITester:
    def __init__(self, base_url="https://h2odash.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test_name": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    Details: {details}")

    def test_dashboard_metrics(self):
        """Test dashboard metrics endpoint"""
        try:
            response = requests.get(f"{self.api_url}/dashboard/metrics", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = [
                    'total_orders', 'delivered_orders', 'pending_orders',
                    'total_cans', 'delivered_cans', 'total_revenue',
                    'pending_payment', 'available_stock', 'total_stock'
                ]
                
                missing_fields = [field for field in required_fields if field not in data]
                if missing_fields:
                    self.log_test("Dashboard Metrics", False, f"Missing fields: {missing_fields}")
                else:
                    self.log_test("Dashboard Metrics", True, f"All metrics present: {data}")
            else:
                self.log_test("Dashboard Metrics", False, f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Dashboard Metrics", False, f"Exception: {str(e)}")

    def test_orders_endpoint(self):
        """Test orders listing endpoint"""
        try:
            # Test basic orders endpoint
            response = requests.get(f"{self.api_url}/orders", timeout=10)
            
            if response.status_code == 200:
                orders = response.json()
                self.log_test("Orders List", True, f"Retrieved {len(orders)} orders")
                
                # Test with status filter
                response = requests.get(f"{self.api_url}/orders?status=pending", timeout=10)
                if response.status_code == 200:
                    pending_orders = response.json()
                    self.log_test("Orders Filter (Pending)", True, f"Retrieved {len(pending_orders)} pending orders")
                else:
                    self.log_test("Orders Filter (Pending)", False, f"Status: {response.status_code}")
                    
            else:
                self.log_test("Orders List", False, f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Orders List", False, f"Exception: {str(e)}")

    def test_stock_endpoint(self):
        """Test stock management endpoints"""
        try:
            # Test GET stock
            response = requests.get(f"{self.api_url}/stock", timeout=10)
            
            if response.status_code == 200:
                stock_data = response.json()
                required_fields = ['date', 'total_stock', 'available_stock', 'orders_count']
                missing_fields = [field for field in required_fields if field not in stock_data]
                
                if missing_fields:
                    self.log_test("Stock GET", False, f"Missing fields: {missing_fields}")
                else:
                    self.log_test("Stock GET", True, f"Stock data: {stock_data}")
                    
                    # Test PUT stock update
                    current_stock = stock_data.get('total_stock', 50)
                    new_stock = current_stock + 10
                    
                    update_response = requests.put(
                        f"{self.api_url}/stock",
                        json={"total_stock": new_stock},
                        headers={'Content-Type': 'application/json'},
                        timeout=10
                    )
                    
                    if update_response.status_code == 200:
                        updated_data = update_response.json()
                        if updated_data.get('total_stock') == new_stock:
                            self.log_test("Stock UPDATE", True, f"Updated stock to {new_stock}")
                        else:
                            self.log_test("Stock UPDATE", False, f"Stock not updated correctly: {updated_data}")
                    else:
                        self.log_test("Stock UPDATE", False, f"Status: {update_response.status_code}")
            else:
                self.log_test("Stock GET", False, f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Stock Endpoints", False, f"Exception: {str(e)}")

    def test_delivery_staff_endpoint(self):
        """Test delivery staff endpoints"""
        try:
            response = requests.get(f"{self.api_url}/delivery-staff", timeout=10)
            
            if response.status_code == 200:
                staff_list = response.json()
                self.log_test("Delivery Staff GET", True, f"Retrieved {len(staff_list)} staff members")
                
                # Test creating new staff (optional - might fail if staff already exists)
                test_staff = {
                    "staff_id": f"TEST_{datetime.now().strftime('%H%M%S')}",
                    "name": "Test Staff",
                    "phone_number": "+919999999999",
                    "active_orders_count": 0
                }
                
                create_response = requests.post(
                    f"{self.api_url}/delivery-staff",
                    json=test_staff,
                    headers={'Content-Type': 'application/json'},
                    timeout=10
                )
                
                if create_response.status_code == 200:
                    self.log_test("Delivery Staff CREATE", True, "Test staff created successfully")
                else:
                    self.log_test("Delivery Staff CREATE", False, f"Status: {create_response.status_code}")
                    
            else:
                self.log_test("Delivery Staff GET", False, f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Delivery Staff Endpoints", False, f"Exception: {str(e)}")

    def test_whatsapp_endpoints(self):
        """Test WhatsApp integration endpoints"""
        try:
            # Test WhatsApp status
            response = requests.get(f"{self.api_url}/whatsapp/status", timeout=10)
            
            if response.status_code == 200:
                status_data = response.json()
                self.log_test("WhatsApp Status", True, f"Status: {status_data}")
            else:
                self.log_test("WhatsApp Status", False, f"Status: {response.status_code}")
            
            # Test QR code endpoint
            qr_response = requests.get(f"{self.api_url}/whatsapp/qr", timeout=10)
            
            if qr_response.status_code == 200:
                qr_data = qr_response.json()
                self.log_test("WhatsApp QR", True, f"QR response: {qr_data}")
            else:
                self.log_test("WhatsApp QR", False, f"Status: {qr_response.status_code}")
                
        except Exception as e:
            self.log_test("WhatsApp Endpoints", False, f"Exception: {str(e)}")

    def test_order_status_update(self):
        """Test order status update (if orders exist)"""
        try:
            # First get orders to find one to update
            response = requests.get(f"{self.api_url}/orders", timeout=10)
            
            if response.status_code == 200:
                orders = response.json()
                if orders:
                    # Find a pending order to test update
                    pending_order = next((o for o in orders if o.get('status') == 'pending'), None)
                    
                    if pending_order:
                        order_id = pending_order['order_id']
                        
                        # Test updating order status
                        update_data = {
                            "order_id": order_id,
                            "status": "delivered",
                            "payment_status": "paid",
                            "payment_method": "cash"
                        }
                        
                        update_response = requests.put(
                            f"{self.api_url}/orders/{order_id}/status",
                            json=update_data,
                            headers={'Content-Type': 'application/json'},
                            timeout=10
                        )
                        
                        if update_response.status_code == 200:
                            updated_order = update_response.json()
                            if updated_order.get('status') == 'delivered':
                                self.log_test("Order Status Update", True, f"Order {order_id} updated successfully")
                            else:
                                self.log_test("Order Status Update", False, f"Status not updated: {updated_order}")
                        else:
                            self.log_test("Order Status Update", False, f"Status: {update_response.status_code}")
                    else:
                        self.log_test("Order Status Update", True, "No pending orders to test update")
                else:
                    self.log_test("Order Status Update", True, "No orders available to test update")
            else:
                self.log_test("Order Status Update", False, f"Could not fetch orders: {response.status_code}")
                
        except Exception as e:
            self.log_test("Order Status Update", False, f"Exception: {str(e)}")

    def test_whatsapp_message_processing(self):
        """Test WhatsApp message processing endpoint"""
        try:
            # Test message processing with a simple greeting
            test_message = {
                "phone_number": "+919999999999",
                "message": "hi",
                "message_id": f"test_{datetime.now().strftime('%H%M%S')}",
                "timestamp": int(datetime.now().timestamp())
            }
            
            response = requests.post(
                f"{self.api_url}/whatsapp/message",
                json=test_message,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            if response.status_code == 200:
                message_response = response.json()
                if 'reply' in message_response and message_response.get('success', False):
                    self.log_test("WhatsApp Message Processing", True, f"Bot replied: {message_response['reply'][:50]}...")
                else:
                    self.log_test("WhatsApp Message Processing", False, f"Invalid response: {message_response}")
            else:
                self.log_test("WhatsApp Message Processing", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("WhatsApp Message Processing", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Run all API tests"""
        print(f"🧪 Starting API Tests for Water Delivery System")
        print(f"🔗 Base URL: {self.base_url}")
        print("=" * 60)
        
        # Run all tests
        self.test_dashboard_metrics()
        self.test_orders_endpoint()
        self.test_stock_endpoint()
        self.test_delivery_staff_endpoint()
        self.test_whatsapp_endpoints()
        self.test_order_status_update()
        self.test_whatsapp_message_processing()
        
        # Print summary
        print("=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return 1

def main():
    tester = WaterDeliveryAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())