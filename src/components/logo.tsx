import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  href?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
};

const sizeMap = {
  sm: 24,
  md: 30,
  lg: 38,
} as const;

const wordmarkClass = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl",
} as const;

function LogoMark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <defs>
        <linearGradient
          id="recall-mark"
          x1="2"
          y1="2"
          x2="30"
          y2="30"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#9a7dff" />
          <stop offset="1" stopColor="#6b46f0" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="29" height="29" rx="8.5" fill="url(#recall-mark)" />
      <path
        d="M10 11.5 15 16 10 20.5"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M16.75 20.5 H22" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({
  className,
  href = "/",
  showWordmark = true,
  size = "md",
}: LogoProps) {
  const px = sizeMap[size];

  const content = (
    <>
      <LogoMark size={px} />
      {showWordmark && (
        <span className={cn(wordmarkClass[size], "text-foreground")}>Recall</span>
      )}
    </>
  );

  const classes = cn("inline-flex items-center gap-2.5 font-semibold tracking-tight", className);

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return <div className={classes}>{content}</div>;
}
