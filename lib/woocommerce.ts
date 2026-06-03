// WooCommerce REST API Functions
// Uses WooCommerce REST API v3 with consumer key/secret authentication

import { cache } from "react";

import { decodeHtmlEntities } from "@/lib/metadata";

import type {
  Product,
  ProductVariation,
  ProductCategory,
  ProductTag,
  ProductReview,
  Order,
  CreateOrderInput,
  Customer,
  Coupon,
  ShippingZone,
  ShippingMethod,
  PaymentGateway,
} from "./woocommerce.d";

// Configuration
const baseUrl = process.env.WORDPRESS_URL;
const consumerKey = process.env.WC_CONSUMER_KEY;
const consumerSecret = process.env.WC_CONSUMER_SECRET;

const isConfigured = Boolean(baseUrl && consumerKey && consumerSecret);

// Server-only env vars are undefined in client bundles; only warn on the server.
if (!isConfigured && typeof window === "undefined") {
  console.warn(
    "WooCommerce environment variables are not fully configured - WooCommerce features will be unavailable"
  );
}

// Error class for WooCommerce API errors
export class WooCommerceAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public endpoint: string,
    public code?: string
  ) {
    super(message);
    this.name = "WooCommerceAPIError";
  }
}

// Pagination types
export interface WooCommercePaginationHeaders {
  total: number;
  totalPages: number;
}

export interface WooCommerceResponse<T> {
  data: T;
  headers: WooCommercePaginationHeaders;
}

const USER_AGENT = "Next.js WooCommerce Client";
const CACHE_TTL = 3600; // 1 hour

function normalizeProduct(product: Product): Product {
  return {
    ...product,
    name: decodeHtmlEntities(product.name),
    categories: product.categories.map((cat) => ({
      ...cat,
      name: decodeHtmlEntities(cat.name),
    })),
    tags: product.tags.map((tag) => ({
      ...tag,
      name: decodeHtmlEntities(tag.name),
    })),
  };
}

function normalizeProducts(products: Product[]): Product[] {
  return products.map(normalizeProduct);
}

function normalizeCategory(category: ProductCategory): ProductCategory {
  return {
    ...category,
    name: decodeHtmlEntities(category.name),
    description: category.description
      ? decodeHtmlEntities(category.description)
      : category.description,
  };
}

function normalizeCategories(categories: ProductCategory[]): ProductCategory[] {
  return categories.map(normalizeCategory);
}

// Basic auth keeps credentials out of URLs (avoids Cloudflare/WAF blocks on query strings).
function getWooCommerceHeaders(): Record<string, string> {
  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString(
    "base64"
  );
  return {
    "User-Agent": USER_AGENT,
    "Content-Type": "application/json",
    Authorization: `Basic ${credentials}`,
  };
}

// Build URL for WooCommerce REST API (auth via Authorization header)
function buildWooCommerceUrl(
  endpoint: string,
  query?: Record<string, any>
): string {
  if (!baseUrl) {
    throw new Error("WooCommerce not configured");
  }

  const url = new URL(`${baseUrl}/wp-json/wc/v3/${endpoint}`);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          url.searchParams.set(key, value.join(","));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    });
  }

  return url.toString();
}

// Fallback for hosts that expect key/secret in the query string
function buildWooCommerceUrlWithQueryAuth(
  endpoint: string,
  query?: Record<string, any>
): string {
  const url = new URL(buildWooCommerceUrl(endpoint, query));
  url.searchParams.set("consumer_key", consumerKey!);
  url.searchParams.set("consumer_secret", consumerSecret!);
  return url.toString();
}

const wooCommerceJsonHeaders = {
  "User-Agent": USER_AGENT,
  "Content-Type": "application/json",
} as const;

