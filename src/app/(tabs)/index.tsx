import { Placeholder } from "@/components/Placeholder";
import { usePantry } from "@/lib/pantry";

export default function PantryScreen() {
  const { items, loading } = usePantry();
  return <Placeholder title="Pantry" detail={loading ? "Loading…" : `${items.length} items`} />;
}
