/** Static copy and layout config for the home landing page (pleasantonthreads.com). */

export const homeHero = {
  headline: "Support Local Shop Small",
  description:
    "Locally inspired apparel and gifts celebrating Pleasanton pride — tees, hoodies, youth wear, baby onesies, hats, and more.",
  cta: { label: "Shop Now", href: "/shop" },
} as const;

export const homeFeatured = {
  title: "Check out our latest threads!",
  description: "Fresh designs and local favorites, made for Pleasanton and beyond.",
  cta: { label: "Shop all Pleasanton Threads", href: "/shop" },
  productCount: 8,
} as const;

export const homeCategories = {
  title: "Shop by category",
  description: "Find the perfect fit for everyone in the family.",
} as const;

/** Category slugs shown on the home page, in display order (matches live site nav). */
export const homeCategorySlugs = [
  "womens",
  "all-shirts",
  "hoodies-sweatshirts",
  "youth_kids",
  "baby",
  "hats",
  "home_living",
] as const;

export const homeLocalPride = {
  title: "Wear your Pleasanton pride",
  points: [
    {
      title: "Local designs",
      description:
        "Vintage-inspired graphics, landmarks, and inside jokes that celebrate life in Pleasanton.",
    },
    {
      title: "Something for everyone",
      description:
        "Women's, adult tees, hoodies, youth & kids, baby, hats, and home goods.",
    },
    {
      title: "Support local",
      description:
        "Shop small and rep your hometown with apparel made for the community.",
    },
  ],
} as const;
