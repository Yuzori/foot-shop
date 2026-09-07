export type StripeOrderLine = {
  name: string;
  quantity: number;
  size?: string;
  flocage?: string;
};

export type StripeAdminOrder = {
  sessionId: string;
  reference: string;
  orderId: string;
  customerId: string;
  customerName: string;
  email: string;
  phone: string;
  shippingAddress: string;
  lines: StripeOrderLine[];
  amount: number;
  currency: string;
  paidAt: string;
  stripeUrl: string;
};

export type AbandonedCheckout = {
  reference: string;
  sessionId: string | null;
  createdAt: string;
  cause: string;
  customerName: string;
  email: string;
  phone: string;
  total: number;
  currency: string;
  lines: StripeOrderLine[];
};

export type StripeAdminOrdersResponse = {
  orders: StripeAdminOrder[];
  abandoned: AbandonedCheckout[];
  updatedAt: string;
};
