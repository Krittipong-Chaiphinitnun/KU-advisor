/**
 * src/app/login.tsx
 * -----------------
 * Expo Router route that renders LoginScreen.
 * Automatically redirects to tabs if the user is already authenticated.
 */
import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';

export default function LoginRoute() {
  const { user } = useAuth();

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  return <LoginScreen />;
}
