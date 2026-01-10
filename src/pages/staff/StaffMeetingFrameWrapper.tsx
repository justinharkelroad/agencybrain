import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MeetingFrameTab } from '@/components/agency/MeetingFrameTab';

/**
 * Wrapper component that renders the real MeetingFrameTab for staff users.
 * Gets agencyId from localStorage and passes it to the component.
 */
const StaffMeetingFrameWrapper = () => {
  const agencyId = localStorage.getItem('staff_agency_id');

  if (!agencyId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">No agency selected. Please select an agency first.</p>
        <Link to="/staff">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Staff Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-muted/30 px-6 py-4">
        <Link to="/staff/metrics" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Metrics
        </Link>
      </div>
      <div className="p-6">
        <MeetingFrameTab agencyId={agencyId} />
      </div>
    </div>
  );
};

export default StaffMeetingFrameWrapper;
