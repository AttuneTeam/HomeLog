import Link from "next/link"
import { type VariantProps } from "class-variance-authority"
import { cn, type ClassValue } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

interface ButtonLinkProps extends VariantProps<typeof buttonVariants> {
  href: string
  className?: ClassValue
  children: React.ReactNode
  target?: string
  rel?: string
}

export function ButtonLink({ href, variant, size, className, children, target, rel }: ButtonLinkProps) {
  return (
    <Link
      href={href}
      target={target}
      rel={rel}
      className={cn(buttonVariants({ variant, size }), className)}
    >
      {children}
    </Link>
  )
}
