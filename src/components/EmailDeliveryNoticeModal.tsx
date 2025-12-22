import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Mail, CheckCircle } from "lucide-react";

interface EmailDeliveryNoticeModalProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function EmailDeliveryNoticeModal({ 
  trigger, 
  open: controlledOpen, 
  onOpenChange: controlledOnOpenChange 
}: EmailDeliveryNoticeModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const onOpenChange = isControlled ? controlledOnOpenChange : setInternalOpen;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Mail className="h-5 w-5" />
            Important for Email Delivery
          </DialogTitle>
          <DialogDescription>
            Please share this with your team members to ensure they receive notifications
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 text-sm">
            <p className="text-muted-foreground">
              Hi there,
            </p>
            
            <p>
              You may not be receiving email notifications from Agency Brain due to your corporate email security filters. To ensure you receive important updates like your Daily Summary and other notifications, please follow one of the options below:
            </p>

            {/* Option 1 */}
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              <h3 className="font-semibold flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span>
                Add to Safe Senders (Quick Fix)
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-2">
                <li>Open Outlook (desktop or web version)</li>
                <li>Click the Settings gear icon → Mail → Junk email</li>
                <li>Scroll to "Safe senders and domains" and click + Add</li>
                <li>
                  Add these two entries (one at a time):
                  <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                    <li><code className="bg-muted px-1 py-0.5 rounded text-xs">info@agencybrain.standardplaybook.com</code></li>
                    <li><code className="bg-muted px-1 py-0.5 rounded text-xs">standardplaybook.com</code></li>
                  </ul>
                </li>
                <li>Click Save</li>
              </ol>
            </div>

            {/* Option 2 */}
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              <h3 className="font-semibold flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">2</span>
                Create an Inbox Rule
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground ml-2">
                <li>In Outlook, go to Settings → Mail → Rules</li>
                <li>Click + Add new rule</li>
                <li>Name it: <strong>Agency Brain Whitelist</strong></li>
                <li>Set the condition: "From" contains <code className="bg-muted px-1 py-0.5 rounded text-xs">standardplaybook.com</code></li>
                <li>Set the action: "Move to Inbox"</li>
                <li>Save the rule</li>
              </ol>
            </div>

            {/* Option 3 */}
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              <h3 className="font-semibold flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">3</span>
                Contact Your IT Department (Most Reliable)
              </h3>
              <p className="text-muted-foreground ml-2">
                If the options above don't work, please forward this request to your IT team:
              </p>
              <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground ml-2">
                "Please whitelist the domain <strong>standardplaybook.com</strong> and the email address <strong>info@agencybrain.standardplaybook.com</strong> in our organization's email security filter. These are legitimate business notifications I need to receive."
              </blockquote>
            </div>

            {/* Check Junk Folder */}
            <div className="space-y-3 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
              <h3 className="font-semibold flex items-center gap-2 text-amber-600">
                <CheckCircle className="h-4 w-4" />
                Check Your Junk Folder
              </h3>
              <p className="text-muted-foreground">
                Your previous emails may already be in your Junk or Spam folder. If you find them there, right-click and select "Mark as Not Junk" to help train the filter.
              </p>
            </div>

            <p className="text-muted-foreground">
              Let me know if you have any questions or need help!
            </p>
          </div>
        </ScrollArea>
        
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={() => onOpenChange?.(false)}>
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EmailDeliveryNoticeButton() {
  return (
    <EmailDeliveryNoticeModal
      trigger={
        <Button 
          variant="outline" 
          className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          Important for Email Delivery
        </Button>
      }
    />
  );
}