// Core fetch - throws on error
async function woocommerceFetch<T>(
  endpoint: string,
  query?: Record<string, any>,
  tags: string[] = ["woocommerce"],
  options?: RequestInit
): Promise<T> {
  if (!isConfigured) {
    throw new Error("WooCommerce not configured");
  }

  const url = buildWooCommerceUrl(endpoint, query);
  const fetchOptions: RequestInit = {
    headers: getWooCommerceHeaders(),
    next: { tags, revalidate: CACHE_TTL },
    ...options,
  };

  let response = await fetch(url, fetchOptions);

  // Cloudflare/WAF may return transient 403s; retry without cache, then query-string auth.
  if (response.status === 403) {
    response = await fetch(url, { ...fetchOptions, cache: "no-store", next: undefined });
  }
  if (response.status === 403) {
    const queryAuthUrl = buildWooCommerceUrlWithQueryAuth(endpoint, query);
    response = await fetch(queryAuthUrl, {
      headers: wooCommerceJsonHeaders,
      cache: "no-store",
    });
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    // #region agent log
    fetch('http://127.0.0.1:7542/ingest/4d07387d-caa8-4d85-bb9e-1bf621bf46d9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fe150f'},body:JSON.stringify({sessionId:'fe150f',location:'woocommerce.ts:woocommerceFetch',message:'API error (strict)',data:{endpoint,status:response.status,statusText:response.statusText,queryKeys:query?Object.keys(query):[]},timestamp:Date.now(),hypothesisId:'H2-H5'})}).catch(()=>{});
    // #endregion
    throw new WooCommerceAPIError(
      errorData.message || `WooCommerce API request failed: ${response.statusText}`,
      response.status,
      endpoint,
      errorData.code
    );
  }

  return response.json();
}

// Graceful fetch - returns fallback when unavailable
async function woocommerceFetchGraceful<T>(
  endpoint: string,
  fallback: T,
  query?: Record<string, any>,
  tags: string[] = ["woocommerce"]
): Promise<T> {
  if (!isConfigured) return fallback;

  try {
    return await woocommerceFetch<T>(endpoint, query, tags);
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7542/ingest/4d07387d-caa8-4d85-bb9e-1bf621bf46d9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fe150f'},body:JSON.stringify({sessionId:'fe150f',location:'woocommerce.ts:woocommerceFetchGraceful',message:'API error (graceful)',data:{endpoint,status:err instanceof WooCommerceAPIError?err.status:null,queryKeys:query?Object.keys(query):[],slug:query?.slug},timestamp:Date.now(),hypothesisId:'H1-H5'})}).catch(()=>{});
    // #endregion
    console.warn(`WooCommerce fetch failed for ${endpoint}`);
    return fallback;
  }
}

// Paginated fetch - returns response with headers
async function woocommerceFetchPaginated<T>(
  endpoint: string,
  query?: Record<string, any>,
  tags: string[] = ["woocommerce"]
): Promise<WooCommerceResponse<T>> {
  if (!isConfigured) {
    throw new Error("WooCommerce not configured");
  }

  const url = buildWooCommerceUrl(endpoint, query);
  const fetchOptions: RequestInit = {
    headers: getWooCommerceHeaders(),
    next: { tags, revalidate: CACHE_TTL },
  };

  let response = await fetch(url, fetchOptions);
  if (response.status === 403) {
    response = await fetch(url, { ...fetchOptions, cache: "no-store", next: undefined });
  }
  if (response.status === 403) {
    const queryAuthUrl = buildWooCommerceUrlWithQueryAuth(endpoint, query);
    response = await fetch(queryAuthUrl, {
      headers: wooCommerceJsonHeaders,
      cache: "no-store",
    });
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new WooCommerceAPIError(
      errorData.message || `WooCommerce API request failed: ${response.statusText}`,
      response.status,
      endpoint,
      errorData.code
    );
  }

  return {
    data: await response.json(),
    headers: {
      total: parseInt(response.headers.get("X-WP-Total") || "0", 10),
      totalPages: parseInt(response.headers.get("X-WP-TotalPages") || "0", 10),
    },
  };
}

// Graceful paginated fetch
async function woocommerceFetchPaginatedGraceful<T>(
  endpoint: string,
  query?: Record<string, any>,
  tags: string[] = ["woocommerce"]
): Promise<WooCommerceResponse<T[]>> {
  const emptyResponse: WooCommerceResponse<T[]> = {
    data: [],
    headers: { total: 0, totalPages: 0 },
  };

  if (!isConfigured) return emptyResponse;

  try {
    return await woocommerceFetchPaginated<T[]>(endpoint, query, tags);
  } catch {
    console.warn(`WooCommerce paginated fetch failed for ${endpoint}`);
    return emptyResponse;
  }
}

