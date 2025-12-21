import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFlowProfile } from '@/hooks/useFlowProfile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const ACCOUNTABILITY_STYLES = [
  { value: 'direct_challenge', label: 'Direct challenge - Tell me the hard truth' },
  { value: 'gentle_nudge', label: 'Gentle nudge - Lead with encouragement' },
  { value: 'questions_discover', label: 'Questions to discover - Help me figure it out myself' },
];

const FEEDBACK_PREFERENCES = [
  { value: 'blunt_truth', label: 'Blunt truth first - Don\'t sugarcoat it' },
  { value: 'encouragement_then_truth', label: 'Encouragement then truth - Acknowledge before challenging' },
  { value: 'questions_to_discover', label: 'Questions that let me discover it - Socratic approach' },
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
    // New fields
    accountability_style: '',
    feedback_preference: '',
    peak_state: '',
    growth_edge: '',
    overwhelm_response: '',
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
        // New fields
        accountability_style: profile.accountability_style || '',
        feedback_preference: profile.feedback_preference || '',
        peak_state: profile.peak_state || '',
        growth_edge: profile.growth_edge || '',
        overwhelm_response: profile.overwhelm_response || '',
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
      <div className="container max-w-2xl py-8">
        <div className="space-y-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-64 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/flows')}
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Flows
        </Button>
        
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-primary" />
          {hasProfile ? 'Edit Your Profile' : 'Build Your Flow Profile'}
        </h1>
        <p className="text-muted-foreground mt-2">
          Help us personalize your experience with AI-powered insights.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* About You */}
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
              <p className="text-sm text-muted-foreground/70 mb-2">Select all that apply</p>
              <div className="flex flex-wrap gap-2">
                {LIFE_ROLES.map(role => (
                  <Button
                    key={role}
                    type="button"
                    variant={formData.life_roles.includes(role) ? 'default' : 'outline'}
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
              <p className="text-sm text-muted-foreground/70 mb-2">Select your top values</p>
              <div className="flex flex-wrap gap-2">
                {CORE_VALUES.map(value => (
                  <Button
                    key={value}
                    type="button"
                    variant={formData.core_values.includes(value) ? 'default' : 'outline'}
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

        {/* Current Focus - Enhanced questions */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Current Focus</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Goals - Reworded for specificity */}
            <div>
              <Label htmlFor="current_goals">What's ONE thing that, if you accomplished it in the next 90 days, would change everything?</Label>
              <p className="text-sm text-muted-foreground/70 mb-2">Be specific - vague goals get vague results</p>
              <Textarea
                id="current_goals"
                value={formData.current_goals}
                onChange={e => setFormData(prev => ({ ...prev, current_goals: e.target.value }))}
                placeholder="Example: Close 3 new commercial accounts worth $50k+ each so I can hire my first producer..."
                className="mt-2 min-h-[100px]"
              />
            </div>

            {/* Challenges - Reworded to get at patterns */}
            <div>
              <Label htmlFor="current_challenges">What pattern keeps showing up that you haven't been able to break?</Label>
              <p className="text-sm text-muted-foreground/70 mb-2">Think recurring, not one-time obstacles</p>
              <Textarea
                id="current_challenges"
                value={formData.current_challenges}
                onChange={e => setFormData(prev => ({ ...prev, current_challenges: e.target.value }))}
                placeholder="Example: I keep saying yes to things that aren't priorities, then resent the time they take..."
                className="mt-2 min-h-[100px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Self-Awareness Section - NEW */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Self-Awareness</CardTitle>
            <CardDescription>Helps the AI understand how you operate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Peak State */}
            <div>
              <Label htmlFor="peak_state">When you're at your best, what does that look like?</Label>
              <p className="text-sm text-muted-foreground/70 mb-2">What conditions, routines, or mindsets create your peak performance?</p>
              <Textarea
                id="peak_state"
                value={formData.peak_state}
                onChange={e => setFormData(prev => ({ ...prev, peak_state: e.target.value }))}
                placeholder="Example: When I've had my morning routine, blocked deep work time, and have clarity on my top 3 priorities..."
                className="mt-2 min-h-[80px]"
              />
            </div>

            {/* Growth Edge */}
            <div>
              <Label htmlFor="growth_edge">What growth area have you been avoiding or resistant to?</Label>
              <p className="text-sm text-muted-foreground/70 mb-2">The thing you know you should work on but keep putting off</p>
              <Textarea
                id="growth_edge"
                value={formData.growth_edge}
                onChange={e => setFormData(prev => ({ ...prev, growth_edge: e.target.value }))}
                placeholder="Example: Delegating more and letting go of control, even when I think I can do it better..."
                className="mt-2 min-h-[80px]"
              />
            </div>

            {/* Overwhelm Response */}
            <div>
              <Label htmlFor="overwhelm_response">How do you typically respond when you feel overwhelmed or stuck?</Label>
              <p className="text-sm text-muted-foreground/70 mb-2">Your default coping pattern - no judgment</p>
              <Textarea
                id="overwhelm_response"
                value={formData.overwhelm_response}
                onChange={e => setFormData(prev => ({ ...prev, overwhelm_response: e.target.value }))}
                placeholder="Example: I work harder and longer hours, which leads to burnout. Or I procrastinate and distract myself..."
                className="mt-2 min-h-[80px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Coaching Preferences - NEW */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Coaching Preferences</CardTitle>
            <CardDescription>How should the AI coach you?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Accountability Style */}
            <div>
              <Label htmlFor="accountability_style">What style of accountability works best for you?</Label>
              <Select
                value={formData.accountability_style}
                onValueChange={(value) => setFormData(prev => ({ ...prev, accountability_style: value }))}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select your preferred style..." />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNTABILITY_STYLES.map(style => (
                    <SelectItem key={style.value} value={style.value}>
                      {style.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Feedback Preference */}
            <div>
              <Label htmlFor="feedback_preference">When receiving feedback, you prefer...</Label>
              <Select
                value={formData.feedback_preference}
                onValueChange={(value) => setFormData(prev => ({ ...prev, feedback_preference: value }))}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select your preference..." />
                </SelectTrigger>
                <SelectContent>
                  {FEEDBACK_PREFERENCES.map(pref => (
                    <SelectItem key={pref.value} value={pref.value}>
                      {pref.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Additional Context */}
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
