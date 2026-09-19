import Link from "next/link";
import { neighbours, hrefFor, FLAT } from "@/lib/docs-nav";
import { Lead } from "@/components/docs/prose";

/// Every docs page renders through this, so the heading, lead paragraph and
/// prev/next footer stay identical across all of them.
export function DocsPageShell({ slug, children }: { slug: string; children: React.ReactNode }) {
  const page = FLAT.find((p) => p.slug === slug);
  const { prev, next } = neighbours(slug);

  return (
    <article className="min-w-0 max-w-2xl">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-text)]">
        {page?.title}
      </h1>
      {page?.summary && <Lead>{page.summary}</Lead>}

      {children}

      <div className="mt-16 grid gap-3 border-t border-[var(--color-border-subtle)] pt-6 sm:grid-cols-2">
        {prev ? (
          <Link
            href={hrefFor(prev.slug)}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-4 py-3 transition-colors hover:border-[var(--color-accent)]"
          >
            <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-faint)]">Previous</p>
            <p className="mt-0.5 text-sm font-medium text-[var(--color-text)]">{prev.title}</p>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link
            href={hrefFor(next.slug)}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-4 py-3 text-right transition-colors hover:border-[var(--color-accent)] sm:col-start-2"
          >
            <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-faint)]">Next</p>
            <p className="mt-0.5 text-sm font-medium text-[var(--color-text)]">{next.title}</p>
          </Link>
        )}
      </div>
    </article>
  );
}
