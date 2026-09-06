export type AbandonedCheckout = {
  reference: string;
  createdAt: string;
  customerName: string;
  email: string;
  total: number;
  currency: string;
  lines: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
};
