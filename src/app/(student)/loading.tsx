import { PageSkeleton } from "@/components/ui/Skeleton";

/** Esqueleto compartido de las pantallas de alumno. */
export default function StudentLoading() {
  return <PageSkeleton blocks={2} rows={5} />;
}
