import { Tabs } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: "#0f172a" },
          headerTintColor: "#f1f5f9",
          headerTitleStyle: { fontWeight: "700" },
          tabBarStyle: { backgroundColor: "#0f172a", borderTopColor: "#1e293b" },
          tabBarActiveTintColor: "#34d399",
          tabBarInactiveTintColor: "#64748b",
        }}
      >
        <Tabs.Screen name="index"      options={{ title: "Today",     tabBarLabel: "Today" }} />
        <Tabs.Screen name="systems"    options={{ title: "Systems",   tabBarLabel: "Systems" }} />
        <Tabs.Screen name="proposals"  options={{ title: "Proposals", tabBarLabel: "Proposals" }} />
        <Tabs.Screen name="reports"    options={{ title: "Reports",   tabBarLabel: "Reports" }} />
      </Tabs>
    </SafeAreaProvider>
  );
}
