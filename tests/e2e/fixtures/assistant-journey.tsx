import { createRoot } from "react-dom/client";
import FloatingChatbot from "@/shared/components/FloatingChatbot";
import "@/styles/globals.css";
import "@/shared/styles/modern.css";

const root = document.getElementById("root");
if (root) createRoot(root).render(<FloatingChatbot appTheme="dark" currentView="my-bookings" isLoggedIn {...{ role: "client" }} onOpenBrowseServices={() => {}} onOpenChatPage={() => {}} onSearchChange={() => {}} />);
