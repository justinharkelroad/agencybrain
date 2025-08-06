import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface FormData {
  sales: {
    premium: number;
    items: number;
    policies: number;
    achievedVC: boolean;
  };
  marketing: {
    totalSpend: number;
    policiesQuoted: number;
    leadSources: { name: string; spend: number }[];
  };
  operations: {
    currentAlrTotal: number;
    currentAapProjection: string;
    currentBonusTrend: number;
    teamRoster: { name: string; role: string }[];
  };
  retention: {
    numberTerminated: number;
    currentRetentionPercent: number;
  };
  cashFlow: {
    compensation: number;
    expenses: number;
    netProfit: number;
  };
  qualitative: {
    biggestStress: string;
    gutAction: string;
    biggestPersonalWin: string;
    biggestBusinessWin: string;
    attackItems: { item1: string; item2: string; item3: string };
  };
}

const initialFormData: FormData = {
  sales: { premium: 0, items: 0, policies: 0, achievedVC: false },
  marketing: { totalSpend: 0, policiesQuoted: 0, leadSources: [] },
  operations: { currentAlrTotal: 0, currentAapProjection: 'Emerging', currentBonusTrend: 0, teamRoster: [] },
  retention: { numberTerminated: 0, currentRetentionPercent: 0 },
  cashFlow: { compensation: 0, expenses: 0, netProfit: 0 },
  qualitative: { biggestStress: '', gutAction: '', biggestPersonalWin: '', biggestBusinessWin: '', attackItems: { item1: '', item2: '', item3: '' } },
};

