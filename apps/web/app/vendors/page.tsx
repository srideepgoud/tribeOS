import type { Metadata } from "next";

import { VendorsView } from "@/features/vendors/components/vendors-view";

export const metadata: Metadata = {
  title: "Vendors · TribeOS",
};

export default function VendorsPage() {
  return <VendorsView />;
}
