import { BottomNav } from "@/components/layout/BottomNav";
import { TopBar } from "@/components/layout/TopBar";
import { MapVertexDragProvider } from "@/components/providers/MapVertexDragPreference";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MapVertexDragProvider>
      <div className="bg-background flex min-h-dvh flex-col">
        <TopBar />
        <main className="flex flex-1 flex-col px-4 pb-28 pt-4">{children}</main>
        <BottomNav />
      </div>
    </MapVertexDragProvider>
  );
}
