import { HelpContentManager } from '@/components/admin/HelpContentManager';

export default function AdminHelpVideos() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-medium">Help Content Management</h1>
        <p className="text-muted-foreground/70 mt-1">
          Manage training videos and PDF walkthroughs that appear throughout the app
        </p>
      </div>
      
      <HelpContentManager />
    </div>
  );
}
