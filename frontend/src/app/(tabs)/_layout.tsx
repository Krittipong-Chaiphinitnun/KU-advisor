/**
 * src/app/(tabs)/_layout.tsx
 * ---------------------------
 * Bottom Tab Navigator for authenticated users.
 * Tabs: Dashboard · Chat · History
 */

import { Redirect, Tabs } from 'expo-router';
import { Platform, StyleSheet, Text } from 'react-native';
import { useAuth } from '../../context/AuthContext';

const KU_GREEN      = '#006633';
const KU_GREEN_DARK = '#004d26';
const KU_GOLD       = '#C9A84C';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    index:   '🏠',
    chat:    '🤖',
    history: '📋',
  };
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.55 }}>
      {icons[label] ?? '●'}
    </Text>
  );
}

export default function TabsLayout() {
  const { user } = useAuth();

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: KU_GREEN,
        tabBarInactiveTintColor: '#888',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e0e8e0',
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 84 : 62,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'หน้าหลัก',
          tabBarIcon: ({ focused }) => <TabIcon label="index" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'AI Chat',
          tabBarIcon: ({ focused }) => <TabIcon label="chat" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'ประวัติ',
          tabBarIcon: ({ focused }) => <TabIcon label="history" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
