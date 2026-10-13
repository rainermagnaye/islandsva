import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";
import type { IconName } from "@/types/icon";
import { Icon } from "./icon";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "ocean";
type Size = "sm" | "md" | "lg";

const base =
  "forced-border inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] font-sans font-semibold leading-5 no-underline transition-[background-color,border-color,color,transform] duration-150 select-none active:translate-y-px disabled:cursor-not-allowed disabled:border-transparent disabled:bg-disabled-fill disabled:text-disabled-ink aria-busy:cursor-progress";

const variants: Record<Variant, string> = {
  primary: "border-transparent bg-action-primary text-on-action-primary hover:bg-action-primary-hover active:bg-action-primary-active",
  secondary: "border-transparent bg-action-secondary text-on-action-secondary hover:bg-action-secondary-hover",
  ghost: "border-border-strong bg-transparent text-ink hover:border-action-secondary hover:bg-action-ghost-hover",
  danger: "border-transparent bg-status-danger text-surface-card",
  ocean: "border-transparent bg-action-ocean text-on-action-ocean hover:bg-action-ocean-hover",
};

const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 text-[0.875rem]",
  md: "min-h-11 px-5 text-[0.9375rem]",
  lg: "min-h-13 px-6 text-[1rem]",
};

type CommonProps = {
  /** primary = the one conversion per view; secondary = supporting; ghost = low emphasis; danger = destructive confirm in a modal; ocean = supporting CTA beside a primary. */
  variant?: Variant;
  size?: Size;
  iconLeft?: IconName;
  iconRight?: IconName;
  block?: boolean;
  className?: string;
  children: ReactNode;
};

type ButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    /** Spinner + aria-busy + disabled — use on every form submit to block double posts. */
    loading?: boolean;
    href?: never;
  };

type LinkButtonProps = CommonProps & {
  /** Navigation renders a link, never a button. */
  href: string;
};

const classesFor = ({ variant = "primary", size = "md", block, className }: CommonProps) =>
  cx(base, variants[variant], sizes[size], block && "w-full", className);

export function Button(props: ButtonProps | LinkButtonProps) {
  if (props.href !== undefined) {
    const { href, iconLeft, iconRight, children } = props;
    const content = (
      <>
        {iconLeft && <Icon name={iconLeft} />}
        <span>{children}</span>
        {iconRight && <Icon name={iconRight} />}
      </>
    );
    return /^https?:\/\//.test(href) ? (
      <a href={href} className={classesFor(props)} rel="noopener noreferrer">
        {content}
      </a>
    ) : (
      <Link href={href} className={classesFor(props)}>
        {content}
      </Link>
    );
  }

  const { variant, size, iconLeft, iconRight, block, className, children, loading, type = "button", disabled, ...rest } =
    props;
  return (
    <button
      {...rest}
      type={type}
      className={classesFor({ variant, size, block, className, children })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
      ) : (
        iconLeft && <Icon name={iconLeft} />
      )}
      <span>{children}</span>
      {!loading && iconRight && <Icon name={iconRight} />}
    </button>
  );
}
