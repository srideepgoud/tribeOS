import type { Metadata } from "next";

import { VendorWorkOrdersView } from "@/features/vendor-work-orders/components/vwo-view";

export const metadata: Metadata = {
  title: "Vendor Work Orders · TribeOS",
};

export default function VendorWorkOrdersPage() {
  return <VendorWorkOrdersView />;
}
