"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Banknote, Home, Wrench, FolderClosed } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  propertyId: string;
}

const tabs = [
  { label: "Rent", value: "rent", href: (id: string) => `/properties/${id}/rent`, icon: Home },
  { label: "Renovation", value: "renovations", href: (id: string) => `/properties/${id}/renovations`, icon: Wrench },
  { label: "Files", value: "files", href: (id: string) => `/properties/${id}/files`, icon: FolderClosed },
  { label: "Loan", value: "loan", href: (id: string) => `/properties/${id}/loan`, icon: Banknote },
] as const;

export function PropertyTabNav({ propertyId }: Props) {
  const pathname = usePathname();

  return (
    <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground mb-6">
      {tabs.map(({ label, value, href, icon: Icon }) => {
        const isActive = pathname === href(propertyId);
        return (
          <Link
            key={value}
            href={href(propertyId)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "hover:bg-background/50 hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
