import { BottomNav } from "@/components/layout/BottomNav";
import { LastProjectRouteTracker } from "@/components/layout/LastProjectRouteTracker";
import { TopBar } from "@/components/layout/TopBar";
import { AutoSync } from "@/components/sync/AutoSync";
import { OnlineStatusBridge } from "@/lib/context/OnlineStatusBridge";
import { MapVertexDragProvider } from "@/components/providers/MapVertexDragPreference";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MapVertexDragProvider>
      <OnlineStatusBridge>
        <AutoSync />
        <LastProjectRouteTracker />
        <div className="bg-background flex min-h-dvh flex-col">
          <TopBar />
          <main className="flex flex-1 flex-col px-4 pb-28 pt-4">{children}</main>
          <BottomNav />
        </div>
      </OnlineStatusBridge>
    </MapVertexDragProvider>
  );
}
