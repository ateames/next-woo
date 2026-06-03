import type { Page } from "@/lib/wordpress.d";
import { getAllPages } from "@/lib/wordpress";
import { getShopExcludedTagSlugs } from "@/lib/shop-settings";
import {
  getProducts,
  getProductTagBySlug,
  getProductTagIdsBySlugs,
  type WooCommerceResponse,
} from "@/lib/woocommerce";
import type { Product } from "@/lib/woocommerce.d";

export function getPageProductTagSlug(page: Page): string | undefined {
  const meta = page.meta?.product_tag_slug;
  if (typeof meta === "string" && meta.trim()) {
    return meta.trim();
  }
  return undefined;
}

export async function getProductLandingPages(): Promise<Page[]> {
  const pages = await getAllPages();
  return pages.filter((page) => getPageProductTagSlug(page));
}

export interface CatalogProductParams {
  page?: number;
  perPage?: number;
  includeTagSlug?: string;
  excludeTagSlugs?: string[];
  category?: number;
  search?: string;
  orderby?: "date" | "price" | "popularity" | "rating";
  order?: "asc" | "desc";
  min_price?: number;
  max_price?: number;
}

export async function getCatalogProducts(
  params: CatalogProductParams = {}
): Promise<WooCommerceResponse<Product[]>> {
  const {
    page = 1,
    perPage = 12,
    includeTagSlug,
    excludeTagSlugs,
    category,
    search,
    orderby,
    order,
    min_price,
    max_price,
  } = params;

  let tag: number | undefined;
  let tag_exclude: number[] | undefined;

  if (includeTagSlug) {
    const tagData = await getProductTagBySlug(includeTagSlug);
    tag = tagData?.id;
  } else {
    const slugsToExclude =
      excludeTagSlugs ?? (await getShopExcludedTagSlugs());
    if (slugsToExclude.length > 0) {
      tag_exclude = await getProductTagIdsBySlugs(slugsToExclude);
    }
  }

  return getProducts(page, perPage, {
    category,
    tag,
    tag_exclude:
      tag_exclude && tag_exclude.length > 0 ? tag_exclude : undefined,
    search,
    orderby,
    order,
    min_price,
    max_price,
  });
}
