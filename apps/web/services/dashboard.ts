import type { OperationsDashboard } from "@/types/dashboard";

import { http } from "./http";

const BASE = "/api/v1/dashboard";

/** Typed Dashboard API client. Components never call fetch() directly. */
export const dashboardService = {
  async getOperations(): Promise<OperationsDashboard> {
    return (await http.get<OperationsDashboard>(`${BASE}/operations`)).data;
  },
};
