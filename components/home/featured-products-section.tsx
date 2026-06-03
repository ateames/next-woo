import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { Product } from "@/lib/woocommerce.d";
import { homeFeatured } from "@/lib/home-content";
import { ProductGrid } from "@/components/shop";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FeaturedProductsSectionProps {
  products: Product[];
  className?: string;
}

export function FeaturedProductsSection({
  products,
  className,
}: FeaturedProductsSectionProps) {
  return (
    <section className={cn("border-t bg-muted/30 py-16 md:py-20", className)}>
      <div className="mx-auto max-w-6xl px-6 sm:px-8">
        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {homeFeatured.title}
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              {homeFeatured.description}
            </p>
          </div>
          <Button asChild variant="outline" className="shrink-0 gap-2 self-start sm:self-auto">
            <Link href={homeFeatured.cta.href}>
              {homeFeatured.cta.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <ProductGrid products={products} columns={4} />

        <div className="mt-10 text-center sm:hidden">
          <Button asChild variant="outline" className="gap-2">
            <Link href={homeFeatured.cta.href}>
              {homeFeatured.cta.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
