import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import {
  getProductBySlug,
  getProductVariations,
  getProductReviews,
  getRelatedProducts,
  getAllProductSlugs,
  productHasAnyTagSlug,
} from "@/lib/woocommerce";
import { getShopExcludedTagSlugs } from "@/lib/shop-settings";
import { stripHtml } from "@/lib/metadata";

import { Section, Container, Prose } from "@/components/craft";
import {
  ProductGallery,
  PriceDisplay,
  StockBadge,
  AddToCartButton,
  ProductGrid,
} from "@/components/shop";
import { VariationSelector } from "@/components/shop/variation-selector";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ProductDetailClient } from "./product-detail-client";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllProductSlugs();
  return slugs;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return {
      title: "Product Not Found",
    };
  }

  return {
    title: product.name,
    description: stripHtml(product.short_description).slice(0, 160),
    openGraph: {
      title: product.name,
      description: stripHtml(product.short_description),
      images: product.images[0]?.src ? [product.images[0].src] : [],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  // #region agent log
  fetch('http://127.0.0.1:7542/ingest/4d07387d-caa8-4d85-bb9e-1bf621bf46d9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fe150f'},body:JSON.stringify({sessionId:'fe150f',location:'page.tsx:ProductPage',message:'product page slug resolved',data:{slug,found:Boolean(product),productId:product?.id,relatedIdsCount:product?.related_ids?.length??0},timestamp:Date.now(),hypothesisId:'H1-H4'})}).catch(()=>{});
  // #endregion

  if (!product) {
    notFound();
  }

  // Fetch additional data in parallel
  const [variations, reviews, relatedProductsRaw, excludedTagSlugs] =
    await Promise.all([
      product.type === "variable" ? getProductVariations(product.id) : [],
      getProductReviews(product.id),
      getRelatedProducts(product.related_ids, 4),
      getShopExcludedTagSlugs(),
    ]);

  const relatedProducts = relatedProductsRaw.filter(
    (p) => !productHasAnyTagSlug(p, excludedTagSlugs)
  );

  return (
    <Section>
      <Container>
        <div className="space-y-12">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/shop" className="hover:text-foreground">
              Shop
            </Link>
            <span>/</span>
            {product.categories[0] && (
              <>
                <Link
                  href={`/shop?category=${product.categories[0].slug}`}
                  className="hover:text-foreground"
                >
                  {product.categories[0].name}
                </Link>
                <span>/</span>
              </>
            )}
            <span className="text-foreground">{product.name}</span>
          </nav>

          {/* Product Details */}
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Gallery */}
            <ProductGallery images={product.images} productName={product.name} />

            {/* Info */}
            <div className="space-y-6">
              {/* Categories */}
              {product.categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {product.categories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/shop?category=${cat.slug}`}
                    >
                      <Badge variant="secondary">{cat.name}</Badge>
                    </Link>
                  ))}
                </div>
              )}

              {/* Title */}
              <h1 className="text-3xl font-bold">{product.name}</h1>

              {/* Rating */}
              {product.rating_count > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        className={
                          i < Math.round(parseFloat(product.average_rating))
                            ? "text-yellow-500"
                            : "text-muted-foreground/30"
                        }
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    ({product.rating_count} reviews)
                  </span>
                </div>
              )}

              {/* Price */}
              <PriceDisplay
                price={product.price}
                regularPrice={product.regular_price}
                salePrice={product.sale_price}
                onSale={product.on_sale}
                size="lg"
              />

              {/* Stock */}
              <StockBadge product={product} showQuantity />

              {/* Short Description */}
              {product.short_description && (
                <Prose>
                  <div className="text-muted-foreground">
                    {stripHtml(product.short_description)}
                  </div>
                </Prose>
              )}

              <Separator />

              {/* Variable Product Handler (Client Component) */}
              {product.type === "variable" && variations.length > 0 ? (
                <ProductDetailClient product={product} variations={variations} />
              ) : (
                <AddToCartButton product={product} />
              )}

              <Separator />

              {/* Product Meta */}
              <div className="space-y-2 text-sm">
                {product.sku && (
                  <p>
                    <span className="text-muted-foreground">SKU:</span>{" "}
                    {product.sku}
                  </p>
                )}
                {product.tags.length > 0 && (
                  <p>
                    <span className="text-muted-foreground">Tags:</span>{" "}
                    {product.tags.map((tag, i) => (
                      <span key={tag.id}>
                        <Link
                          href={`/shop?tag=${tag.slug}`}
                          className="hover:underline"
                        >
                          {tag.name}
                        </Link>
                        {i < product.tags.length - 1 && ", "}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Full Description */}
          {product.description && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Description</h2>
              <Prose>
                <div className="text-muted-foreground">
                  {stripHtml(product.description)}
                </div>
              </Prose>
            </div>
          )}

          {/* Reviews */}
          {reviews.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">
                Reviews ({reviews.length})
              </h2>
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{review.reviewer}</span>
                        {review.verified && (
                          <Badge variant="secondary">Verified</Badge>
                        )}
                      </div>
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span
                            key={i}
                            className={
                              i < review.rating
                                ? "text-yellow-500"
                                : "text-muted-foreground/30"
                            }
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-muted-foreground">
                      {stripHtml(review.review)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(review.date_created).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Related Products</h2>
              <ProductGrid products={relatedProducts} columns={4} />
            </div>
          )}
        </div>
      </Container>
    </Section>
  );
}
