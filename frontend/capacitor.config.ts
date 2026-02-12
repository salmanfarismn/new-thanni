import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.thannicanuuu.app',
  appName: 'Thanni Canuuu',
  webDir: 'build',
  server: {
    // Use https scheme so Capacitor origin works with CORS
    androidScheme: 'https',
    // For production: uncomment and set your Oracle Cloud IP/domain
    // url: 'https://yourdomain.com',
    // cleartext: true,  // Set to true if using HTTP instead of HTTPS
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      showSpinner: true,
      spinnerColor: '#10b981',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
    },
    Camera: {
      saveToGallery: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;

