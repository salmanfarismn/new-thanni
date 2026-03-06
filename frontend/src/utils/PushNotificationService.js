import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { api } from '../context/AppContext';
import { toast } from 'sonner';

export const PushNotificationService = {
    async init() {
        if (!Capacitor.isNativePlatform()) {
            console.log('Push notifications not available on web');
            return;
        }

        try {
            // 1. Request/Check permission
            let permStatus = await PushNotifications.checkPermissions();

            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions();
            }

            if (permStatus.receive !== 'granted') {
                console.warn('Push notification permission denied');
                return;
            }

            // 2. Create Notification Channels (Android only - enables custom sound)
            if (Capacitor.getPlatform() === 'android') {
                await PushNotifications.createChannel({
                    id: 'orders',
                    name: 'Order Alerts',
                    description: 'New orders and delivery assignments',
                    sound: 'water_drop',
                    importance: 5, // High importance
                    visibility: 1, // Public
                    vibration: true
                });
                console.log('Push notification channel "orders" verified');
            }

            // 3. Register with FCM
            await PushNotifications.register();

            // 4. Set up Listeners
            PushNotifications.addListener('registration', async ({ value }) => {
                console.log('Push registration success, token:', value);
                await this.registerTokenWithBackend(value);
            });

            PushNotifications.addListener('registrationError', (error) => {
                console.error('Push registration error:', error);
            });

            PushNotifications.addListener('pushNotificationReceived', (notification) => {
                console.log('Push received:', notification);
                toast.info(notification.title || 'Notification', {
                    description: notification.body
                });
            });

            PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                console.log('Push action performed:', notification);
                const data = notification.notification.data;
                if (data && data.order_id) {
                    window.dispatchEvent(new CustomEvent('app:notification_opened', { detail: data }));
                }
            });

        } catch (error) {
            console.error('Error initializing push notifications:', error);
        }
    },

    async registerTokenWithBackend(token) {
        try {
            const platform = Capacitor.getPlatform();
            await api.post('/notifications/register', {
                token,
                platform,
                device_id: window.navigator.userAgent
            });
            console.log('FCM token registered with backend');
        } catch (error) {
            console.error('Failed to register FCM token with backend:', error);
        }
    }
};
