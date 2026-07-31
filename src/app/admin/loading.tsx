import { PageSkeleton } from "@/components/ui/Skeleton";

/** Panel de control: 4 stats + formularios + movimientos recientes. */
export default function AdminLoading() {
  return <PageSkeleton stats={4} blocks={2} rows={6} />;
}
