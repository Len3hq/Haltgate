"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/lib/gsap";

// Scroll-triggered stagger reveal for a section's direct children, per
// UI Pro Max's "Standard" scroll-reveal tier. Scoped to its own container so
// ScrollTrigger doesn't rescan the whole page, and skipped entirely under
// prefers-reduced-motion (children render in their final state immediately).
export function ScrollReveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (!scope.current) return;
        gsap.from(scope.current.children, {
          opacity: 0,
          y: 24,
          duration: 0.5,
          stagger: 0.08,
          ease: "power2.out",
          scrollTrigger: { trigger: scope.current, start: "top 85%" },
        });
      });
      return () => mm.revert();
    },
    { scope }
  );

  return (
    <div ref={scope} className={className}>
      {children}
    </div>
  );
}

export { ScrollTrigger };
