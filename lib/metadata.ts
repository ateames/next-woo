import { siteConfig } from "@/site.config";
import type { Metadata } from "next";

/**
 * Decode HTML entities (e.g. &amp; → &) for plain-text display.
 * WordPress/WooCommerce API fields often encode ampersands and other characters.
 */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) =>
      String.fromCodePoint(parseInt(dec, 10))
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * Strip HTML tags and decode entities for plain-text display.
 */
export function stripHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, "")).trim();
}

/**
 * Truncate text to a maximum length, adding ellipsis if needed
 */
export function truncateText(text: string, maxLength: number = 200): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

interface ContentMetadataOptions {
  title: string;
  excerpt?: string;
  content?: string;
  slug: string;
  type: "post" | "page";
}

/**
 * Generate consistent metadata for posts and pages
 */
export function generateContentMetadata({
  title,
  excerpt,
  content,
  slug,
  type,
}: ContentMetadataOptions): Metadata {
  const plainTitle = stripHtml(title);
  const description = excerpt
    ? stripHtml(excerpt)
    : content
      ? truncateText(stripHtml(content), 200)
      : "";

  const ogUrl = new URL(`${siteConfig.site_domain}/api/og`);
  ogUrl.searchParams.append("title", plainTitle);
  ogUrl.searchParams.append("description", description);

  const path = type === "post" ? "posts" : "pages";

  return {
    title: plainTitle,
    description,
    openGraph: {
      title: plainTitle,
      description,
      type: "article",
      url: `${siteConfig.site_domain}/${path}/${slug}`,
      images: [
        { url: ogUrl.toString(), width: 1200, height: 630, alt: plainTitle },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: plainTitle,
      description,
      images: [ogUrl.toString()],
    },
  };
}
