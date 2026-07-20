"use client";

import { useQuery } from "@tanstack/react-query";

import { dashboardService } from "@/services/dashboard";

const DASHBOARD_KEY = "dashboard";

export function useOperationsDashboard() {
  return useQuery({
    queryKey: [DASHBOARD_KEY, "operations"],
    queryFn: () => dashboardService.getOperations(),
  });
}
