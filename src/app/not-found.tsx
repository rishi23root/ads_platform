import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-zinc-950 font-sans antialiased">
      <Image
        src="/images/not-found-bg.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[center_top]"
      />

      {/* Readability: darken edges + heavier floor so large type stays WCAG-friendly while the vista stays visible */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_35%,transparent_20%,rgba(0,0,0,0.45)_75%,rgba(0,0,0,0.78)_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-t from-black via-black/70 to-black/25"
        aria-hidden
      />

      <main className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col justify-end px-6 pb-16 pt-40 md:px-12 md:pb-24">
        <div className="flex flex-col gap-8 md:max-w-2xl">
          <header className="space-y-8">
            <h1 className="space-y-6">
              <span
                className={cn(
                  "block font-semibold tracking-tighter text-white drop-shadow-[0_4px_32px_rgba(0,0,0,0.85)]",
                  "text-[clamp(5rem,22vw,11rem)] leading-[0.85]"
                )}
              >
                404
              </span>
              <span className="block max-w-xl text-balance text-3xl font-semibold tracking-tight text-white drop-shadow-lg md:text-4xl lg:text-5xl">
                You&apos;re off the map
              </span>
            </h1>
            <p className="max-w-lg text-pretty text-lg leading-relaxed text-white/90 md:text-xl">
              This URL doesn&apos;t exist anymore—or never did. Head home and pick up the trail from
              there.
            </p>
          </header>

          <div className="flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              asChild
              size="lg"
              className={cn(
                "min-h-12 px-8 text-base font-semibold shadow-lg",
                "border-0 bg-white text-zinc-950 hover:bg-zinc-100",
                "focus-visible:border-transparent focus-visible:ring-[3px] focus-visible:ring-white",
                "focus-visible:ring-offset-[3px] focus-visible:ring-offset-zinc-950"
              )}
            >
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
