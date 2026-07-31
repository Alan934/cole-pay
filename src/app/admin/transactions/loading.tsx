import { PageSkeleton } from "@/components/ui/Skeleton";

export default function TransactionsLoading() {
  return <PageSkeleton blocks={1} rows={12} />;
}
