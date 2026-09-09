import { useState } from "react";
import { BotMessageSquare, ChevronLeft, ChevronRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface MobileChatbotLauncherProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
}

function startsCollapsedOnMobile() {
  return typeof window !== "undefined" && window.innerWidth <= 880;
}

export default function MobileChatbotLauncher({ isOpen, onClose, onToggle }: MobileChatbotLauncherProps) {
  const [isCollapsed, setIsCollapsed] = useState(startsCollapsedOnMobile);

  const toggleCollapsed = () => {
    if (!isCollapsed) onClose();
    setIsCollapsed((collapsed) => !collapsed);
  };

  return (
    <div className="pointer-events-auto flex items-center gap-1">
      {!isCollapsed ? (
        <button
          type="button"
          className="gl-chatbot-toggle"
          aria-label={isOpen ? "Close TrabaWho assistant" : "Open TrabaWho assistant"}
          aria-expanded={isOpen}
          onClick={onToggle}
        >
          {isOpen ? <X size={24} aria-hidden="true" /> : <BotMessageSquare className="gl-chatbot-toggle-icon" size={29} aria-hidden="true" />}
        </button>
      ) : null}
      <Button
        type="button"
        variant="primary"
        size="icon"
        className="h-12 min-h-12 w-9 translate-x-2 rounded-l-full rounded-r-none px-0 shadow-sm [&_svg]:size-5 min-[881px]:hidden"
        aria-label={isCollapsed ? "Show TrabaWho assistant button" : "Hide TrabaWho assistant button"}
        aria-expanded={!isCollapsed}
        onClick={toggleCollapsed}
      >
        {isCollapsed ? <ChevronLeft aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
      </Button>
    </div>
  );
}
