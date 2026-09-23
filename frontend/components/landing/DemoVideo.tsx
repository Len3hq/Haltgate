import { ScrollReveal } from "./ScrollReveal";

export function DemoVideo() {
  return (
    <section id="demo" className="mx-auto max-w-5xl px-4 pb-4 sm:px-6">
      <ScrollReveal>
        <div className="overflow-hidden rounded-card-lg border border-border bg-bg-card">
          <video
            className="block aspect-video w-full"
            src="/brag.mp4"
            poster="/brag-poster.jpg"
            controls
            playsInline
            preload="metadata"
            aria-label="HaltGate explainer: how lending freezes when stock trading halts"
          />
        </div>
      </ScrollReveal>
    </section>
  );
}
