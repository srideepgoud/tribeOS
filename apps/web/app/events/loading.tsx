import { Skeleton } from "@tribeos/ui";

import { EventsLoading } from "@/features/events/components/events-loading";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-40" />
      <EventsLoading />
    </div>
  );
}
