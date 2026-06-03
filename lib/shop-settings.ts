const CACHE_TTL = 600;

export interface ShopSettings {
  excluded_product_tags: string[];
}

export async function getShopExcludedTagSlugs(): Promise<string[]> {
  const baseUrl = process.env.WORDPRESS_URL;
  if (!baseUrl) {
    return [];
  }

  try {
    const url = `${baseUrl.replace(/\/$/, "")}/wp-json/next-woo/v1/shop-settings`;
    const response = await fetch(url, {
      next: { tags: ["shop-settings"], revalidate: CACHE_TTL },
    });

    if (!response.ok) {
      console.warn(`Shop settings fetch failed: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as ShopSettings;
    return Array.isArray(data.excluded_product_tags)
      ? data.excluded_product_tags.filter(Boolean)
      : [];
  } catch {
    console.warn("Shop settings fetch failed");
    return [];
  }
}
