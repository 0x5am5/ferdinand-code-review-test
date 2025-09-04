import { AnimatePresence } from "framer-motion";
import type { FC, ReactNode } from "react";
import { PageTransition } from "./page-transition";
import { RoleSwitchingFAB } from "./role-switching-fab";
import { Sidebar } from "./sidebar";

interface AppLayoutProps {
	children: ReactNode;
	pageKey: string;
}

/**
 * App layout component that provides a consistent layout structure with
 * fixed sidebar and animated page transitions
 */
export const AppLayout: FC<AppLayoutProps> = ({ children, pageKey }) => {
	return (
		<div className="flex h-screen overflow-hidden">
			{/* Fixed sidebar that doesn't re-render during page transitions */}
			<Sidebar />

			{/* Main content area with animated page transitions */}
			<main className="bg-white flex-1 overflow-y-auto ml-64">
				<AnimatePresence mode="wait">
					<PageTransition key={pageKey}>{children}</PageTransition>
				</AnimatePresence>
			</main>

			{/* Floating Action Button for Role Switching */}
			<RoleSwitchingFAB />
		</div>
	);
};
