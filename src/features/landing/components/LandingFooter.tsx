import { Link } from "react-router-dom";

import BrandWordmark from "@/shared/components/BrandWordmark";

const footerLinks = [
  { label: "Explore services", to: "/services" },
  { label: "Sign in", to: "/sign-in" },
  { label: "Create account", to: "/register" },
];

export default function LandingFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <Link className="inline-flex min-h-11 items-center gap-2 rounded-md" to="/" aria-label="TrabaWho home">
            <img className="size-9 object-contain" src="/trabawho-logo.svg" alt="" aria-hidden="true" />
            <BrandWordmark className="text-xl" />
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">Local services, easier to find and compare.</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-3" aria-label="Footer navigation">
          {footerLinks.map((link) => (
            <Link className="min-h-11 content-center text-sm font-medium text-muted-foreground hover:text-foreground" key={link.to} to={link.to}>
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="text-sm text-muted-foreground">&copy; 2026 TrabaWho</p>
      </div>
    </footer>
  );
}
