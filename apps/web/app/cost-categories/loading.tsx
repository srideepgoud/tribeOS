import { Skeleton } from "@tribeos/ui";

import { CostCategoriesLoading } from "@/features/cost-categories/components/cost-categories-loading";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-56" />
      <CostCategoriesLoading />
    </div>
  );
}
