import type { Metadata } from "next";

import { CostCategoriesView } from "@/features/cost-categories/components/cost-categories-view";

export const metadata: Metadata = {
  title: "Cost Categories · TribeOS",
};

export default function CostCategoriesPage() {
  return <CostCategoriesView />;
}
