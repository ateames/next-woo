import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Section, Container, Prose } from "@/components/craft";
import { ShopCatalog } from "@/components/shop";
import { generateContentMetadata, stripHtml } from "@/lib/metadata";
import {
  getCatalogProducts,
  getPageProductTagSlug,
  getProductLandingPages,
} from "@/lib/shop-catalog";
import { getPageBySlug } from "@/lib/wordpress";

export const revalidate = 600;

interface LandingPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateStaticParams() {
  const pages = await getProductLandingPages();
  return pages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
  params,
}: LandingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  const productTagSlug = page ? getPageProductTagSlug(page) : undefined;

  if (!page || !productTagSlug) {
    return {};
  }

  return generateContentMetadata({
    title: page.title.rendered,
    excerpt: page.excerpt?.rendered,
    content: page.content.rendered,
    slug: page.slug,
    type: "page",
  });
}

export default async function ProductLandingPage({
  params,
  searchParams,
}: LandingPageProps) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = await getPageBySlug(slug);
  const productTagSlug = page ? getPageProductTagSlug(page) : undefined;

  if (!page || !productTagSlug) {
    notFound();
  }

  const pageNum = pageParam ? parseInt(pageParam, 10) : 1;
  const productsPerPage = 12;

  const { data: products, headers } = await getCatalogProducts({
    page: pageNum,
    perPage: productsPerPage,
    includeTagSlug: productTagSlug,
  });

  const { total, totalPages } = headers;

  const createPaginationUrl = (newPage: number) => {
    if (newPage <= 1) return `/${slug}`;
    return `/${slug}?page=${newPage}`;
  };

  return (
    <Section>
      <Container>
        <div className="space-y-8">
          <Prose>
            <h1>{stripHtml(page.title.rendered)}</h1>
            {page.content.rendered && (
              <div dangerouslySetInnerHTML={{ __html: page.content.rendered }} />
            )}
            <p className="text-muted-foreground">
              {total} {total === 1 ? "product" : "products"} found
            </p>
          </Prose>

          <ShopCatalog
            products={products}
            totalPages={totalPages}
            currentPage={pageNum}
            createPageUrl={createPaginationUrl}
            columns={3}
          />
        </div>
      </Container>
    </Section>
  );
}
