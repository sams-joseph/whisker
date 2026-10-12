import { useColorScheme } from "react-native";

const light = {
  tint: "#0d9488",
  tintSoft: "#ccfbf1",
  background: "#f5f5f4",
  card: "#ffffff",
  text: "#1c1917",
  muted: "#78716c",
  border: "#e7e5e4",
  danger: "#dc2626",
  warning: "#d97706",
  warningSoft: "#fef3c7",
};

const dark: typeof light = {
  tint: "#2dd4bf",
  tintSoft: "#134e4a",
  background: "#0c0a09",
  card: "#1c1917",
  text: "#fafaf9",
  muted: "#a8a29e",
  border: "#292524",
  danger: "#f87171",
  warning: "#fbbf24",
  warningSoft: "#451a03",
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}

export function formatQuantity(quantity: number, unit: string) {
  const rounded = Math.round(quantity * 100) / 100;
  return `${rounded} ${unit}`;
}
