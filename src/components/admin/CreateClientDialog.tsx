import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

interface CreateClientDialogProps {
  onClientCreated: () => void;
}

export function CreateClientDialog({ onClientCreated }: CreateClientDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    agencyName: '',
    agencyDescription: '',
    mrr: '',
    membershipTier: '1:1 Coaching'
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get the current session to send the auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No authentication token found');
      }

      // Call the edge function to create the user
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          agencyName: formData.agencyName,
          agencyDescription: formData.agencyDescription,
          membershipTier: formData.membershipTier
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Success",
        description: "Client account created successfully",
      });

      // Optionally set initial Coaching MRR using edge function
      try {
        if (formData.mrr && !Number.isNaN(Number(formData.mrr)) && data?.user?.id) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            const mrrResponse = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-client-profile`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  client_id: data.user.id,
                  mrr: Number(formData.mrr),
                }),
              }
            );
            if (!mrrResponse.ok) {
              const mrrResult = await mrrResponse.json();
              console.error('Failed to set initial MRR:', mrrResult.error);
            }
          }
        }
      } catch (mrrError) {
        console.error('Failed to set initial MRR:', mrrError);
      }

      setFormData({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        agencyName: '',
        agencyDescription: '',
        mrr: '',
        membershipTier: '1:1 Coaching'
      });
      setOpen(false);
      onClientCreated();

    } catch (error: any) {
      console.error('Error creating client:', error);
      
      // Extract specific error message from edge function response
      let errorMessage = "Failed to create client account";
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.error) {
        errorMessage = error.error;
      }
      
      // Handle specific error cases
      if (errorMessage.includes('already exists')) {
        errorMessage = "A user with this email already exists";
      } else if (errorMessage.includes('non-2xx status code')) {
        errorMessage = "Server error occurred. Please try again or contact support.";
      } else if (errorMessage.includes('Missing required fields')) {
        errorMessage = "Please fill in all required fields";
      } else if (errorMessage.includes('Only admin users')) {
        errorMessage = "You don't have permission to create client accounts";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="w-4 h-4 mr-2" />
          Create Client
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Client</DialogTitle>
          <DialogDescription>
            Create a new client account with their agency information.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              required
              minLength={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agencyName">Agency Name</Label>
            <Input
              id="agencyName"
              value={formData.agencyName}
              onChange={(e) => setFormData(prev => ({ ...prev, agencyName: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agencyDescription">Agency Description (Optional)</Label>
            <Textarea
              id="agencyDescription"
              value={formData.agencyDescription}
              onChange={(e) => setFormData(prev => ({ ...prev, agencyDescription: e.target.value }))}
              placeholder="Brief description of the agency..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="membershipTier">Membership Level</Label>
            <Select 
              value={formData.membershipTier} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, membershipTier: value }))}
            >
              <SelectTrigger id="membershipTier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1:1 Coaching">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-500">1:1 Coaching</Badge>
                    <span className="text-sm text-muted-foreground">Full Access</span>
                  </div>
                </SelectItem>
                <SelectItem value="Boardroom">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-red-500">Boardroom</Badge>
                    <span className="text-sm text-muted-foreground">Dashboard Focus</span>
                  </div>
                </SelectItem>
                <SelectItem value="Call Scoring 30">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-500">Call Scoring 30</Badge>
                    <span className="text-sm text-muted-foreground">30 calls/month</span>
                  </div>
                </SelectItem>
                <SelectItem value="Call Scoring 50">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-600">Call Scoring 50</Badge>
                    <span className="text-sm text-muted-foreground">50 calls/month</span>
                  </div>
                </SelectItem>
                <SelectItem value="Call Scoring 100">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-700">Call Scoring 100</Badge>
                    <span className="text-sm text-muted-foreground">100 calls/month</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mrr">Coaching MRR (Optional)</Label>
            <Input
              id="mrr"
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="0.00"
              value={formData.mrr}
              onChange={(e) => setFormData(prev => ({ ...prev, mrr: e.target.value }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="flat" disabled={loading}>
              {loading ? 'Creating...' : 'Create Client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}