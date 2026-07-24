import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.submittertech.quran',
  appName: 'Quran',
  webDir: 'build',
  ios: {
    scheme: 'Quran',
  },
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      style: 'DARK',
      hidden: false,
    },
  }
};

export default config;
