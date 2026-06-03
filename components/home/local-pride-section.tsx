import { Heart, MapPin, Users } from "lucide-react";

import { homeLocalPride } from "@/lib/home-content";
import { cn } from "@/lib/utils";

const icons = [MapPin, Users, Heart] as const;

export function LocalPrideSection({ className }: { className?: string }) {
  return (
    <section className={cn("py-16 md:py-20", className)}>
      <div className="mx-auto max-w-6xl px-6 sm:px-8">
        <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          {homeLocalPride.title}
        </h2>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {homeLocalPride.points.map((point, index) => {
            const Icon = icons[index] ?? Heart;
            return (
              <div
                key={point.title}
                className="flex flex-col items-center text-center md:items-start md:text-left"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-medium">{point.title}</h3>
                <p className="mt-2 text-muted-foreground">{point.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
