import { SymbolView, type SFSymbol } from "expo-symbols";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { usePantry } from "@/lib/pantry";
import { useColors } from "@/lib/theme";

const icon = (name: SFSymbol) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <SymbolView name={name} tintColor={color} size={size} />;
  };

export default function TabLayout() {
  const colors = useColors();
  const { lowItems } = usePantry();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Pantry", tabBarIcon: icon("cabinet") }} />
      <Tabs.Screen name="scan" options={{ title: "Scan", tabBarIcon: icon("doc.text.viewfinder") }} />
      <Tabs.Screen name="recipes" options={{ title: "Recipes", tabBarIcon: icon("fork.knife") }} />
      <Tabs.Screen
        name="low"
        options={{
          title: "Running low",
          tabBarIcon: icon("exclamationmark.triangle"),
          tabBarBadge: lowItems.length > 0 ? lowItems.length : undefined,
        }}
      />
    </Tabs>
  );
}
