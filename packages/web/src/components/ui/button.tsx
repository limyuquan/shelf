import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn.ts";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg hover:brightness-110 shadow-sm",
  secondary:
    "bg-surface-raised text-fg border border-border hover:bg-surface-hover hover:border-border-strong",
  ghost: "text-fg-muted hover:text-fg hover:bg-surface-hover",
  danger: "text-fg-muted hover:text-red hover:bg-red/10",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 px-2.5 gap-1.5 text-[12.5px]",
  md: "h-8 px-3 gap-2 text-[13px]",
  icon: "size-7",
};

/** Button classes, also for links that should look like buttons. */
export function buttonStyles({
  variant = "secondary",
  size = "sm",
}: {
  variant?: Variant;
  size?: Size;
} = {}): string {
  return cn(
    "inline-flex shrink-0 select-none items-center justify-center rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-3.5 [&_svg]:shrink-0",
    VARIANTS[variant],
    SIZES[size],
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        buttonStyles({ ...(variant ? { variant } : {}), ...(size ? { size } : {}) }),
        className,
      )}
      {...props}
    />
  );
});

/** A square, icon-only button. Always give it a `label` for screen readers. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, "size"> & { label: string }
>(function IconButton({ label, variant = "ghost", ...props }, ref) {
  return <Button ref={ref} aria-label={label} variant={variant} size="icon" {...props} />;
});
