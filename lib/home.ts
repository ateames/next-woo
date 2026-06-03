import type { ProductCategory } from "@/lib/woocommerce.d";
import { getAllProductCategories } from "@/lib/woocommerce";
import { getCatalogProducts } from "@/lib/shop-catalog";
import { homeCategorySlugs, homeFeatured } from "@/lib/home-content";

export async function getHomeCategories(): Promise<ProductCategory[]> {
  const all = await getAllProductCategories();
  const slugOrder = new Map<string, number>(
    homeCategorySlugs.map((slug, index) => [slug, index])
  );

  return all
    .filter((cat) => slugOrder.has(cat.slug))
    .sort((a, b) => (slugOrder.get(a.slug) ?? 0) - (slugOrder.get(b.slug) ?? 0));
}

export async function getHomeFeaturedProducts() {
  const { data } = await getCatalogProducts({
    page: 1,
    perPage: homeFeatured.productCount,
    orderby: "date",
    order: "desc",
  });
  return data;
}
