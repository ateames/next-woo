import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/nav/mobile-nav";
import { CartDrawer } from "@/components/shop";
import { mainMenu, mainMenuLabels } from "@/menu.config";
import { siteConfig } from "@/site.config";
import { cn } from "@/lib/utils";
import Logo from "@/public/logo.svg";

interface NavProps {
  className?: string;
  children?: React.ReactNode;
  id?: string;
}

export function Nav({ className, children, id }: NavProps) {
  return (
    <nav
      className={cn("sticky z-50 top-0 bg-background", "border-b", className)}
      id={id}
    >
      <div
        id="nav-container"
        className="max-w-6xl mx-auto py-4 px-6 sm:px-8 flex justify-between items-center"
      >
        <Link
          className="hover:opacity-75 transition-all flex gap-4 items-center"
          href="/"
        >
          <Image
            src={Logo}
            alt="Logo"
            loading="eager"
            className="dark:invert"
            width={42}
            height={26.44}
          />
          <span className="hidden text-sm font-medium sm:inline">
            {siteConfig.site_name}
          </span>
        </Link>
        {children}
        <div className="flex items-center gap-2">
          <div className="mx-2 hidden lg:flex">
            {Object.entries(mainMenu).map(([key, href]) => (
              <Button key={href} asChild variant="ghost" size="sm">
                <Link href={href}>
                  {mainMenuLabels[key as keyof typeof mainMenu]}
                </Link>
              </Button>
            ))}
          </div>
          <CartDrawer />
          <MobileNav />
        </div>
      </div>
    </nav>
  );
}
