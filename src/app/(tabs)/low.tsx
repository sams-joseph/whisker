import { Placeholder } from "@/components/Placeholder";
import { usePantry } from "@/lib/pantry";

export default function LowScreen() {
  const { lowItems } = usePantry();
  return <Placeholder title="Running low" detail={`${lowItems.length} items running low`} />;
}
