import { Skeleton } from "@tribeos/ui";

import { VendorsLoading } from "@/features/vendors/components/vendors-loading";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-40" />
      <VendorsLoading />
    </div>
  );
}
