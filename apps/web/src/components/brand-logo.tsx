import type { CSSProperties } from "react";

type BrandLogoProps = {
  /** Rendered width/height in px. */
  size?: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * PedigreePal brand mark: a playful paw on a registry-blue tile.
 * The same artwork is served as the favicon (see src/app/icon.svg).
 * Decorative by default — pair it with a visible/aria-labelled wordmark.
 */
export function BrandLogo({ size = 35, className, style }: BrandLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="8" fill="#275dad" />
      <g fill="#ffffff">
        <ellipse cx="9" cy="14.6" rx="2.3" ry="3" transform="rotate(-18 9 14.6)" />
        <ellipse cx="13.6" cy="11.2" rx="2.5" ry="3.3" />
        <ellipse cx="18.4" cy="11.2" rx="2.5" ry="3.3" />
        <ellipse cx="23" cy="14.6" rx="2.3" ry="3" transform="rotate(18 23 14.6)" />
        <ellipse cx="16" cy="21" rx="5.8" ry="5.1" />
      </g>
    </svg>
  );
}
