/**
 * Browser-side API client.
 *
 * Talks ONLY to our own Next.js route handlers (/api/*), which in turn call the
 * PrestaShop service. Components/hooks import from here — they never know that
 * PrestaShop exists. Swap the back office later and this file stays untouched.
 */
import { http } from "@/lib/http";
import { toQueryString } from "@/lib/utils";
import type {
  CartLine,
  Category,
  Customer,
  Order,
  Paginated,
  Product,
  ProductQuery,
} from "@/types/domain";

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  acceptTerms: boolean;
  newsletter: boolean;
}

export interface RegisterVerifyInput {
  email: string;
  code: string;
}

export interface RegisterStartResult {
  needsVerification: boolean;
  message: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ForgotInput {
  email: string;
}

export interface ResetInput {
  email: string;
  code: string;
  password: string;
}

export const api = {
  async getProducts(query: ProductQuery = {}): Promise<Paginated<Product>> {
    const qs = toQueryString({
      category: query.category,
      search: query.search,
      kind: query.kind,
      page: query.page,
      limit: query.limit,
      sort: query.sort,
    });
    const { data } = await http.get<Paginated<Product>>(`/products${qs}`);
    return data;
  },

  async getProduct(id: string): Promise<Product> {
    const { data } = await http.get<Product>(`/products/${id}`);
    return data;
  },

  async getCategories(): Promise<Category[]> {
    const { data } = await http.get<{ items: Category[] }>("/categories");
    return data.items;
  },

  async getCategory(
    id: string,
    options?: { audience?: "kids" | "adult" },
  ): Promise<{ category: Category; products: Product[] }> {
    const qs =
      options?.audience != null
        ? `?audience=${encodeURIComponent(options.audience)}`
        : "";
    const { data } = await http.get<{
      category: Category;
      products: Product[];
    }>(`/categories/${id}${qs}`);
    return data;
  },

  async search(query: string): Promise<Product[]> {
    const qs = toQueryString({ q: query });
    const { data } = await http.get<{ items: Product[] }>(`/search${qs}`);
    return data.items;
  },

  async trackOrder(reference: string): Promise<Order> {
    const qs = toQueryString({ reference });
    const { data } = await http.get<Order>(`/orders/track${qs}`);
    return data;
  },

  // ── Account ──────────────────────────────────────────────────────────
  async me(): Promise<Customer | null> {
    const { data } = await http.get<{ user: Customer | null }>("/account/me");
    return data.user;
  },

  async register(input: RegisterInput): Promise<RegisterStartResult> {
    const { data } = await http.post<RegisterStartResult>(
      "/account/register",
      input,
    );
    return data;
  },

  async verifyRegister(input: RegisterVerifyInput): Promise<Customer> {
    const { data } = await http.post<{ user: Customer }>(
      "/account/register/verify",
      input,
    );
    return data.user;
  },

  async login(input: LoginInput): Promise<Customer> {
    const { data } = await http.post<{ user: Customer }>("/account/login", input);
    return data.user;
  },

  async logout(): Promise<void> {
    await http.post("/account/logout");
  },

  async getPreferences(): Promise<{ cart: CartLine[]; favorites: string[] }> {
    const { data } = await http.get<{ cart: CartLine[]; favorites: string[] }>(
      "/account/preferences",
    );
    return data;
  },

  async savePreferences(input: {
    cart: CartLine[];
    favorites: string[];
  }): Promise<void> {
    await http.put("/account/preferences", input);
  },

  async forgotPassword(input: ForgotInput): Promise<void> {
    await http.post("/account/forgot", input);
  },

  async resetPassword(input: ResetInput): Promise<void> {
    await http.post("/account/reset", input);
  },

  async myOrders(): Promise<Order[]> {
    const { data } = await http.get<{ items: Order[] }>("/account/orders");
    return data.items;
  },

  async checkout(input: CheckoutInput): Promise<{ reference: string; orderId: string | null }> {
    const { data } = await http.post<{ reference: string; orderId: string | null }>(
      "/checkout",
      input,
      { timeout: 120_000 },
    );
    return data;
  },

  async checkoutStripe(
    input: CheckoutInput & {
      items: { name: string; unitPrice: number; quantity: number }[];
    },
  ): Promise<{ url: string | null; reference: string }> {
    const { data } = await http.post<{ url: string | null; reference: string }>(
      "/checkout/stripe",
      input,
    );
    return data;
  },

  async checkoutStripeSession(
    input: CheckoutInput & {
      items: { name: string; unitPrice: number; quantity: number }[];
      applyWelcomePromo?: boolean;
    },
  ): Promise<{
    clientSecret: string | null;
    reference: string;
    orderId: string | null;
    returnUrl: string;
    publishableKey: string;
    checkoutSessionId: string;
    bogoApplied?: boolean;
    bogoDiscount?: number;
    freeUnits?: number;
  }> {
    const { data } = await http.post<{
      clientSecret: string | null;
      reference: string;
      orderId: string | null;
      returnUrl: string;
      publishableKey: string;
      checkoutSessionId: string;
      bogoApplied?: boolean;
      bogoDiscount?: number;
      freeUnits?: number;
    }>("/checkout/stripe/session", input, { timeout: 120_000 });
    return data;
  },

  async confirmStripePayment(checkoutSessionId: string): Promise<{
    ok: boolean;
    reference: string | null;
  }> {
    const { data } = await http.post<{ ok: boolean; reference: string | null }>(
      "/checkout/stripe/confirm",
      { checkoutSessionId },
      { timeout: 60_000 },
    );
    return data;
  },
};

export interface CheckoutInput {
  contact: { firstName: string; lastName: string; email: string; phone?: string };
  address: {
    address1: string;
    address2?: string;
    postcode: string;
    city: string;
    country: string;
  };
  lines: {
    productId: string;
    variantId: string | null;
    quantity: number;
    unitPrice: number;
  }[];
}
