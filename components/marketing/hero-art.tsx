import { LogoLockup } from "@/components/layout/logo";

/**
 * Hero shows only the palm badge from the supplied logo. The wordmark stays in the header and footer.
 * Status chips sit outside the badge; they are not part of the logo.
 */
export function HeroArt() {
  return (
    <div aria-hidden="true" className="hero-late relative mx-auto w-full max-w-[480px] py-16">
      <LogoLockup alt="" className="mx-auto w-[300px]" sizes="300px" />
      <div className="float-soft absolute top-0 left-0 flex items-center gap-2 rounded-pill border border-border bg-surface-card px-3 py-2 type-label elevation-md sm:-left-2">
        <span className="size-2 rounded-full bg-status-success" />
        Inbox cleared · 7:58 am
      </div>
      <div className="float-soft-late absolute right-0 bottom-0 flex items-center gap-2 rounded-pill border border-border bg-surface-card px-3 py-2 type-label elevation-md sm:-right-2">
        <span className="size-2 rounded-full bg-brand-sun" />
        Night shift online
      </div>
    </div>
  );
}
