import { redirect } from "next/navigation";

import { getAllCategorySlugs } from "@/lib/woocommerce";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllCategorySlugs();
  return slugs;
}

/** Legacy category URLs redirect to the unified shop page with category pre-selected. */
export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;

  const urlParams = new URLSearchParams();
  urlParams.set("category", slug);
  if (pageParam) urlParams.set("page", pageParam);

  redirect(`/shop?${urlParams.toString()}`);
}
