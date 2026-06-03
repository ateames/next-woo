import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { homeHero } from "@/lib/home-content";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HeroSection({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "relative overflow-hidden border-b bg-gradient-to-br from-amber-50 via-background to-orange-50/80 dark:from-amber-950/30 dark:via-background dark:to-orange-950/20",
        className
      )}
    >
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl dark:bg-amber-800/20" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-orange-200/50 blur-3xl dark:bg-orange-900/20" />

      <div className="relative mx-auto max-w-6xl px-6 py-20 sm:px-8 sm:py-28 md:py-32">
        <p className="mb-4 text-sm font-medium uppercase tracking-widest text-amber-800 dark:text-amber-300">
          {homeHero.eyebrow}
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl">
          {homeHero.headline}
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl">
          {homeHero.description}
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Button asChild size="lg" className="gap-2">
            <Link href={homeHero.cta.href}>
              {homeHero.cta.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="#categories">Browse categories</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
