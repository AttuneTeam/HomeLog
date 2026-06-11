import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * Breadcrumb trail. At >=600px it shows the full path; below that it collapses
 * to a single "Back" link that goes up one level (to the previous crumb).
 */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  // The crumb one level up is the last item that has an href before the current
  // (last) item.
  const parent = items.length >= 2 ? items[items.length - 2] : undefined;

  return (
    <div className={cn("text-muted-foreground text-sm", className)}>
      {/* Full trail (>=600px) */}
      <div className="hidden min-[600px]:flex items-center gap-2 flex-wrap">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <span key={i} className="flex items-center gap-2">
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
              {!isLast && <span>/</span>}
            </span>
          );
        })}
      </div>

      {/* Collapsed back link (<600px) */}
      {parent?.href && (
        <Link
          href={parent.href}
          className="flex min-[600px]:hidden items-center gap-1 hover:underline -ml-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to {parent.label}
        </Link>
      )}
    </div>
  );
}
