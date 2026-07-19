import { Skeleton } from "@tribeos/ui";

import { VendorWorkOrdersLoading } from "@/features/vendor-work-orders/components/vwo-loading";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-56" />
      <VendorWorkOrdersLoading />
    </div>
  );
}
