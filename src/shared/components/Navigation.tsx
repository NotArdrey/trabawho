import { Search } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import BrandWordmark from "@/shared/components/BrandWordmark";

interface NavigationProps {
  onLoginClick: () => void;
  onBrowseServices: () => void;
  onJoinClick: () => void;
  onProviderClick: () => void;
}

export default function Navigation({
  onLoginClick,
  onBrowseServices,
  onJoinClick,
  onProviderClick,
}: NavigationProps) {
  return (
    <nav className="fixed inset-x-0 top-0 z-[100] border-b bg-background/95 backdrop-blur" aria-label="Public navigation">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:min-h-18 sm:px-6">
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-md" to="/" aria-label="TrabaWho home">
          <img className="size-10 shrink-0 object-contain sm:size-11" src="/trabawho-logo.svg" alt="" aria-hidden="true" />
          <BrandWordmark className="text-xl sm:text-2xl" />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <Button type="button" variant="ghost" onClick={onBrowseServices}>
            <Search aria-hidden="true" />
            Explore services
          </Button>
          <Button asChild variant="ghost">
            <Link to="/#how-it-works">How it works</Link>
          </Button>
          <Button type="button" variant="ghost" onClick={onProviderClick}>
            Become a provider
          </Button>
          <Button type="button" variant="ghost" onClick={onLoginClick}>
            Sign in
          </Button>
          <Button type="button" onClick={onJoinClick}>
            Join TrabaWho
          </Button>
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <Button type="button" variant="ghost" size="icon" onClick={onBrowseServices} aria-label="Explore services">
            <Search aria-hidden="true" />
          </Button>
          <Button type="button" variant="ghost" onClick={onLoginClick}>Sign in</Button>
          <Button className="hidden sm:inline-flex" type="button" onClick={onJoinClick}>Join</Button>
        </div>
      </div>
    </nav>
  );
}
