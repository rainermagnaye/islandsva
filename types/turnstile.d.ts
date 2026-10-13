// The subset of Cloudflare Turnstile's browser API we use (explicit rendering).
// https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/

type TurnstileRenderOptions = {
  sitekey: string;
  appearance?: "always" | "execute" | "interaction-only";
  theme?: "auto" | "light" | "dark";
  /** Adds a hidden `cf-turnstile-response` input to the enclosing form (default true). */
  "response-field"?: boolean;
};

interface Window {
  turnstile?: {
    render(container: HTMLElement, options: TurnstileRenderOptions): string | undefined;
    reset(widgetId?: string): void;
    remove(widgetId: string): void;
  };
}
