import { Spinner } from "@tribeos/ui";

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner className="size-6 text-primary" />
    </div>
  );
}
