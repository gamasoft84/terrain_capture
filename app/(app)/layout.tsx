import { BottomNav } from "@/components/layout/BottomNav";
import { WelcomeTour } from "@/components/onboarding/WelcomeTour";
import { FieldBatteryHint } from "@/components/layout/FieldBatteryHint";
import { LastProjectRouteTracker } from "@/components/layout/LastProjectRouteTracker";
import { TopBar } from "@/components/layout/TopBar";
import { OfflineBanner } from "@/components/sync/OfflineBanner";
import { SyncConflictGate } from "@/components/sync/SyncConflictGate";
import { SyncQueueProvider } from "@/components/sync/SyncQueueProvider";
import { OnlineStatusBridge } from "@/lib/context/OnlineStatusBridge";
import { MapEnginePreferenceProvider } from "@/components/providers/MapEnginePreference";
import { FieldModePreferenceProvider } from "@/components/providers/FieldModePreference";
import { MapFitBoundsMaxZoomProvider } from "@/components/providers/MapFitBoundsMaxZoomPreference";
import { MapOutlineOnlyProvider } from "@/components/providers/MapOutlineOnlyPreference";
import { MapVertexDragProvider } from "@/components/providers/MapVertexDragPreference";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MapEnginePreferenceProvider>
      <MapVertexDragProvider>
        <FieldModePreferenceProvider>
          <MapOutlineOnlyProvider>
            <MapFitBoundsMaxZoomProvider>
              <OnlineStatusBridge>
                <SyncQueueProvider>
                  <SyncConflictGate />
                  <LastProjectRouteTracker />
                  <WelcomeTour />
                  <div className="bg-background flex min-h-dvh flex-col">
                    <div className="bg-background sticky top-0 z-40 flex flex-col">
                      <OfflineBanner />
                      <TopBar />
                      <FieldBatteryHint />
                    </div>
                    <main className="flex flex-1 flex-col px-4 pb-28 pt-4">
                      {children}
                    </main>
                    <BottomNav />
                  </div>
                </SyncQueueProvider>
              </OnlineStatusBridge>
            </MapFitBoundsMaxZoomProvider>
          </MapOutlineOnlyProvider>
        </FieldModePreferenceProvider>
      </MapVertexDragProvider>
    </MapEnginePreferenceProvider>
  );
}
