import { ReactNode } from "react";
import BottomNav from "./BottomNav";
import SideNav from "./SideNav";

/**
 * Responsive application shell.
 *
 * - Mobile (<640px): single column, floating bottom nav (unchanged).
 * - Tablet (640–1024px): wider, breathing-room container.
 * - Desktop (>1024px): persistent side navigation + contained, centered
 *   content so cards and text never stretch edge to edge.
 */
const AppShell = ({ children, wide }: { children: ReactNode; wide?: boolean }) => (
  <div className="min-h-dvh bg-background lg:pl-64">
    <SideNav />
    <main
      className={`mx-auto w-full ${wide ? "lg:max-w-6xl" : "lg:max-w-5xl"} sm:max-w-2xl md:max-w-3xl px-0 sm:px-3 lg:px-8 pb-28 lg:pb-12`}
    >
      {children}
    </main>
    <BottomNav />
  </div>
);

export default AppShell;
