import { PageSkeleton } from "@/components/ui/Skeleton";

export default function ReportsLoading() {
  return <PageSkeleton stats={4} blocks={2} rows={8} />;
}
