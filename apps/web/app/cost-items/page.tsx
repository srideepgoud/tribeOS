import type { Metadata } from "next";

import { CostItemsView } from "@/features/cost-items/components/cost-items-view";

export const metadata: Metadata = {
  title: "Cost Items · TribeOS",
};

export default function CostItemsPage() {
  return <CostItemsView />;
}
