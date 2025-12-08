import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFlowProfile } from '@/hooks/useFlowProfile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const LIFE_ROLES = [
  'Spouse',
  'Parent',
  'Business Owner',
  'Employee',
  'Coach',
  'Student',
  'Caregiver',
  'Leader',
  'Creative',
  'Athlete',
];

const CORE_VALUES = [
  'Faith',
  'Family',
  'Growth',
  'Impact',
  'Freedom',
  'Health',
  'Wealth',
  'Adventure',
  'Connection',
  'Excellence',
  'Integrity',
  'Service',
];

export default function FlowProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { profile, loading, saveProfile, hasProfile } = useFlowProfile();
  
  const redirectTo = (location.state as { redirectTo?: string })?.redirectTo;

  const [formData, setFormData] = useState({
    preferred_name: '',
    life_roles: [] as string[],
    core_values: [] as string[],
    current_goals: '',
    current_challenges: '',
    spiritual_beliefs: '',
    background_notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        preferred_name: profile.preferred_name || '',
        life_roles: profile.life_roles || [],
        core_values: profile.core_values || [],
        current_goals: profile.current_goals || '',
        current_challenges: profile.current_challenges || '',
        spiritual_beliefs: profile.spiritual_beliefs || '',
        background_notes: profile.background_notes || '',
      });
    }
  }, [profile]);

  const toggleArrayItem = (field: 'life_roles' | 'core_values', item: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter(i => i !== item)
        : [...prev[field], item],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.preferred_name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter what we should call you.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const { error } = await saveProfile(formData);
    setSaving(false);

    if (error) {
      toast({
        title: 'Error saving profile',
        description: error,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Profile saved',
        description: 'Your Flow profile has been updated.',
      });
      
      if (redirectTo) {
        navigate(redirectTo);
      } else {
        navigate('/flows');
      }
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/flows')}
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" strokeWidth={1.5} />
          Back to Flows
        </Button>
        
        <h1 className="text-2xl font-medium flex items-center gap-2">
          <Sparkles className="h-6 w-6" strokeWidth={1.5} />
          {hasProfile ? 'Edit Your Profile' : 'Build Your Flow Profile'}
        </h1>
        <p className="text-muted-foreground/70 mt-1">
          Help us personalize your experience with AI-powered insights.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">About You</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Preferred Name */}
            <div>
              <Label htmlFor="preferred_name">What should we call you? *</Label>
              <Input
                id="preferred_name"
                value={formData.preferred_name}
                onChange={e => setFormData(prev => ({ ...prev, preferred_name: e.target.value }))}
                placeholder="Your first name or nickname"
                className="mt-2"
              />
            </div>

            {/* Life Roles */}
            <div>
              <Label>What roles do you play in life?</Label>
              <p className="text-sm text-muted-foreground/70 mb-3">Select all that apply</p>
              <div className="flex flex-wrap gap-2">
                {LIFE_ROLES.map(role => (
                  <Button
                    key={role}
                    type="button"
                    variant={formData.life_roles.includes(role) ? 'default' : 'flat'}
                    size="sm"
                    onClick={() => toggleArrayItem('life_roles', role)}
                  >
                    {role}
                  </Button>
                ))}
              </div>
            </div>

            {/* Core Values */}
            <div>
              <Label>What are your core values?</Label>
              <p className="text-sm text-muted-foreground/70 mb-3">Select your top values</p>
              <div className="flex flex-wrap gap-2">
                {CORE_VALUES.map(value => (
                  <Button
                    key={value}
                    type="button"
                    variant={formData.core_values.includes(value) ? 'default' : 'flat'}
                    size="sm"
                    onClick={() => toggleArrayItem('core_values', value)}
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Current Focus</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Goals */}
            <div>
              <Label htmlFor="current_goals">What are you currently working toward?</Label>
              <Textarea
                id="current_goals"
                value={formData.current_goals}
                onChange={e => setFormData(prev => ({ ...prev, current_goals: e.target.value }))}
                placeholder="Your current goals, projects, or aspirations..."
                className="mt-2 min-h-[100px]"
              />
            </div>

            {/* Challenges */}
            <div>
              <Label htmlFor="current_challenges">What challenges are you facing?</Label>
              <Textarea
                id="current_challenges"
                value={formData.current_challenges}
                onChange={e => setFormData(prev => ({ ...prev, current_challenges: e.target.value }))}
                placeholder="Current obstacles or areas where you're seeking growth..."
                className="mt-2 min-h-[100px]"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Additional Context</CardTitle>
            <CardDescription>Optional - helps personalize spiritual/faith-based flows</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Spiritual Beliefs */}
            <div>
              <Label htmlFor="spiritual_beliefs">Spiritual beliefs or faith tradition</Label>
              <Textarea
                id="spiritual_beliefs"
                value={formData.spiritual_beliefs}
                onChange={e => setFormData(prev => ({ ...prev, spiritual_beliefs: e.target.value }))}
                placeholder="Your faith background or spiritual practices (optional)..."
                className="mt-2"
              />
            </div>

            {/* Background Notes */}
            <div>
              <Label htmlFor="background_notes">Anything else we should know?</Label>
              <Textarea
                id="background_notes"
                value={formData.background_notes}
                onChange={e => setFormData(prev => ({ ...prev, background_notes: e.target.value }))}
                placeholder="Any other context that would help us personalize your experience..."
                className="mt-2"
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/flows')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              'Saving...'
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" strokeWidth={1.5} />
                Save Profile
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
