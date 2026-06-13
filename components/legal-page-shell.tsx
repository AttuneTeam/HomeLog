import Link from "next/link";
import Image from "next/image";

export function LegalPageShell({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#fbf9f9", color: "#1b1c1c" }}
    >
      {/* Nav */}
      <header
        className="w-full border-b sticky top-0 z-50"
        style={{ backgroundColor: "#fbf9f9", borderColor: "rgba(198,198,204,0.3)" }}
      >
        <nav className="max-w-3xl mx-auto px-6 md:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Home Base"
              width={32}
              height={32}
              className="h-8 w-auto object-contain"
            />
            <span
              className="font-caslon text-xl tracking-tight"
              style={{ color: "#030813" }}
            >
              Home Base
            </span>
          </Link>
          <Link
            href="/"
            className="text-xs uppercase tracking-widest font-semibold hover:underline"
            style={{ color: "#45474c", fontFamily: "var(--font-grotesk)" }}
          >
            Back to home
          </Link>
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-6 md:px-8 py-16">
        <h1
          className="font-caslon text-[40px] leading-[48px] mb-3"
          style={{ color: "#030813" }}
        >
          {title}
        </h1>
        <p
          className="text-sm mb-12"
          style={{ color: "#45474c", fontFamily: "var(--font-grotesk)" }}
        >
          Last updated: {lastUpdated}
        </p>

        <div
          className="legal-prose space-y-8 text-[15px] leading-7"
          style={{ color: "#1b1c1c", fontFamily: "var(--font-grotesk)" }}
        >
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer
        className="w-full border-t"
        style={{ backgroundColor: "#f5f3f3", borderColor: "rgba(198,198,204,0.2)" }}
      >
        <div className="max-w-3xl mx-auto px-6 md:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p
            className="text-sm"
            style={{ color: "#45474c", fontFamily: "var(--font-grotesk)" }}
          >
            © {new Date().getFullYear()} Home Base
          </p>
          <div className="flex gap-6">
            <Link
              href="/privacy"
              className="text-sm hover:underline"
              style={{ color: "#45474c", fontFamily: "var(--font-grotesk)" }}
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-sm hover:underline"
              style={{ color: "#45474c", fontFamily: "var(--font-grotesk)" }}
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2
        className="font-caslon text-[22px] leading-7"
        style={{ color: "#030813" }}
      >
        {heading}
      </h2>
      <div className="space-y-3" style={{ color: "#45474c" }}>
        {children}
      </div>
    </section>
  );
}
