import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/core/utils";

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
    <Image
      src="/logo.png"
      alt="wenlo logo"
      width={size}
      height={size}
      priority
      className="shrink-0"
    />
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
        <span className={cn(wordmarkClass[size], "text-foreground")}>wenlo</span>
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
