import { LinkButton } from "@/components/ui/Button";
import { mainSite } from "@/config";

export function NotFound() {
  return (
    <>
      <title>Page not found · Sarvamangal Education Trust</title>
      <meta name="robots" content="noindex" />
      <div className="mx-auto max-w-3xl px-4 pt-14 pb-24 sm:px-6">
        <p className="eyebrow text-crimson">Page not found</p>
        <h1 className="mt-3 text-[2.1rem] font-semibold sm:text-[2.75rem]">This page isn't here</h1>
        <p className="mt-3 max-w-[60ch] text-ink-muted">
          The link may be old or mistyped. You can make a donation from the start, or head back to our main website.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <LinkButton size="lg" href="/">
            Make a donation
          </LinkButton>
          <LinkButton variant="secondary" size="lg" href={mainSite.home}>
            Go to the main website
          </LinkButton>
        </div>
      </div>
    </>
  );
}
