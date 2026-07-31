import { PageSkeleton } from "@/components/ui/Skeleton";

export default function ServicesLoading() {
  return <PageSkeleton stats={2} blocks={2} rows={8} />;
}
