import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { fonts, useTheme } from '@/theme';

export default function TabsLayout() {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const labelFont = lang === 'hi' ? { fontWeight: '700' as const } : { fontFamily: fonts.bold };
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.amberText,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { ...labelFont, fontSize: 12, lineHeight: lang === 'hi' ? 18 : 16 },
        // Room for the icon and a full label in either language (Hindi letters are
        // taller), above the phone's gesture bar.
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          height: 68 + insets.bottom,
          paddingTop: 4,
          paddingBottom: 4 + insets.bottom,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.home,
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: t.tabs.bookings,
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'receipt' : 'receipt-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t.tabs.account,
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
