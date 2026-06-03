import Image from "next/image";
import Link from "next/link";

import type { ProductCategory } from "@/lib/woocommerce.d";
import { homeCategories } from "@/lib/home-content";
import { cn } from "@/lib/utils";

interface CategoryGridProps {
  categories: ProductCategory[];
  className?: string;
}

export function CategoryGrid({ categories, className }: CategoryGridProps) {
  if (categories.length === 0) return null;

  return (
    <section id="categories" className={cn("py-16 md:py-20", className)}>
      <div className="mx-auto max-w-6xl px-6 sm:px-8">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {homeCategories.title}
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            {homeCategories.description}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/shop?category=${category.slug}`}
              className="group relative overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-[4/3] bg-muted">
                {category.image?.src ? (
                  <Image
                    src={category.image.src}
                    alt={category.image.alt || category.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {category.name}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="text-lg font-medium text-white">{category.name}</h3>
                {category.count > 0 && (
                  <p className="text-sm text-white/80">
                    {category.count} {category.count === 1 ? "item" : "items"}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
