import type {
  CostAllocation,
  CostAllocationReplaceInput,
  EventFinancialSummary,
} from "@/types/cost-allocation";
import type {
  ListTransactionsParams,
  Transaction,
  TransactionCreateInput,
  TransactionListResult,
  TransactionUpdateInput,
} from "@/types/transaction";

import { http } from "./http";

const BASE = "/api/v1/transactions";
const EVENTS = "/api/v1/events";

function buildQuery(params: ListTransactionsParams): string {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.page_size) search.set("page_size", String(params.page_size));
  if (params.q) search.set("q", params.q);
  if (params.sort) search.set("sort", params.sort);
  if (params.event_id) search.set("event_id", params.event_id);
  if (params.cost_item_id) search.set("cost_item_id", params.cost_item_id);
  if (params.work_order_id) search.set("work_order_id", params.work_order_id);
  if (params.client_invoice_id) search.set("client_invoice_id", params.client_invoice_id);
  if (params.transaction_type) search.set("transaction_type", params.transaction_type);
  if (params.status) search.set("status", params.status);
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** Typed Transactions API client. Allocation writes are nested under Transaction. */
export const transactionsService = {
  async list(params: ListTransactionsParams = {}): Promise<TransactionListResult> {
    const result = await http.get<Transaction[]>(`${BASE}${buildQuery(params)}`);
    return { data: result.data, meta: result.meta as TransactionListResult["meta"] };
  },
  async get(id: string): Promise<Transaction> {
    return (await http.get<Transaction>(`${BASE}/${id}`)).data;
  },
  async create(input: TransactionCreateInput): Promise<Transaction> {
    return (await http.post<Transaction>(BASE, input)).data;
  },
  async update(id: string, input: TransactionUpdateInput): Promise<Transaction> {
    return (await http.patch<Transaction>(`${BASE}/${id}`, input)).data;
  },
  async listAllocations(transactionId: string): Promise<CostAllocation[]> {
    return (await http.get<CostAllocation[]>(`${BASE}/${transactionId}/allocations`)).data;
  },
  async replaceAllocations(
    transactionId: string,
    input: CostAllocationReplaceInput,
  ): Promise<CostAllocation[]> {
    return (await http.put<CostAllocation[]>(`${BASE}/${transactionId}/allocations`, input)).data;
  },
  async eventFinancialSummary(eventId: string): Promise<EventFinancialSummary> {
    return (await http.get<EventFinancialSummary>(`${EVENTS}/${eventId}/financial-summary`)).data;
  },
};
