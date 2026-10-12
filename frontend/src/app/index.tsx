/**
 * src/app/index.tsx
 * -----------------
 * Root index — immediately redirects to the (tabs) group.
 * The actual tab navigation is handled by _layout.tsx based on auth state.
 */
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(tabs)" />;
}
