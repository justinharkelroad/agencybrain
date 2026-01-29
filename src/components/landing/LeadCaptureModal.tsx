import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, Send } from 'lucide-react';
import { z } from 'zod';
import { formatPhoneNumber } from '@/lib/utils';

const leadSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(10, 'Please enter a valid phone number').max(20, 'Phone number is too long'),
  agencyName: z.string().min(2, 'Agency name must be at least 2 characters').max(100, 'Agency name is too long'),
  carrier: z.enum(['Allstate', 'State Farm', 'Farmers', 'Independent', 'Other'], {
    required_error: 'Please select a carrier',
  }),
});

interface LeadCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeadCaptureModal({ open, onOpenChange }: LeadCaptureModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    agencyName: '',
    carrier: '',
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate form
    const result = leadSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.functions.invoke('submit-landing-lead', {
        body: {
          full_name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          agency_name: formData.agencyName,
          carrier: formData.carrier,
        },
      });

      if (error) throw error;

      setIsSuccess(true);
      toast({
        title: 'Thank you!',
        description: "We've received your information and will be in touch soon.",
      });

      // Reset and close after delay
      setTimeout(() => {
        setIsSuccess(false);
        setFormData({ fullName: '', email: '', phone: '', agencyName: '', carrier: '' });
        onOpenChange(false);
      }, 2000);

    } catch (error) {
      console.error('Lead submission error:', error);
      toast({
        title: 'Something went wrong',
        description: 'Please try again or contact us directly.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background border-border">
        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mb-4 animate-in zoom-in" />
            <DialogTitle className="text-2xl mb-2">You're all set!</DialogTitle>
            <DialogDescription>
              Check your email for confirmation. We'll be in touch soon.
            </DialogDescription>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Learn More About AgencyBrain</DialogTitle>
              <DialogDescription>
                Enter your information and we'll reach out to show you how AgencyBrain can transform your agency.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  placeholder="John Smith"
                  value={formData.fullName}
                  onChange={(e) => handleChange('fullName', e.target.value)}
                  className={errors.fullName ? 'border-destructive' : ''}
                  disabled={isSubmitting}
                />
                {errors.fullName && (
                  <p className="text-sm text-destructive">{errors.fullName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@agency.com"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className={errors.email ? 'border-destructive' : ''}
                  disabled={isSubmitting}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', formatPhoneNumber(e.target.value))}
                  className={errors.phone ? 'border-destructive' : ''}
                  maxLength={14}
                  disabled={isSubmitting}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="agencyName">Agency Name *</Label>
                <Input
                  id="agencyName"
                  placeholder="Smith Insurance Agency"
                  value={formData.agencyName}
                  onChange={(e) => handleChange('agencyName', e.target.value)}
                  className={errors.agencyName ? 'border-destructive' : ''}
                  disabled={isSubmitting}
                />
                {errors.agencyName && (
                  <p className="text-sm text-destructive">{errors.agencyName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="carrier">Carrier *</Label>
                <Select
                  value={formData.carrier}
                  onValueChange={(value) => handleChange('carrier', value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className={errors.carrier ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select your carrier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Allstate">Allstate</SelectItem>
                    <SelectItem value="State Farm">State Farm</SelectItem>
                    <SelectItem value="Farmers">Farmers</SelectItem>
                    <SelectItem value="Independent">Independent</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {errors.carrier && (
                  <p className="text-sm text-destructive">{errors.carrier}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full mt-6"
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Get Started
                  </>
                )}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
