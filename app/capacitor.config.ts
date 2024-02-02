import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.submittertech.quran',
  appName: 'Quran',
  webDir: 'build',
  server: {
    androidScheme: 'https'
  }
};

export default config;
