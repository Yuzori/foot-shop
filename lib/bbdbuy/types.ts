export interface BbdBuyOrderLine {
  productId: string;
  variantId: string | null;
  name: string;
  quantity: number;
  size: string | null;
  imageUrl: string | null;
  supplierUrl: string | null;
  supplierLabel: string | null;
  supplierNotes: string | null;
  missingCatalog: boolean;
}

export interface BbdBuyOrderDraft {
  orderId: string;
  reference: string;
  createdAt: string;
  status: "pending" | "submitted" | "archived";
  customer: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
  };
  shipping: {
    address1: string;
    address2: string;
    postcode: string;
    city: string;
    country: string;
  };
  flocageNote: string | null;
  lines: BbdBuyOrderLine[];
  checklist: string[];
}

export interface SupplierOrderContext {
  orderId: string;
  reference: string;
  customerEmail: string | null;
  delivery: {
    firstName: string;
    lastName: string;
    phone: string;
    address1: string;
    address2: string;
    postcode: string;
    city: string;
    country: string;
  };
  flocageNote: string | null;
  lines: {
    productId: string;
    variantId: string | null;
    name: string;
    quantity: number;
  }[];
}
