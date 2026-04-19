import { BottomNav } from "@/components/layout/BottomNav";
import { LastProjectRouteTracker } from "@/components/layout/LastProjectRouteTracker";
import { TopBar } from "@/components/layout/TopBar";
import { OfflineBanner } from "@/components/sync/OfflineBanner";
import { SyncQueueProvider } from "@/components/sync/SyncQueueProvider";
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
        <SyncQueueProvider>
          <LastProjectRouteTracker />
          <div className="bg-background flex min-h-dvh flex-col">
            <div className="bg-background sticky top-0 z-40 flex flex-col">
              <OfflineBanner />
              <TopBar />
            </div>
            <main className="flex flex-1 flex-col px-4 pb-28 pt-4">{children}</main>
            <BottomNav />
          </div>
        </SyncQueueProvider>
      </OnlineStatusBridge>
    </MapVertexDragProvider>
  );
}
