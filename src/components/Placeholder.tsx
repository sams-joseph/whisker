import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/lib/theme";

/** Temporary screen body until the real screen lands. */
export function Placeholder({ title, detail }: { title: string; detail?: string }) {
  const colors = useColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {detail ? <Text style={[styles.detail, { color: colors.muted }]}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  title: { fontSize: 20, fontWeight: "600" },
  detail: { fontSize: 15, textAlign: "center" },
});
