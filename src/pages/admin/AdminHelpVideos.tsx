import { HelpVideoManager } from '@/components/admin/HelpVideoManager';

export default function AdminHelpVideos() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-medium">Help Videos Management</h1>
        <p className="text-muted-foreground/70 mt-1">
          Manage training videos that appear throughout the app
        </p>
      </div>
      
      <HelpVideoManager />
    </div>
  );
}