// POST/PUT/DELETE fetch for mutations (no caching)
async function woocommerceMutate<T>(
  endpoint: string,
  method: "POST" | "PUT" | "DELETE",
  body?: object
): Promise<T> {
  if (!isConfigured) {
    throw new Error("WooCommerce not configured");
  }

  const url = buildWooCommerceUrl(endpoint);

  const response = await fetch(url, {
    method,
    headers: getWooCommerceHeaders(),
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new WooCommerceAPIError(
      errorData.message || `WooCommerce API request failed: ${response.statusText}`,
      response.status,
      endpoint,
      errorData.code
    );
  }

  return response.json();
}

// ============================================================================
// Products
// ============================================================================

export async function getProducts(
  page: number = 1,
  perPage: number = 12,
  params?: {
    category?: number;
    tag?: number;
    tag_exclude?: number | number[];
    search?: string;
    orderby?: "date" | "id" | "title" | "slug" | "price" | "popularity" | "rating";
    order?: "asc" | "desc";
    featured?: boolean;
    on_sale?: boolean;
    min_price?: number;
    max_price?: number;
    stock_status?: "instock" | "outofstock" | "onbackorder";
  }
): Promise<WooCommerceResponse<Product[]>> {
  const { tag_exclude, ...restParams } = params ?? {};
  const query: Record<string, unknown> = {
    per_page: perPage,
    page,
    status: "publish",
    ...restParams,
  };

  if (tag_exclude !== undefined) {
    const ids = Array.isArray(tag_exclude) ? tag_exclude : [tag_exclude];
    if (ids.length > 0) {
      query.tag_exclude = ids;
    }
  }

  const cacheTags = ["woocommerce", "products", `products-page-${page}`];

  if (params?.category) cacheTags.push(`products-category-${params.category}`);
  if (params?.tag) cacheTags.push(`products-tag-${params.tag}`);
  if (tag_exclude !== undefined) cacheTags.push("products-tag-exclude");
  if (params?.search) cacheTags.push("products-search");

  const response = await woocommerceFetchPaginatedGraceful<Product>(
    "products",
    query,
    cacheTags
  );
  return { ...response, data: normalizeProducts(response.data) };
}

export async function getAllProducts(params?: {
  category?: number;
  tag?: number;
  featured?: boolean;
  on_sale?: boolean;
}): Promise<Product[]> {
  const products = await woocommerceFetchGraceful<Product[]>(
    "products",
    [],
    { per_page: 100, status: "publish", ...params },
    ["woocommerce", "products"]
  );
  return normalizeProducts(products);
}

export async function getProductById(id: number): Promise<Product> {
  const product = await woocommerceFetch<Product>(`products/${id}`, undefined, [
    "woocommerce",
    "products",
    `product-${id}`,
  ]);
  return normalizeProduct(product);
}

export const getProductBySlug = cache(async function getProductBySlug(
  slug: string
): Promise<Product | undefined> {
  const products = await woocommerceFetchGraceful<Product[]>(
    "products",
    [],
    { slug, status: "publish" },
    ["woocommerce", "products"]
  );
  // #region agent log
  fetch('http://127.0.0.1:7542/ingest/4d07387d-caa8-4d85-bb9e-1bf621bf46d9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fe150f'},body:JSON.stringify({sessionId:'fe150f',location:'woocommerce.ts:getProductBySlug',message:'slug lookup result',data:{slug,resultCount:products.length,productId:products[0]?.id},timestamp:Date.now(),hypothesisId:'H1-H3'})}).catch(()=>{});
  // #endregion
  return products[0] ? normalizeProduct(products[0]) : undefined;
});

export async function getFeaturedProducts(limit: number = 4): Promise<Product[]> {
  const products = await woocommerceFetchGraceful<Product[]>(
    "products",
    [],
    { featured: true, per_page: limit, status: "publish" },
    ["woocommerce", "products", "products-featured"]
  );
  return normalizeProducts(products);
}

