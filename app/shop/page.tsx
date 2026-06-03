import type { Metadata } from "next";

import {
  getAllProductCategories,
  getAllProductTags,
  getProductCategoryBySlug,
  getProductTagBySlug,
} from "@/lib/woocommerce";
import { getCatalogProducts } from "@/lib/shop-catalog";
import { getShopExcludedTagSlugs } from "@/lib/shop-settings";

import { Section, Container, Prose } from "@/components/craft";
import { ProductFilters, ShopCatalog } from "@/components/shop";

export const dynamic = "auto";
export const revalidate = 600;

interface ShopPageProps {
  searchParams: Promise<{
    page?: string;
    category?: string;
    tag?: string;
    search?: string;
    sort?: string;
    min_price?: string;
    max_price?: string;
  }>;
}

export async function generateMetadata({
  searchParams,
}: ShopPageProps): Promise<Metadata> {
  const { category } = await searchParams;

  if (category) {
    const categoryData = await getProductCategoryBySlug(category);
    if (categoryData) {
      return {
        title: categoryData.name,
        description:
          categoryData.description ||
          `Browse ${categoryData.name} products`,
      };
    }
  }

  return {
    title: "Shop",
    description: "Browse our product catalog",
  };
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams;
  const {
    page: pageParam,
    category,
    tag,
    search,
    sort,
    min_price,
    max_price,
  } = params;

  const page = pageParam ? parseInt(pageParam, 10) : 1;
  const productsPerPage = 12;

  let orderby: "date" | "price" | "popularity" | "rating" | undefined;
  let order: "asc" | "desc" | undefined;

  switch (sort) {
    case "popularity":
      orderby = "popularity";
      break;
    case "rating":
      orderby = "rating";
      break;
    case "date":
      orderby = "date";
      order = "desc";
      break;
    case "price":
      orderby = "price";
      order = "asc";
      break;
    case "price-desc":
      orderby = "price";
      order = "desc";
      break;
  }

  const [categoryData, tagData, excludedTagSlugs] = await Promise.all([
    category ? getProductCategoryBySlug(category) : undefined,
    tag ? getProductTagBySlug(tag) : undefined,
    getShopExcludedTagSlugs(),
  ]);

  const [productsResponse, categories, tags] = await Promise.all([
    getCatalogProducts({
      page,
      perPage: productsPerPage,
      includeTagSlug: tag,
      excludeTagSlugs: tag ? [] : excludedTagSlugs,
      category: categoryData?.id,
      search,
      orderby,
      order,
      min_price: min_price ? parseFloat(min_price) : undefined,
      max_price: max_price ? parseFloat(max_price) : undefined,
    }),
    getAllProductCategories(),
    getAllProductTags(),
  ]);

  const { data: products, headers } = productsResponse;
  const { total, totalPages } = headers;

  const createPaginationUrl = (newPage: number) => {
    const urlParams = new URLSearchParams();
    if (newPage > 1) urlParams.set("page", newPage.toString());
    if (category) urlParams.set("category", category);
    if (tag) urlParams.set("tag", tag);
    if (search) urlParams.set("search", search);
    if (sort) urlParams.set("sort", sort);
    if (min_price) urlParams.set("min_price", min_price);
    if (max_price) urlParams.set("max_price", max_price);
    return `/shop${urlParams.toString() ? `?${urlParams.toString()}` : ""}`;
  };

  const pageTitle = categoryData?.name || tagData?.name || "Shop";
  const visibleTags = tag
    ? tags
    : tags.filter((t) => !excludedTagSlugs.includes(t.slug));

  return (
    <Section>
      <Container>
        <div className="space-y-8">
          <Prose>
            <h1>{pageTitle}</h1>
            <p className="text-muted-foreground">
              {total} {total === 1 ? "product" : "products"} found
              {search && ` matching "${search}"`}
            </p>
          </Prose>

          <div className="grid lg:grid-cols-[280px_1fr] gap-8">
            <aside className="space-y-6">
              <ProductFilters
                categories={categories}
                tags={visibleTags}
                currentCategory={category}
                currentTag={tag}
                currentSearch={search}
                currentSort={sort}
                currentMinPrice={min_price}
                currentMaxPrice={max_price}
              />
            </aside>

            <ShopCatalog
              products={products}
              totalPages={totalPages}
              currentPage={page}
              createPageUrl={createPaginationUrl}
              columns={3}
            />
          </div>
        </div>
      </Container>
    </Section>
  );
}