export default function Submit() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPeriod, setCurrentPeriod] = useState<any>(null);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchCurrentPeriod();
    }
  }, [user]);

  const fetchCurrentPeriod = async () => {
    try {
      // Fetch active period for current user
      const { data, error } = await supabase
        .from('periods')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        console.error('Periods error:', error);
        toast({
          title: "Error",
          description: "Could not fetch active period. Please try refreshing the page.",
          variant: "destructive",
        });
        return;
      }

      if (data) {
        setCurrentPeriod(data);
        setStartDate(new Date(data.start_date));
        setEndDate(new Date(data.end_date));
        if (data.form_data) {
          // Ensure all required nested fields exist
          const safeFormData = {
            ...initialFormData,
            ...data.form_data,
            // Specifically ensure qualitative.attackItems exists
            qualitative: {
              ...initialFormData.qualitative,
              ...data.form_data.qualitative,
              attackItems: {
                ...initialFormData.qualitative.attackItems,
                ...(data.form_data.qualitative?.attackItems || {})
              }
            }
          };
          setFormData(safeFormData);
        }
      } else {
        // No active period found, create one with 30-day lookback
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        const { data: newPeriod, error: createError } = await supabase
          .from('periods')
          .insert({
            user_id: user?.id,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            status: 'active'
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating period:', createError);
          toast({
            title: "Error",
            description: "Could not create a new period. Please try refreshing the page.",
            variant: "destructive",
          });
          return;
        }

        if (newPeriod) {
          setCurrentPeriod(newPeriod);
          setStartDate(startDate);
          setEndDate(endDate);
          toast({
            title: "New Period Created",
            description: "Created a 30-day period for your coaching session.",
          });
        }
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error", 
        description: "An unexpected error occurred. Please try refreshing the page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (section: keyof FormData, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const updatePeriodDates = async () => {
    if (!currentPeriod || !startDate || !endDate) return;

    try {
      const { error } = await supabase
        .from('periods')
        .update({
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          updated_at: new Date().toISOString()
        })
        .eq('id', currentPeriod.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update period dates",
          variant: "destructive",
        });
      } else {
        setCurrentPeriod(prev => ({
          ...prev,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
        }));
        toast({
          title: "Success",
          description: "Period dates updated successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred while updating dates",
        variant: "destructive",
      });
    }
  };

  const addLeadSource = () => {
    setFormData(prev => ({
      ...prev,
      marketing: {
        ...prev.marketing,
        leadSources: [...prev.marketing.leadSources, { name: '', spend: 0 }]
      }
    }));
  };

  const removeLeadSource = (index: number) => {
    setFormData(prev => ({
      ...prev,
      marketing: {
        ...prev.marketing,
        leadSources: prev.marketing.leadSources.filter((_, i) => i !== index)
      }
    }));
  };

  const addTeamMember = () => {
    setFormData(prev => ({
      ...prev,
      operations: {
        ...prev.operations,
        teamRoster: [...prev.operations.teamRoster, { name: '', role: 'Sales' }]
      }
    }));
  };

  const removeTeamMember = (index: number) => {
    setFormData(prev => ({
      ...prev,
      operations: {
        ...prev.operations,
        teamRoster: prev.operations.teamRoster.filter((_, i) => i !== index)
      }
    }));
  };

  const calculateNetProfit = () => {
    const netProfit = (formData.sales.premium + formData.operations.currentAlrTotal) - formData.cashFlow.compensation - formData.cashFlow.expenses;
    updateFormData('cashFlow', 'netProfit', Math.round(netProfit * 100) / 100);
  };

  useEffect(() => {
    calculateNetProfit();
  }, [formData.sales.premium, formData.operations.currentAlrTotal, formData.cashFlow.compensation, formData.cashFlow.expenses]);

  const saveForm = async () => {
    if (!currentPeriod) {
      toast({
        title: "Error",
        description: "No active period found. Please create a new period first.",
        variant: "destructive",
      });
      return;
    }

    // Basic validation
    if (!formData.sales.premium && !formData.sales.policies) {
      toast({
        title: "Validation Error",
        description: "Please fill in at least premium or policies in the Sales section.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('periods')
        .update({ 
          form_data: formData,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentPeriod.id);

      if (error) {
        console.error('Save error:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to save form data",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Form data saved successfully",
        });
        // Update current period to reflect the change
        setCurrentPeriod(prev => ({ ...prev, form_data: formData, updated_at: new Date().toISOString() }));
        // Redirect to upload selection page
        navigate('/uploads/select');
      }
    } catch (error) {
      console.error('Unexpected error saving form:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while saving. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!currentPeriod) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="container mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>No Active Period</CardTitle>
              <CardDescription>
                You need to create a reporting period before you can submit data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/dashboard">
                <Button>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link to="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <h1 className="text-3xl font-bold mt-4">Meeting Form</h1>
            <p className="text-muted-foreground mb-4">Submit to update Dashboard</p>
            
            {/* Editable Period Dates */}
            <div className="flex gap-4 items-center">
              <div className="flex flex-col">
                <Label className="mb-2">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[200px] justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="flex flex-col">
                <Label className="mb-2">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[200px] justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <Button 
                onClick={updatePeriodDates} 
                disabled={!startDate || !endDate}
                className="mt-6"
              >
                Update Dates
              </Button>
            </div>
          </div>
          <Button onClick={saveForm} disabled={saving}>
            {saving ? 'Saving...' : 'Save Form'}
          </Button>
        </div>

        <Tabs defaultValue="sales" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="marketing">Marketing</TabsTrigger>
            <TabsTrigger value="operations">Bonus/Ops</TabsTrigger>
            <TabsTrigger value="retention">Retention</TabsTrigger>
            <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
            <TabsTrigger value="qualitative">Current Reality</TabsTrigger>
          </TabsList>

          <TabsContent value="sales">
            <Card>
              <CardHeader>
                <CardTitle>Sales Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="premium">Premium ($)</Label>
                    <Input
                      id="premium"
                      type="number"
                      step="0.01"
                      value={formData.sales.premium || ''}
                      onChange={(e) => updateFormData('sales', 'premium', parseFloat(e.target.value) || 0)}
                      placeholder=""
                    />
                  </div>
                  <div>
                    <Label htmlFor="items">Items</Label>
                    <Input
                      id="items"
                      type="number"
                      value={formData.sales.items || ''}
                      onChange={(e) => updateFormData('sales', 'items', parseInt(e.target.value) || 0)}
                      placeholder=""
                    />
                  </div>
                  <div>
                    <Label htmlFor="policies">Policies</Label>
                    <Input
                      id="policies"
                      type="number"
                      value={formData.sales.policies || ''}
                      onChange={(e) => updateFormData('sales', 'policies', parseInt(e.target.value) || 0)}
                      placeholder=""
                    />
                  </div>
                </div>
                <div className="mt-6">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="achievedVC"
                      checked={formData.sales.achievedVC || false}
                      onChange={(e) => updateFormData('sales', 'achievedVC', e.target.checked)}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="achievedVC">Did you achieve VC this past month?</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="marketing">
            <Card>
              <CardHeader>
                <CardTitle>Marketing Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="policiesQuoted"># of Policies Quoted</Label>
                  <Input
                    id="policiesQuoted"
                    type="number"
                    value={formData.marketing.policiesQuoted || ''}
                    onChange={(e) => updateFormData('marketing', 'policiesQuoted', parseInt(e.target.value) || 0)}
                    placeholder=""
                  />
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label>Lead Sources</Label>
                    <Button type="button" size="sm" onClick={addLeadSource}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Source
                    </Button>
                  </div>
                  {formData.marketing.leadSources.map((source, index) => (
                    <div key={index} className="flex gap-2 items-end mb-2">
                      <div className="flex-1">
                        <Input
                          placeholder="Source name"
                          value={source.name}
                          onChange={(e) => {
                            const newSources = [...formData.marketing.leadSources];
                            newSources[index].name = e.target.value;
                            updateFormData('marketing', 'leadSources', newSources);
                            // Update total spend when lead sources change
                            const totalSpend = newSources.reduce((sum, source) => sum + (source.spend || 0), 0);
                            updateFormData('marketing', 'totalSpend', totalSpend);
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder=""
                          value={source.spend || ''}
                          onChange={(e) => {
                            const newSources = [...formData.marketing.leadSources];
                            newSources[index].spend = parseFloat(e.target.value) || 0;
                            updateFormData('marketing', 'leadSources', newSources);
                            // Update total spend when lead sources change
                            const totalSpend = newSources.reduce((sum, source) => sum + (source.spend || 0), 0);
                            updateFormData('marketing', 'totalSpend', totalSpend);
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeLeadSource(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                
                <div>
                  <Label htmlFor="totalSpend">Total Spend ($)</Label>
                  <Input
                    id="totalSpend"
                    type="number"
                    step="0.01"
                    value={formData.marketing.totalSpend || ''}
                    className="bg-muted"
                    readOnly
                    placeholder=""
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="operations">
            <Card>
              <CardHeader>
                <CardTitle>Bonus/Ops Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="currentAlrTotal">Current ALR Total YTD ($)</Label>
                  <Input
                    id="currentAlrTotal"
                    type="number"
                    step="0.01"
                    value={formData.operations.currentAlrTotal || ''}
                    onChange={(e) => updateFormData('operations', 'currentAlrTotal', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
                
                <div>
                  <Label htmlFor="currentAapProjection">Current AAP Projection</Label>
                  <Select
                    value={formData.operations.currentAapProjection}
                    onValueChange={(value) => updateFormData('operations', 'currentAapProjection', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select AAP level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Emerging">Emerging</SelectItem>
                      <SelectItem value="Pro">Pro</SelectItem>
                      <SelectItem value="Elite">Elite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="currentBonusTrend">Current Bonus Trend #</Label>
                  <Input
                    id="currentBonusTrend"
                    type="number"
                    value={formData.operations.currentBonusTrend || ''}
                    onChange={(e) => updateFormData('operations', 'currentBonusTrend', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label>Team Roster</Label>
                    <Button type="button" size="sm" onClick={addTeamMember}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Member
                    </Button>
                  </div>
                  {formData.operations.teamRoster.map((member, index) => (
                    <div key={index} className="flex gap-2 items-end mb-2">
                      <div className="flex-1">
                        <Input
                          placeholder="Name"
                          value={member.name}
                          onChange={(e) => {
                            const newRoster = [...formData.operations.teamRoster];
                            newRoster[index].name = e.target.value;
                            updateFormData('operations', 'teamRoster', newRoster);
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <Select
                          value={member.role}
                          onValueChange={(value) => {
                            const newRoster = [...formData.operations.teamRoster];
                            newRoster[index].role = value;
                            updateFormData('operations', 'teamRoster', newRoster);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Sales">Sales</SelectItem>
                            <SelectItem value="Service">Service</SelectItem>
                            <SelectItem value="Hybrid">Hybrid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeTeamMember(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="retention">
            <Card>
              <CardHeader>
                <CardTitle>Retention Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="numberTerminated">Number of Policies Terminated</Label>
                  <Input
                    id="numberTerminated"
                    type="number"
                    value={formData.retention.numberTerminated || ''}
                    onChange={(e) => updateFormData('retention', 'numberTerminated', parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="currentRetentionPercent">Current Retention %</Label>
                  <Input
                    id="currentRetentionPercent"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.retention.currentRetentionPercent || ''}
                    onChange={(e) => updateFormData('retention', 'currentRetentionPercent', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cashflow">
            <Card>
              <CardHeader>
                <CardTitle>Cash Flow Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="compensation">Compensation ($)</Label>
                    <Input
                      id="compensation"
                      type="number"
                      step="0.01"
                      value={formData.cashFlow.compensation || ''}
                      onChange={(e) => updateFormData('cashFlow', 'compensation', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="expenses">Expenses ($)</Label>
                    <Input
                      id="expenses"
                      type="number"
                      step="0.01"
                      value={formData.cashFlow.expenses || ''}
                      onChange={(e) => updateFormData('cashFlow', 'expenses', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="netProfit">Net Profit ($)</Label>
                    <Input
                      id="netProfit"
                      type="number"
                      step="0.01"
                      value={formData.cashFlow.netProfit || ''}
                      onChange={(e) => updateFormData('cashFlow', 'netProfit', parseFloat(e.target.value) || 0)}
                      className="bg-muted"
                      placeholder="0"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="qualitative">
            <Card>
              <CardHeader>
                <CardTitle>Current Reality</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="biggestStress">Biggest Stress</Label>
                  <Textarea
                    id="biggestStress"
                    value={formData.qualitative.biggestStress}
                    onChange={(e) => updateFormData('qualitative', 'biggestStress', e.target.value)}
                    rows={3}
                    placeholder="Describe your biggest stress..."
                  />
                </div>
                <div>
                  <Label htmlFor="gutAction">Gut Action You Feel You Should Take On That Stress</Label>
                  <Textarea
                    id="gutAction"
                    value={formData.qualitative.gutAction}
                    onChange={(e) => updateFormData('qualitative', 'gutAction', e.target.value)}
                    rows={3}
                    placeholder="What action do you feel you should take..."
                  />
                </div>
                <div>
                  <Label htmlFor="biggestPersonalWin">Biggest Personal Win</Label>
                  <Textarea
                    id="biggestPersonalWin"
                    value={formData.qualitative.biggestPersonalWin}
                    onChange={(e) => updateFormData('qualitative', 'biggestPersonalWin', e.target.value)}
                    rows={3}
                    placeholder="Describe your biggest personal win..."
                  />
                </div>
                <div>
                  <Label htmlFor="biggestBusinessWin">Biggest Business Win</Label>
                  <Textarea
                    id="biggestBusinessWin"
                    value={formData.qualitative.biggestBusinessWin}
                    onChange={(e) => updateFormData('qualitative', 'biggestBusinessWin', e.target.value)}
                    rows={3}
                    placeholder="Describe your biggest business win..."
                  />
                </div>
                
                <div className="mt-6">
                  <Label className="text-lg font-semibold">Here are 3 things I want to attack on this months call:</Label>
                  <div className="space-y-3 mt-3">
                    <div>
                      <Label htmlFor="attackItem1">1.</Label>
                      <Textarea
                        id="attackItem1"
                        value={formData.qualitative.attackItems.item1}
                        onChange={(e) => {
                          const newAttackItems = { ...formData.qualitative.attackItems, item1: e.target.value };
                          updateFormData('qualitative', 'attackItems', newAttackItems);
                        }}
                        rows={2}
                        placeholder="First thing to attack..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="attackItem2">2.</Label>
                      <Textarea
                        id="attackItem2"
                        value={formData.qualitative.attackItems.item2}
                        onChange={(e) => {
                          const newAttackItems = { ...formData.qualitative.attackItems, item2: e.target.value };
                          updateFormData('qualitative', 'attackItems', newAttackItems);
                        }}
                        rows={2}
                        placeholder="Second thing to attack..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="attackItem3">3.</Label>
                      <Textarea
                        id="attackItem3"
                        value={formData.qualitative.attackItems.item3}
                        onChange={(e) => {
                          const newAttackItems = { ...formData.qualitative.attackItems, item3: e.target.value };
                          updateFormData('qualitative', 'attackItems', newAttackItems);
                        }}
                        rows={2}
                        placeholder="Third thing to attack..."
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}