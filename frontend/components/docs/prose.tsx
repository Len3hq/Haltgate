import Link from "next/link";

function slugify(children: React.ReactNode): string {
  return String(children)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function Lead({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-base leading-relaxed text-[var(--color-text-muted)]">{children}</p>;
}

/// Anchored so any statement in the docs can be linked to directly.
export function H2({ children }: { children: React.ReactNode }) {
  const id = slugify(children);
  return (
    <h2
      id={id}
      className="group mt-12 scroll-mt-24 font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-[var(--color-text)]"
    >
      <a href={`#${id}`} className="no-underline">
        {children}
        <span className="ml-2 text-[var(--color-text-faint)] opacity-0 transition-opacity group-hover:opacity-100">#</span>
      </a>
    </h2>
  );
}

export function H3({ children }: { children: React.ReactNode }) {
  const id = slugify(children);
  return (
    <h3 id={id} className="mt-8 scroll-mt-24 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
      {children}
    </h3>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-muted)]">{children}</p>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="mt-4 space-y-2 text-sm leading-relaxed text-[var(--color-text-muted)]">{children}</ul>;
}

export function LI({ children }: { children: React.ReactNode }) {
  return (
    <li className="relative pl-4 before:absolute before:left-0 before:top-[0.6em] before:h-1 before:w-1 before:rounded-full before:bg-[var(--color-text-faint)]">
      {children}
    </li>
  );
}

export function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-[var(--color-text)]">{children}</strong>;
}

export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-[var(--color-bg-elevated)] px-1.5 py-0.5 font-mono text-[0.85em] text-[var(--color-text)]">
      {children}
    </code>
  );
}

export function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="mt-5 overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border)]">
      <table className="w-full min-w-[30rem] border-collapse text-sm">
        <thead>
          <tr className="bg-[var(--color-bg-elevated)]">
            {head.map((h) => (
              <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-[var(--color-border-subtle)]">
              {r.map((cell, j) => (
                <td key={j} className={`px-3 py-2.5 align-top ${j === 0 ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CALLOUT_STYLE = {
  note: "border-[var(--color-border)] bg-[var(--color-bg-card)]",
  warn: "border-transparent bg-[var(--color-warning-bg)]",
  danger: "border-transparent bg-[var(--color-error-bg)]",
} as const;

const CALLOUT_LABEL = {
  note: "text-[var(--color-text-faint)]",
  warn: "text-[var(--color-warning)]",
  danger: "text-[var(--color-error)]",
} as const;

export function Callout({
  kind = "note",
  title,
  children,
}: {
  kind?: keyof typeof CALLOUT_STYLE;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`mt-5 rounded-[var(--radius-card)] border px-4 py-3 ${CALLOUT_STYLE[kind]}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${CALLOUT_LABEL[kind]}`}>{title}</p>
      <div className="mt-1.5 text-sm leading-relaxed text-[var(--color-text-muted)]">{children}</div>
    </div>
  );
}

export function DocLink({ href, children }: { href: string; children: React.ReactNode }) {
  const external = href.startsWith("http");
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline">
        {children} ↗
      </a>
    );
  }
  return (
    <Link href={href} className="text-[var(--color-accent)] hover:underline">
      {children}
    </Link>
  );
}

/// Monospace address that stays readable on a phone.
export function Addr({ children }: { children: string }) {
  return <span className="break-all font-mono text-[11px] text-[var(--color-text-muted)]">{children}</span>;
}
