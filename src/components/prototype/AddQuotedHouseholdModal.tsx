import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  User,
  Phone,
  Mail,
  Car,
  Home,
  Shield,
  CalendarIcon,
  ChevronDown,
  ChevronRight,
  Workflow,
  UserPlus,
  Info,
  Clock,
} from "lucide-react";
import { format } from "date-fns";

interface AddQuotedHouseholdModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: QuotedHouseholdData) => void;
}

interface QuotedHouseholdData {
  customerName: string;
  phone: string;
  email: string;
  policyTypes: string[];
  notes: string;
  applySequence: boolean;
  sequenceId: string | null;
  assigneeId: string | null;
  startDate: Date;
}

// Mock data for sequences
const mockSequences = [
  {
    id: 'seq-1',
    name: 'New Auto Policy',
    description: 'Standard onboarding for new auto customers',
    steps: 5,
    duration: '14 days',
  },
  {
    id: 'seq-2',
    name: 'New Home Policy',
    description: 'Onboarding sequence for homeowners',
    steps: 6,
    duration: '21 days',
  },
  {
    id: 'seq-3',
    name: 'Home Bundle Upsell',
    description: 'Cross-sell home insurance to auto customers',
    steps: 4,
    duration: '10 days',
  },
  {
    id: 'seq-4',
    name: 'Life Insurance Follow-up',
    description: 'Follow-up sequence for life insurance leads',
    steps: 3,
    duration: '7 days',
  },
];

const mockTeamMembers = [
  { id: 'user-1', name: 'Sarah Johnson' },
  { id: 'user-2', name: 'Mike Chen' },
  { id: 'user-3', name: 'Emily Davis' },
  { id: 'user-4', name: 'Ted Smith' },
];

const policyTypeOptions = [
  { id: 'auto', label: 'Auto', icon: Car },
  { id: 'home', label: 'Home', icon: Home },
  { id: 'life', label: 'Life', icon: Shield },
];

export function AddQuotedHouseholdModal({
  open,
  onOpenChange,
  onSubmit,
}: AddQuotedHouseholdModalProps) {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [policyTypes, setPolicyTypes] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // Sequence assignment state
  const [applySequence, setApplySequence] = useState(false);
  const [selectedSequence, setSelectedSequence] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [sequenceSectionOpen, setSequenceSectionOpen] = useState(true);

  const selectedSequenceData = mockSequences.find(s => s.id === selectedSequence);

  const handleSubmit = () => {
    onSubmit({
      customerName,
      phone,
      email,
      policyTypes,
      notes,
      applySequence,
      sequenceId: applySequence ? selectedSequence : null,
      assigneeId: applySequence ? assigneeId : null,
      startDate,
    });

    // Reset form
    setCustomerName('');
    setPhone('');
    setEmail('');
    setPolicyTypes([]);
    setNotes('');
    setApplySequence(false);
    setSelectedSequence(null);
    setAssigneeId(null);
    setStartDate(new Date());
  };

  const togglePolicyType = (typeId: string) => {
    setPolicyTypes(current =>
      current.includes(typeId)
        ? current.filter(t => t !== typeId)
        : [...current, typeId]
    );
  };

  const isValid = customerName.trim() && phone.trim() && policyTypes.length > 0;
  const isSequenceValid = !applySequence || (selectedSequence && assigneeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Add Quoted Household
          </DialogTitle>
          <DialogDescription>
            Enter the customer's information and optionally assign an onboarding sequence.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Customer Information Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Customer Information</h3>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="customer-name">
                Customer Name <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="customer-name"
                  placeholder="John Smith"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Phone & Email Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">
                  Phone <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    placeholder="(555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Policy Types */}
            <div className="space-y-2">
              <Label>
                Policy Type(s) <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                {policyTypeOptions.map((type) => {
                  const Icon = type.icon;
                  const isSelected = policyTypes.includes(type.id);
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => togglePolicyType(type.id)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes about this quote..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>

          <Separator />

          {/* Onboarding Sequence Section */}
          <Collapsible open={sequenceSectionOpen} onOpenChange={setSequenceSectionOpen}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <CollapsibleTrigger className="flex items-center gap-2 hover:text-primary transition-colors">
                  {sequenceSectionOpen ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <Workflow className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-medium">Onboarding Sequence</h3>
                </CollapsibleTrigger>

                <div className="flex items-center gap-2">
                  <Label htmlFor="apply-sequence" className="text-sm text-muted-foreground">
                    Apply sequence
                  </Label>
                  <Switch
                    id="apply-sequence"
                    checked={applySequence}
                    onCheckedChange={setApplySequence}
                  />
                </div>
              </div>

              <CollapsibleContent className="space-y-4">
                {applySequence ? (
                  <>
                    {/* Sequence Selection */}
                    <div className="space-y-2">
                      <Label>Select Sequence</Label>
                      <Select value={selectedSequence || ''} onValueChange={setSelectedSequence}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a sequence..." />
                        </SelectTrigger>
                        <SelectContent>
                          {mockSequences.map((seq) => (
                            <SelectItem key={seq.id} value={seq.id}>
                              <div className="flex items-center gap-2">
                                <span>{seq.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {seq.steps} steps
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Selected Sequence Details */}
                    {selectedSequenceData && (
                      <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                        <div className="flex items-start gap-3">
                          <Info className="w-4 h-4 text-primary mt-0.5" />
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{selectedSequenceData.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {selectedSequenceData.description}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {selectedSequenceData.steps} steps
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                {selectedSequenceData.duration}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Assign To & Start Date Row */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Assign To</Label>
                        <Select value={assigneeId || ''} onValueChange={setAssigneeId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select team member..." />
                          </SelectTrigger>
                          <SelectContent>
                            {mockTeamMembers.map((member) => (
                              <SelectItem key={member.id} value={member.id}>
                                {member.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !startDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {startDate ? format(startDate, "MMM d, yyyy") : "Select date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={startDate}
                              onSelect={(date) => date && setStartDate(date)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* Summary of what will happen */}
                    {selectedSequence && assigneeId && (
                      <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                        <p className="text-sm text-green-600 dark:text-green-400">
                          <strong>{selectedSequenceData?.steps} tasks</strong> will be created and assigned to{' '}
                          <strong>{mockTeamMembers.find(m => m.id === assigneeId)?.name}</strong>,
                          starting {format(startDate, "MMMM d, yyyy")}.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-4 rounded-lg bg-muted/30 border border-dashed border-border text-center">
                    <p className="text-sm text-muted-foreground">
                      Enable the toggle above to assign an onboarding sequence to this customer.
                    </p>
                  </div>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || !isSequenceValid}
          >
            {applySequence ? 'Add & Start Sequence' : 'Add Quoted Household'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
