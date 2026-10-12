import * as Effect from "effect/Effect";
import { Stack } from "expo-router";
import { SQLiteProvider, type SQLiteDatabase } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { Database, DATABASE_NAME, migrate } from "@/lib/db";
import { PantryProvider } from "@/lib/pantry";
import { useColors } from "@/lib/theme";

const initDatabase = (db: SQLiteDatabase) => Effect.runPromise(migrate.pipe(Effect.provideService(Database, db)));

export default function RootLayout() {
  const colors = useColors();
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} options={{ enableChangeListener: true }} onInit={initDatabase}>
      <PantryProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerTintColor: colors.tint, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="item/[id]" options={{ presentation: "modal", title: "Item" }} />
        </Stack>
      </PantryProvider>
    </SQLiteProvider>
  );
}
