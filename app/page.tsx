import type { Metadata } from "next";

import {
  HeroSection,
  CategoryGrid,
  FeaturedProductsSection,
  LocalPrideSection,
} from "@/components/home";
import { getHomeCategories, getHomeFeaturedProducts } from "@/lib/home";
import { siteConfig } from "@/site.config";

export const metadata: Metadata = {
  title: "Home",
  description: siteConfig.site_description,
};

export const revalidate = 600;

export default async function Home() {
  const [categories, products] = await Promise.all([
    getHomeCategories(),
    getHomeFeaturedProducts(),
  ]);

  return (
    <main>
      <HeroSection />
      <CategoryGrid categories={categories} />
      <FeaturedProductsSection products={products} />
      <LocalPrideSection />
    </main>
  );
}
