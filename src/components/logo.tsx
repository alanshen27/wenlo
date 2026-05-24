import Image from "next/image";
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
  md: 32,
  lg: 40,
} as const;

const wordmarkClass = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl",
} as const;

export function Logo({
  className,
  href = "/",
  showWordmark = true,
  size = "md",
}: LogoProps) {
  const px = sizeMap[size];

  const content = (
    <>
      <Image
        src="/logo-light.png"
        alt=""
        width={px}
        height={px}
        className="dark:hidden"
        aria-hidden
      />
      <Image
        src="/logo-dark.png"
        alt=""
        width={px}
        height={px}
        className="hidden dark:block"
        aria-hidden
      />
      {showWordmark && (
        <span className={wordmarkClass[size]}>
          <span className="text-primary">recalls</span>
          <span className="text-muted-foreground">.sh</span>
        </span>
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
