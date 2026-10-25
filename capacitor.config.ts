import type { CapacitorConfig } from '@capacitor/cli'

// The Android app wraps the same web app: `npm run build && npx cap sync android`, then build in android/.
const config: CapacitorConfig = {
  appId: 'io.github.superjosh800.calorietracker',
  appName: 'Calorie Tracker',
  webDir: 'dist',
  plugins: {
    SystemBars: { initialViewportFitValueHint: 'cover' },
  },
}

export default config
