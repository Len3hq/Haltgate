/// Single source for the sidebar, the prev/next footer and route generation,
/// so a new page can never appear in one and be missing from another.
export type DocsPage = { slug: string; title: string; summary: string };
export type DocsGroup = { group: string; pages: DocsPage[] };

export const DOCS: DocsGroup[] = [
  {
    group: "Getting started",
    pages: [
      { slug: "", title: "Introduction", summary: "What HaltGate is and the problem it exists to solve." },
      { slug: "halts", title: "How halts work", summary: "The five-state machine that gates every risk-increasing action." },
      { slug: "testnet", title: "Using the testnet", summary: "Getting tokens, what is real and what is mocked." },
    ],
  },
  {
    group: "Products",
    pages: [
      { slug: "borrow", title: "Borrowing", summary: "Variable-rate loans against tokenized stock collateral." },
      { slug: "fixed-term", title: "Fixed Term", summary: "Fixed rate, fixed end date, no liquidation." },
      { slug: "multiply", title: "Multiply", summary: "Looped exposure in a single transaction." },
      { slug: "earn", title: "Earn", summary: "Supplying USDG and how the share price works." },
    ],
  },
  {
    group: "Mechanics",
    pages: [
      { slug: "liquidations", title: "Liquidations", summary: "How unsafe positions are closed, and when they cannot be." },
      { slug: "settlement", title: "Settlement", summary: "What happens if a halt never ends." },
      { slug: "parameters", title: "Risk parameters", summary: "Every live value, per market." },
    ],
  },
  {
    group: "Reference",
    pages: [
      { slug: "governance", title: "Governance", summary: "Who can change what, and how fast." },
      { slug: "contracts", title: "Contracts", summary: "Every deployed address on X Layer testnet." },
    ],
  },
];

export const FLAT: DocsPage[] = DOCS.flatMap((g) => g.pages);

export function hrefFor(slug: string): string {
  return slug === "" ? "/docs" : `/docs/${slug}`;
}

export function neighbours(slug: string): { prev?: DocsPage; next?: DocsPage } {
  const i = FLAT.findIndex((p) => p.slug === slug);
  if (i === -1) return {};
  return { prev: FLAT[i - 1], next: FLAT[i + 1] };
}
