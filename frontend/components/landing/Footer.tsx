import { Logo } from "@/components/Logo";
import { XIcon, X_URL } from "./XIcon";

export function Footer() {
  return (
    <footer className="border-t border-border-subtle">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-xs text-text-faint sm:flex-row sm:px-6">
        <div className="flex items-center gap-2">
          <Logo className="h-4 w-4" />
          <span>HaltGate — built on X Layer</span>
        </div>
        <a
          href={X_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 transition-colors hover:text-text"
        >
          <XIcon className="h-3.5 w-3.5" />
          Follow @haltgate_
        </a>
        <p>built by Len3 Team</p>
      </div>
    </footer>
  );
}
