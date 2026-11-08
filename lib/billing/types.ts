export type BillingCustomer = {
  userId: string; customerId: string | null; sessionId: string | null;
  attemptId: string | null; checkoutOrigin: string | null;
};
export type SubscriptionSnapshot = {
  id: string; customerId: string; userId: string; priceId: string | null;
  status: string; periodEnd: number | null; cancelAtPeriodEnd: boolean;
  invoiceStatus: string | null; priceValid: boolean; paused: boolean;
};
export interface BillingStore {
  findCustomer(customerId: string): Promise<BillingCustomer | null>;
  eventProcessed(eventId: string): Promise<boolean>;
  acquire(userId: string): Promise<string | null>;
  release(userId: string, token: string): Promise<void>;
  apply(event: { id: string; type: string }, snapshot: SubscriptionSnapshot, token: string): Promise<boolean>;
}
