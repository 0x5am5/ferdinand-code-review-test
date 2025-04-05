import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "./page-transition";

interface AppLayoutProps {
  children: ReactNode;
  pageKey: string;
}

export function AppLayout({ children, pageKey }: AppLayoutProps) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <PageTransition key={pageKey}>
            {children}
          </PageTransition>
        </AnimatePresence>
      </main>
    </div>
  );
}