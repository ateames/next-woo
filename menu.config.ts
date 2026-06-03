// Main navigation (matches pleasantonthreads.com shop menu)
export const mainMenu = {
  shop: "/shop",
  womens: "/shop?category=womens",
  shirts: "/shop?category=all-shirts",
  hoodies: "/shop?category=hoodies-sweatshirts",
  youth: "/shop?category=youth_kids",
  baby: "/shop?category=baby",
  hats: "/shop?category=hats",
  home: "/shop?category=home_living",
};

export const mainMenuLabels: Record<keyof typeof mainMenu, string> = {
  shop: "Shop",
  womens: "Women's",
  shirts: "Adult T-Shirts",
  hoodies: "Hoodies & Sweatshirts",
  youth: "Youth & Kids",
  baby: "Baby",
  hats: "Hats",
  home: "Home & Living",
};

export const contentMenu = {
  categories: "/posts/categories",
  tags: "/posts/tags",
  authors: "/posts/authors",
};

export const shopMenu = {
  products: "/shop",
  cart: "/cart",
  account: "/account",
};
