import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Shield, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUniversalDataProtection } from '@/hooks/useUniversalDataProtection';
import { UniversalDataProtectionPanel } from '@/components/UniversalDataProtectionPanel';
import {
  type VendorVerifierFormInputs,
  type VendorVerifierDerived,
  computeVendorVerifierDerived,
  buildVendorVerifierJson,
} from '@/utils/vendorVerifier';
import SaveVendorReportButton from '@/components/SaveVendorReportButton';

// Combined data type for data protection
interface VendorVerifierData {
  inputs: VendorVerifierFormInputs;
  derived: VendorVerifierDerived;
}

interface VendorVerifierFormProps {
  className?: string;
}

export function VendorVerifierForm({ className }: VendorVerifierFormProps) {
  const { toast } = useToast();
  const [showDataProtection, setShowDataProtection] = useState(false);
  const [inputs, setInputs] = useState<VendorVerifierFormInputs>({});
  const [derived, setDerived] = useState<VendorVerifierDerived>(() => 
    computeVendorVerifierDerived({})
  );

  // Combined data for protection
  const combinedData: VendorVerifierData = {
    inputs,
    derived
  };

  // Initialize data protection
  const dataProtection = useUniversalDataProtection({
    formData: combinedData,
    formType: 'vendor-verifier',
    autoBackupEnabled: false, // Manual only for calculators
    onDataRestored: (restoredData: VendorVerifierData) => {
      setInputs(restoredData.inputs);
      setDerived(restoredData.derived);
    }
  });

  // Update calculations when inputs change
  useEffect(() => {
    setDerived(computeVendorVerifierDerived(inputs));
  }, [inputs]);

  const updateInput = (field: keyof VendorVerifierFormInputs, value: any) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  const copyResults = () => {
    const jsonData = buildVendorVerifierJson(inputs, derived);
    const jsonString = JSON.stringify(jsonData, null, 2);
    
    navigator.clipboard.writeText(jsonString).then(() => {
      toast({
        title: "Results Copied",
        description: "The vendor verification results have been copied to your clipboard as JSON.",
      });
    });
  };

  const formatCurrency = (value: number | null): string => {
    if (value === null || !isFinite(value)) return "—";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number | null): string => {
    if (value === null || !isFinite(value)) return "—";
    return `${(value * 100).toFixed(2)}%`;
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Vendor Verifier</CardTitle>
              <CardDescription>Analyze vendor performance and costs</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowDataProtection(!showDataProtection)}
              >
                <Shield className="h-4 w-4 mr-2" />
                Data Protection
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {showDataProtection && (
            <div className="mb-4">
              <UniversalDataProtectionPanel
                status={dataProtection.status}
                backups={dataProtection.getBackups()}
                onCreateBackup={() => dataProtection.createBackup()}
                onExportData={() => dataProtection.exportData()}
                onImportData={() => dataProtection.importData()}
                onRestoreBackup={(timestamp) => dataProtection.restoreBackup(timestamp)}
                onToggleAutoBackup={() => dataProtection.toggleAutoBackup()}
                onValidateData={() => dataProtection.validateData()}
                validationResult={dataProtection.validateData()}
              />
              <Separator className="mt-4" />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Inputs */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Vendor Information</h3>
              
              <div>
                <Label htmlFor="vendorName">Vendor Name</Label>
                <Input
                  id="vendorName"
                  value={inputs.vendorName || ''}
                  onChange={(e) => updateInput('vendorName', e.target.value)}
                  placeholder="Enter vendor name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dateStart">Start Date</Label>
                  <Input
                    id="dateStart"
                    type="date"
                    value={inputs.dateStart || ''}
                    onChange={(e) => updateInput('dateStart', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="dateEnd">End Date</Label>
                  <Input
                    id="dateEnd"
                    type="date"
                    value={inputs.dateEnd || ''}
                    onChange={(e) => updateInput('dateEnd', e.target.value)}
                  />
                </div>
              </div>

              <Separator />
              <h4 className="font-medium">Spend & Volume</h4>

              <div>
                <Label htmlFor="amountSpent">Amount Spent ($)</Label>
                <Input
                  id="amountSpent"
                  type="number"
                  step="0.01"
                  value={inputs.amountSpent || ''}
                  onChange={(e) => updateInput('amountSpent', parseFloat(e.target.value) || undefined)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quotedHH">Quoted HH</Label>
                  <Input
                    id="quotedHH"
                    type="number"
                    value={inputs.quotedHH || ''}
                    onChange={(e) => updateInput('quotedHH', parseInt(e.target.value) || undefined)}
                  />
                </div>
                <div>
                  <Label htmlFor="closedHH">Closed HH</Label>
                  <Input
                    id="closedHH"
                    type="number"
                    value={inputs.closedHH || ''}
                    onChange={(e) => updateInput('closedHH', parseInt(e.target.value) || undefined)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="policiesQuoted">Policies Quoted</Label>
                  <Input
                    id="policiesQuoted"
                    type="number"
                    value={inputs.policiesQuoted || ''}
                    onChange={(e) => updateInput('policiesQuoted', parseInt(e.target.value) || undefined)}
                  />
                </div>
                <div>
                  <Label htmlFor="policiesSold">Policies Sold</Label>
                  <Input
                    id="policiesSold"
                    type="number"
                    value={inputs.policiesSold || ''}
                    onChange={(e) => updateInput('policiesSold', parseInt(e.target.value) || undefined)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="itemsQuoted">Items Quoted</Label>
                  <Input
                    id="itemsQuoted"
                    type="number"
                    value={inputs.itemsQuoted || ''}
                    onChange={(e) => updateInput('itemsQuoted', parseInt(e.target.value) || undefined)}
                  />
                </div>
                <div>
                  <Label htmlFor="itemsSold">Items Sold</Label>
                  <Input
                    id="itemsSold"
                    type="number"
                    value={inputs.itemsSold || ''}
                    onChange={(e) => updateInput('itemsSold', parseInt(e.target.value) || undefined)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="premiumSold">Premium Sold ($)</Label>
                <Input
                  id="premiumSold"
                  type="number"
                  step="0.01"
                  value={inputs.premiumSold || ''}
                  onChange={(e) => updateInput('premiumSold', parseFloat(e.target.value) || undefined)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="commissionPct">Commission (%)</Label>
                  <Input
                    id="commissionPct"
                    type="number"
                    step="0.01"
                    value={inputs.commissionPct || ''}
                    onChange={(e) => updateInput('commissionPct', parseFloat(e.target.value) || undefined)}
                  />
                </div>
                <div>
                  <Label htmlFor="inboundCalls">Inbound Calls</Label>
                  <Input
                    id="inboundCalls"
                    type="number"
                    value={inputs.inboundCalls || ''}
                    onChange={(e) => updateInput('inboundCalls', parseInt(e.target.value) || undefined)}
                  />
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Analysis Results</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyResults}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy JSON
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Cost per Quoted HH:</span>
                  <Badge variant="secondary">{formatCurrency(derived.costPerQuotedHH)}</Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Policy Close Rate:</span>
                  <Badge variant="secondary">{formatPercent(derived.policyCloseRate)}</Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Average Item Value:</span>
                  <Badge variant="secondary">{formatCurrency(derived.averageItemValue)}</Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Average Policy Value:</span>
                  <Badge variant="secondary">{formatCurrency(derived.averagePolicyValue)}</Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Avg Cost per Call:</span>
                  <Badge variant="secondary">{formatCurrency(derived.avgCostPerCall)}</Badge>
                </div>

                <Separator />
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Cost per Quoted Policy:</span>
                  <Badge variant="secondary">{formatCurrency(derived.costPerQuotedPolicy)}</Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Cost per Quoted Item:</span>
                  <Badge variant="secondary">{formatCurrency(derived.costPerQuotedItem)}</Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Cost per Sold Item:</span>
                  <Badge variant="secondary">{formatCurrency(derived.costPerSoldItem)}</Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Cost per Sold Policy:</span>
                  <Badge variant="secondary">{formatCurrency(derived.costPerSoldPolicy)}</Badge>
                </div>

                <Separator />
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">CPA (Cost per Acquisition):</span>
                  <Badge className="font-semibold">{formatCurrency(derived.cpa)}</Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Projected Commission:</span>
                  <Badge className="font-semibold">{formatCurrency(derived.projectedCommissionAmount)}</Badge>
                </div>
              </div>

              <div className="pt-4">
                <SaveVendorReportButton
                  input={inputs}
                  derived={derived}
                  data={buildVendorVerifierJson(inputs, derived)}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}