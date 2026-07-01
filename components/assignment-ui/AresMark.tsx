import type { SVGProps } from "react";

export function AresMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      focusable="false"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M3.75 20 10.7 4.7a1.42 1.42 0 0 1 2.6 0l4.08 8.98"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
      <path
        d="m18.42 15.96 1.84 4.04"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="butt"
      />
    </svg>
  );
}
