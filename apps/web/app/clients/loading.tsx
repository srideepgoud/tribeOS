import { Skeleton } from "@tribeos/ui";

import { ClientsLoading } from "@/features/clients/components/clients-loading";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-40" />
      <ClientsLoading />
    </div>
  );
}