export async function getOnSaleProducts(limit: number = 8): Promise<Product[]> {
  const products = await woocommerceFetchGraceful<Product[]>(
    "products",
    [],
    { on_sale: true, per_page: limit, status: "publish" },
    ["woocommerce", "products", "products-sale"]
  );
  return normalizeProducts(products);
}

export async function getRelatedProducts(
  relatedIds: number[] | undefined,
  limit: number = 4
): Promise<Product[]> {
  // #region agent log
  fetch('http://127.0.0.1:7542/ingest/4d07387d-caa8-4d85-bb9e-1bf621bf46d9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fe150f'},body:JSON.stringify({sessionId:'fe150f',location:'woocommerce.ts:getRelatedProducts',message:'fetching related by ids',data:{relatedIdsCount:relatedIds?.length??0,limit},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
  // #endregion
  if (!relatedIds || relatedIds.length === 0) {
    return [];
  }

  const ids = relatedIds.slice(0, limit);
  const products = await woocommerceFetchGraceful<Product[]>(
    "products",
    [],
    { include: ids.join(","), status: "publish" },
    ["woocommerce", "products"]
  );
  return normalizeProducts(products);
}

// For static generation
export async function getAllProductSlugs(): Promise<{ slug: string }[]> {
  if (!isConfigured) return [];

  try {
    const allSlugs: { slug: string }[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await woocommerceFetchPaginated<Product[]>("products", {
        per_page: 100,
        page,
        status: "publish",
      });

      allSlugs.push(...response.data.map((product) => ({ slug: product.slug })));
      hasMore = page < response.headers.totalPages;
      page++;
    }

    return allSlugs;
  } catch {
    console.warn("WooCommerce unavailable, skipping static generation for products");
    return [];
  }
}

// ============================================================================
// Product Variations
// ============================================================================

export async function getProductVariations(
  productId: number
): Promise<ProductVariation[]> {
  return woocommerceFetchGraceful<ProductVariation[]>(
    `products/${productId}/variations`,
    [],
    { per_page: 100 },
    ["woocommerce", "products", `product-${productId}`, "variations"]
  );
}

export async function getProductVariation(
  productId: number,
  variationId: number
): Promise<ProductVariation> {
  return woocommerceFetch<ProductVariation>(
    `products/${productId}/variations/${variationId}`,
    undefined,
    ["woocommerce", "products", `product-${productId}`, `variation-${variationId}`]
  );
}

// ============================================================================
// Product Categories
// ============================================================================

export async function getProductCategories(
  page: number = 1,
  perPage: number = 100
): Promise<WooCommerceResponse<ProductCategory[]>> {
  const response = await woocommerceFetchPaginatedGraceful<ProductCategory>(
    "products/categories",
    { per_page: perPage, page, hide_empty: true },
    ["woocommerce", "categories"]
  );
  return { ...response, data: normalizeCategories(response.data) };
}

export async function getAllProductCategories(): Promise<ProductCategory[]> {
  const categories = await woocommerceFetchGraceful<ProductCategory[]>(
    "products/categories",
    [],
    { per_page: 100, hide_empty: true },
    ["woocommerce", "categories"]
  );
  return normalizeCategories(categories);
}

export async function getProductCategoryById(id: number): Promise<ProductCategory> {
  const category = await woocommerceFetch<ProductCategory>(
    `products/categories/${id}`,
    undefined,
    ["woocommerce", "categories", `category-${id}`]
  );
  return normalizeCategory(category);
}

export async function getProductCategoryBySlug(
  slug: string
): Promise<ProductCategory | undefined> {
  const categories = await woocommerceFetchGraceful<ProductCategory[]>(
    "products/categories",
    [],
    { slug },
    ["woocommerce", "categories"]
  );
  return categories[0] ? normalizeCategory(categories[0]) : undefined;
}

export async function getAllCategorySlugs(): Promise<{ slug: string }[]> {
  if (!isConfigured) return [];

  try {
    const categories = await getAllProductCategories();
    return categories.map((cat) => ({ slug: cat.slug }));
  } catch {
    console.warn("WooCommerce unavailable, skipping static generation for categories");
    return [];
  }
}

// ============================================================================
// Product Tags
// ============================================================================

export async function getProductTags(
  page: number = 1,
  perPage: number = 100
): Promise<WooCommerceResponse<ProductTag[]>> {
  return woocommerceFetchPaginatedGraceful<ProductTag>(
    "products/tags",
    { per_page: perPage, page, hide_empty: true },
    ["woocommerce", "tags"]
  );
}

export async function getAllProductTags(): Promise<ProductTag[]> {
  return woocommerceFetchGraceful<ProductTag[]>(
    "products/tags",
    [],
    { per_page: 100, hide_empty: true },
    ["woocommerce", "tags"]
  );
}

export async function getProductTagBySlug(
  slug: string
): Promise<ProductTag | undefined> {
  const tags = await woocommerceFetchGraceful<ProductTag[]>(
    "products/tags",
    [],
    { slug },
    ["woocommerce", "tags"]
  );
  return tags[0];
}

export async function getProductTagIdsBySlugs(
  slugs: string[]
): Promise<number[]> {
  if (slugs.length === 0) return [];

  const ids = await Promise.all(
    slugs.map(async (slug) => {
      const tag = await getProductTagBySlug(slug);
      return tag?.id;
    })
  );

  return ids.filter((id): id is number => id !== undefined);
}

export function productHasTagSlug(product: Product, slug: string): boolean {
  return product.tags.some((tag) => tag.slug === slug);
}

export function productHasAnyTagSlug(
  product: Product,
  slugs: string[]
): boolean {
  if (slugs.length === 0) return false;
  return product.tags.some((tag) => slugs.includes(tag.slug));
}

// ============================================================================
// Product Reviews
// ============================================================================

export async function getProductReviews(
  productId: number
): Promise<ProductReview[]> {
  return woocommerceFetchGraceful<ProductReview[]>(
    "products/reviews",
    [],
    { product: productId, status: "approved" },
    ["woocommerce", "reviews", `product-${productId}`]
  );
}

export async function createProductReview(
  productId: number,
  review: {
    review: string;
    reviewer: string;
    reviewer_email: string;
    rating: number;
  }
): Promise<ProductReview> {
  return woocommerceMutate<ProductReview>("products/reviews", "POST", {
    product_id: productId,
    ...review,
  });
}

// ============================================================================
// Orders
// ============================================================================

export async function createOrder(orderData: CreateOrderInput): Promise<Order> {
  return woocommerceMutate<Order>("orders", "POST", orderData);
}

export async function getOrder(orderId: number): Promise<Order> {
  return woocommerceFetch<Order>(`orders/${orderId}`, undefined, [
    "woocommerce",
    "orders",
    `order-${orderId}`,
  ]);
}

export async function getOrderByKey(orderKey: string): Promise<Order | undefined> {
  // WooCommerce doesn't support direct lookup by order_key
  // This would typically be handled through a custom endpoint or auth
  throw new Error("Order lookup by key requires custom implementation or authentication");
}

export async function updateOrderStatus(
  orderId: number,
  status: Order["status"]
): Promise<Order> {
  return woocommerceMutate<Order>(`orders/${orderId}`, "PUT", { status });
}

// Note: Customer orders require authentication
export async function getCustomerOrders(
  customerId: number,
  page: number = 1,
  perPage: number = 10
): Promise<WooCommerceResponse<Order[]>> {
  return woocommerceFetchPaginated<Order[]>(
    "orders",
    { customer: customerId, per_page: perPage, page },
    ["woocommerce", "orders", `customer-${customerId}`]
  );
}

// ============================================================================
// Customers
// ============================================================================

export async function getCustomer(customerId: number): Promise<Customer> {
  return woocommerceFetch<Customer>(`customers/${customerId}`, undefined, [
    "woocommerce",
    "customers",
    `customer-${customerId}`,
  ]);
}

export async function createCustomer(customerData: {
  email: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  password?: string;
  billing?: Partial<Customer["billing"]>;
  shipping?: Partial<Customer["shipping"]>;
}): Promise<Customer> {
  return woocommerceMutate<Customer>("customers", "POST", customerData);
}

export async function updateCustomer(
  customerId: number,
  customerData: Partial<Customer>
): Promise<Customer> {
  return woocommerceMutate<Customer>(`customers/${customerId}`, "PUT", customerData);
}

// ============================================================================
// Coupons
// ============================================================================

export async function getCouponByCode(code: string): Promise<Coupon | undefined> {
  const coupons = await woocommerceFetchGraceful<Coupon[]>(
    "coupons",
    [],
    { code },
    ["woocommerce", "coupons"]
  );
  return coupons[0];
}

export async function validateCoupon(
  code: string,
  cartTotal: number,
  productIds: number[]
): Promise<{ valid: boolean; discount: number; message?: string }> {
  const coupon = await getCouponByCode(code);

  if (!coupon) {
    return { valid: false, discount: 0, message: "Coupon not found" };
  }

  // Check expiry
  if (coupon.date_expires) {
    const expiryDate = new Date(coupon.date_expires);
    if (expiryDate < new Date()) {
      return { valid: false, discount: 0, message: "Coupon has expired" };
    }
  }

  // Check usage limit
  if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
    return { valid: false, discount: 0, message: "Coupon usage limit reached" };
  }

  // Check minimum amount
  if (coupon.minimum_amount && cartTotal < parseFloat(coupon.minimum_amount)) {
    return {
      valid: false,
      discount: 0,
      message: `Minimum order amount is ${coupon.minimum_amount}`,
    };
  }

  // Check maximum amount
  if (coupon.maximum_amount && cartTotal > parseFloat(coupon.maximum_amount)) {
    return {
      valid: false,
      discount: 0,
      message: `Maximum order amount is ${coupon.maximum_amount}`,
    };
  }

  // Calculate discount
  let discount = 0;
  const amount = parseFloat(coupon.amount);

  switch (coupon.discount_type) {
    case "percent":
      discount = (cartTotal * amount) / 100;
      break;
    case "fixed_cart":
      discount = Math.min(amount, cartTotal);
      break;
    case "fixed_product":
      // Would need to check applicable products
      discount = amount * productIds.length;
      break;
  }

  return { valid: true, discount };
}

// ============================================================================
// Shipping
// ============================================================================

export async function getShippingZones(): Promise<ShippingZone[]> {
  return woocommerceFetchGraceful<ShippingZone[]>(
    "shipping/zones",
    [],
    undefined,
    ["woocommerce", "shipping"]
  );
}

export async function getShippingMethods(zoneId: number): Promise<ShippingMethod[]> {
  return woocommerceFetchGraceful<ShippingMethod[]>(
    `shipping/zones/${zoneId}/methods`,
    [],
    undefined,
    ["woocommerce", "shipping", `zone-${zoneId}`]
  );
}

// ============================================================================
// Payment Gateways
// ============================================================================

export async function getPaymentGateways(): Promise<PaymentGateway[]> {
  return woocommerceFetchGraceful<PaymentGateway[]>(
    "payment_gateways",
    [],
    undefined,
    ["woocommerce", "payment"]
  );
}

export async function getEnabledPaymentGateways(): Promise<PaymentGateway[]> {
  const gateways = await getPaymentGateways();
  return gateways.filter((gateway) => gateway.enabled);
}

// ============================================================================
// Utilities
// ============================================================================

export function formatPrice(
  price: string | number,
  currency: string = "USD"
): string {
  const numericPrice = typeof price === "string" ? parseFloat(price) : price;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(numericPrice);
}

export function calculateDiscountPercentage(
  regularPrice: string,
  salePrice: string
): number {
  const regular = parseFloat(regularPrice);
  const sale = parseFloat(salePrice);

  if (!regular || !sale || regular <= sale) return 0;

  return Math.round(((regular - sale) / regular) * 100);
}

export function isProductInStock(product: Product): boolean {
  if (!product.manage_stock) {
    return product.stock_status === "instock";
  }

  return (
    product.stock_status === "instock" &&
    (product.stock_quantity === null || product.stock_quantity > 0)
  );
}

export function getProductStockMessage(product: Product): string {
  if (!isProductInStock(product)) {
    if (product.stock_status === "onbackorder") {
      return "Available on backorder";
    }
    return "Out of stock";
  }

  if (product.manage_stock && product.stock_quantity !== null) {
    if (product.stock_quantity <= (product.low_stock_amount || 3)) {
      return `Only ${product.stock_quantity} left in stock`;
    }
    return "In stock";
  }

  return "In stock";
}
