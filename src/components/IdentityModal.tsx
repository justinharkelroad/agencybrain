import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface IdentityModalProps {
  open: boolean;
  onSubmit: (name: string, email: string) => void;
  isSubmitting?: boolean;
}

export const IdentityModal = ({ open, onSubmit, isSubmitting = false }: IdentityModalProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = () => {
    if (name.trim() && email.trim()) {
      onSubmit(name.trim(), email.trim());
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Enter Your Information</DialogTitle>
          <DialogDescription>
            Please provide your name and email to access the roleplay bot.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input 
              id="name"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input 
              id="email"
              type="email"
              placeholder="john@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>
          <Button 
            onClick={handleSubmit}
            disabled={!name.trim() || !email.trim() || isSubmitting}
            className="w-full"
          >
            {isSubmitting ? 'Submitting...' : 'Continue'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
