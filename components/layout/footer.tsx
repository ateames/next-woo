import Link from "next/link";
import Image from "next/image";
import { Section, Container } from "@/components/craft";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { mainMenu, mainMenuLabels } from "@/menu.config";
import { siteConfig } from "@/site.config";
import Logo from "@/public/logo.svg";

export function Footer() {
  return (
    <footer>
      <Section>
        <Container className="grid md:grid-cols-[1.5fr_1fr] gap-12">
          <div className="flex flex-col gap-6 not-prose">
            <Link href="/">
              <h3 className="sr-only">{siteConfig.site_name}</h3>
              <Image
                src={Logo}
                alt="Logo"
                className="dark:invert"
                width={42}
                height={26.44}
              />
            </Link>
            <p>{siteConfig.site_description}</p>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <h5 className="font-medium text-base">Shop</h5>
            {Object.entries(mainMenu).map(([key, href]) => (
              <Link
                className="hover:underline underline-offset-4"
                key={href}
                href={href}
              >
                {mainMenuLabels[key as keyof typeof mainMenu]}
              </Link>
            ))}
          </div>
        </Container>
        <Container className="border-t not-prose flex flex-col md:flex-row md:gap-2 gap-6 justify-between md:items-center">
          <ThemeToggle />
          <p className="text-muted-foreground">
            &copy; {new Date().getFullYear()} {siteConfig.site_name}. All rights
            reserved.
          </p>
        </Container>
      </Section>
    </footer>
  );
}
