import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let permission: Promise<boolean> | null = null;

export function ensureNotificationPermission() {
  permission ??= (async () => {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Running low",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  })();
  return permission;
}

export async function notifyRunningLow(names: string[]) {
  if (names.length === 0 || !(await ensureNotificationPermission())) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: names.length === 1 ? `Running low on ${names[0]}` : `Running low on ${names.length} items`,
      body: names.length === 1 ? "Added to your shopping list." : `${names.join(", ")} were added to your shopping list.`,
      data: { url: "/low" },
    },
    trigger: null,
  });
}
