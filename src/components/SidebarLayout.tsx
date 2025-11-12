import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ROIForecastersModal } from "@/components/ROIForecastersModal";

type SidebarLayoutProps = {
  children: React.ReactNode;
};

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const [roiOpen, setRoiOpen] = useState(false);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        <AppSidebar onOpenROI={() => setRoiOpen(true)} />
        
        <main className="flex-1 flex flex-col">
          <div className="flex-1">
            {children}
          </div>
        </main>
      </div>
      
      <ROIForecastersModal open={roiOpen} onOpenChange={setRoiOpen} />
    </SidebarProvider>
  );
}
