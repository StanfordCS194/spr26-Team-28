import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import theme from "@/assets/theme";

export default function ArtistTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.darkBackground,
          borderTopColor: "rgba(255,255,255,0.08)",
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 20,
          paddingTop: 10,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.darkMuted,
        tabBarLabelStyle: {
          fontFamily: theme.fonts.ui,
          fontSize: theme.fontSizes.tiny,
          letterSpacing: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "INSIGHTS",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="posts"
        options={{
          title: "POSTS",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="megaphone-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="fans"
        options={{
          title: "FANS",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="releases"
        options={{
          title: "RELEASES",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="disc-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "PROFILE",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
