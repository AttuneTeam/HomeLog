"use client"

import { ExternalLink } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface InvoiceViewerProps {
  url: string
  path: string
}

export function InvoiceViewer({ url, path }: InvoiceViewerProps) {
  const ext = path.split(".").pop()?.toLowerCase()
  const isImage = ["jpg", "jpeg", "png", "webp", "heic"].includes(ext ?? "")
  const isPdf = ext === "pdf"

  return (
    <div className="space-y-3">
      {isImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Invoice"
          className="max-w-full rounded-md border"
        />
      )}
      {isPdf && (
        <iframe
          src={url}
          className="w-full h-[600px] rounded-md border"
          title="Invoice PDF"
        />
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
        Open in new tab
      </a>
    </div>
  )
}
