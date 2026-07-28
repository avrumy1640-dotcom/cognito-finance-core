import { ReactNode } from "react";

/**
 * Legacy page wrapper. Navigation and the responsive container now live in
 * AppShell (applied at the route level), so this is a transparent pass-through
 * kept so existing pages don't all need editing.
 */
const AppLayout = ({ children }: { children: ReactNode }) => <>{children}</>;

export default AppLayout;
