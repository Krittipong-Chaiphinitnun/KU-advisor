/**
 * src/app/_layout.tsx
 * --------------------
 * Root layout for KU-advisor.
 * Wraps the entire app in AuthProvider so all screens can access user state.
 */

import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AuthProvider } from '../context/AuthContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Hide the native Expo splash as soon as React has mounted.
    SplashScreen.hideAsync();
  }, []);

  return (
    <AuthProvider>
      <Slot />
    </AuthProvider>
  );
}


