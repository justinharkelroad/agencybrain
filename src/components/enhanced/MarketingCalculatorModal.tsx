import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Copy, Download, Upload, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUniversalDataProtection } from '@/hooks/useUniversalDataProtection';
import { UniversalDataProtectionPanel } from '@/components/UniversalDataProtectionPanel';
import {
  type MarketingInputs,
  type MarketingDerived,
  type MailerInputs,
  type MailerDerived,
  type TransferInputs,
  type TransferDerived,
  computeMetrics,
  computeMailerMetrics,
  computeTransferMetrics,
  formatCurrency,
  formatInteger,
  buildSummary,
  DEFAULT_INPUTS,
  DEFAULT_MAILER_INPUTS,
  DEFAULT_TRANSFER_INPUTS,
} from '@/utils/marketingCalculator';

interface MarketingCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Combined data type for data protection
interface CombinedMarketingData {
  marketing: {
    inputs: MarketingInputs;
    derived: MarketingDerived;
  };
  mailer: {
    inputs: MailerInputs;
    derived: MailerDerived;
  };
  transfer: {
    inputs: TransferInputs;
    derived: TransferDerived;
  };
  activeTab: string;
}

export function MarketingCalculatorModal({ isOpen, onClose }: MarketingCalculatorModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('marketing');
  const [showDataProtection, setShowDataProtection] = useState(false);
  
  // Marketing Calculator State
  const [marketingInputs, setMarketingInputs] = useState<MarketingInputs>(DEFAULT_INPUTS);
  const [marketingDerived, setMarketingDerived] = useState<MarketingDerived>(() => 
    computeMetrics(DEFAULT_INPUTS)
  );

  // Mailer Calculator State
  const [mailerInputs, setMailerInputs] = useState<MailerInputs>(DEFAULT_MAILER_INPUTS);
  const [mailerDerived, setMailerDerived] = useState<MailerDerived>(() => 
    computeMailerMetrics(DEFAULT_MAILER_INPUTS)
  );

  // Transfer Calculator State
  const [transferInputs, setTransferInputs] = useState<TransferInputs>(DEFAULT_TRANSFER_INPUTS);
  const [transferDerived, setTransferDerived] = useState<TransferDerived>(() => 
    computeTransferMetrics(DEFAULT_TRANSFER_INPUTS)
  );

  // Combined data for protection
  const combinedData: CombinedMarketingData = {
    marketing: { inputs: marketingInputs, derived: marketingDerived },
    mailer: { inputs: mailerInputs, derived: mailerDerived },
    transfer: { inputs: transferInputs, derived: transferDerived },
    activeTab
  };

  // Initialize data protection
  const dataProtection = useUniversalDataProtection({
    formData: combinedData,
    formType: 'marketing-calculator',
    autoBackupEnabled: false, // Manual only for calculators
    onDataRestored: (restoredData: CombinedMarketingData) => {
      setMarketingInputs(restoredData.marketing.inputs);
      setMarketingDerived(restoredData.marketing.derived);
      setMailerInputs(restoredData.mailer.inputs);
      setMailerDerived(restoredData.mailer.derived);
      setTransferInputs(restoredData.transfer.inputs);
      setTransferDerived(restoredData.transfer.derived);
      setActiveTab(restoredData.activeTab || 'marketing');
    }
  });

  // Update calculations when inputs change
  useEffect(() => {
    setMarketingDerived(computeMetrics(marketingInputs));
  }, [marketingInputs]);

  useEffect(() => {
    setMailerDerived(computeMailerMetrics(mailerInputs));
  }, [mailerInputs]);

  useEffect(() => {
    setTransferDerived(computeTransferMetrics(transferInputs));
  }, [transferInputs]);

  const updateMarketingInput = (field: keyof MarketingInputs, value: any) => {
    setMarketingInputs(prev => ({ ...prev, [field]: value }));
  };

  const updateMailerInput = (field: keyof MailerInputs, value: any) => {
    setMailerInputs(prev => ({ ...prev, [field]: value }));
  };

  const updateTransferInput = (field: keyof TransferInputs, value: any) => {
    setTransferInputs(prev => ({ ...prev, [field]: value }));
  };

  const copyResults = (type: 'marketing' | 'mailer' | 'transfer') => {
    let summary = '';
    switch (type) {
      case 'marketing':
        summary = buildSummary(marketingInputs, marketingDerived);
        break;
      case 'mailer':
        summary = `Mailer Forecaster Results${mailerInputs.mailSource ? ` for ${mailerInputs.mailSource}` : ''}\n` +
          `Spend: $${mailerInputs.spend}\n` +
          `Cost per Piece: $${mailerInputs.costPerPiece}\n` +
          `Response Rate: ${mailerInputs.responseRatePct}%\n` +
          `Quoted % of Inbound: ${mailerInputs.quotedPctOfInboundPct}%\n` +
          `Close Rate: ${mailerInputs.closeRatePct}%\n` +
          `Avg Items/HH: ${mailerInputs.avgItemsPerHH}\n` +
          `Avg Item Value: $${mailerInputs.avgItemValue}\n` +
          `Commission: ${mailerInputs.commissionPct}%\n` +
          `Total Mailers Sent: ${formatInteger(mailerDerived.totalMailersSent)}\n` +
          `Inbound Calls: ${formatInteger(mailerDerived.inboundCalls)}\n` +
          `Quoted HH: ${formatInteger(mailerDerived.quotedHH)}\n` +
          `Cost per Quoted HH: ${mailerDerived.costPerQuotedHH == null ? "—" : formatCurrency(mailerDerived.costPerQuotedHH)}\n` +
          `Closed HH: ${formatInteger(mailerDerived.closedHH)}\n` +
          `Sold Items: ${formatInteger(mailerDerived.soldItems)}\n` +
          `Sold Premium: ${formatCurrency(mailerDerived.soldPremium)}\n` +
          `Total Compensation: ${formatCurrency(mailerDerived.totalComp)}`;
        break;
      case 'transfer':
        summary = `Live Transfer Forecaster Results${transferInputs.liveTransferSource ? ` for ${transferInputs.liveTransferSource}` : ''}\n` +
          `Spend: $${transferInputs.spend}\n` +
          `Cost per Transfer: $${transferInputs.costPerTransfer}\n` +
          `Quoted % of Inbound: ${transferInputs.quotedPctOfInboundPct}%\n` +
          `Close Rate: ${transferInputs.closeRatePct}%\n` +
          `Avg Items/HH: ${transferInputs.avgItemsPerHH}\n` +
          `Avg Item Value: $${transferInputs.avgItemValue}\n` +
          `Commission: ${transferInputs.commissionPct}%\n` +
          `Total Transfers: ${formatInteger(transferDerived.totalTransfers)}\n` +
          `Quoted HH: ${formatInteger(transferDerived.quotedHH)}\n` +
          `Cost per Quoted HH: ${transferDerived.costPerQuotedHH == null ? "—" : formatCurrency(transferDerived.costPerQuotedHH)}\n` +
          `Closed HH: ${formatInteger(transferDerived.closedHH)}\n` +
          `Sold Items: ${formatInteger(transferDerived.soldItems)}\n` +
          `Sold Premium: ${formatCurrency(transferDerived.soldPremium)}\n` +
          `Total Compensation: ${formatCurrency(transferDerived.totalComp)}`;
        break;
    }

    navigator.clipboard.writeText(summary).then(() => {
      toast({
        title: "Results Copied",
        description: "The calculation results have been copied to your clipboard.",
      });
    });
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Marketing Calculators</DialogTitle>
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
        </DialogHeader>

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
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="marketing">ROI Forecaster</TabsTrigger>
            <TabsTrigger value="mailer">Mailer Forecaster</TabsTrigger>
            <TabsTrigger value="transfer">Live Transfer</TabsTrigger>
          </TabsList>

          <TabsContent value="marketing" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Inputs */}
              <Card>
                <CardHeader>
                  <CardTitle>Inputs</CardTitle>
                  <CardDescription>Enter your marketing parameters</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="leadSource">Lead Source</Label>
                    <Input
                      id="leadSource"
                      value={marketingInputs.leadSource || ''}
                      onChange={(e) => updateMarketingInput('leadSource', e.target.value)}
                      placeholder="e.g., EverQuote"
                    />
                  </div>
                  <div>
                    <Label htmlFor="spend">Spend ($)</Label>
                    <Input
                      id="spend"
                      type="number"
                      value={marketingInputs.spend}
                      onChange={(e) => updateMarketingInput('spend', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cpl">Cost Per Lead ($)</Label>
                    <Input
                      id="cpl"
                      type="number"
                      step="0.01"
                      value={marketingInputs.cpl}
                      onChange={(e) => updateMarketingInput('cpl', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="quoteRate">Quote Rate (%)</Label>
                    <Input
                      id="quoteRate"
                      type="number"
                      step="0.01"
                      value={marketingInputs.quoteRatePct}
                      onChange={(e) => updateMarketingInput('quoteRatePct', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="closeRate">Close Rate (%)</Label>
                    <Input
                      id="closeRate"
                      type="number"
                      step="0.01"
                      value={marketingInputs.closeRatePct}
                      onChange={(e) => updateMarketingInput('closeRatePct', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="avgItemValue">Avg Item Value ($)</Label>
                    <Input
                      id="avgItemValue"
                      type="number"
                      step="0.01"
                      value={marketingInputs.avgItemValue}
                      onChange={(e) => updateMarketingInput('avgItemValue', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="avgItemsPerHH">Avg Items per HH</Label>
                    <Input
                      id="avgItemsPerHH"
                      type="number"
                      step="0.1"
                      value={marketingInputs.avgItemsPerHH}
                      onChange={(e) => updateMarketingInput('avgItemsPerHH', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="commission">Commission (%)</Label>
                    <Input
                      id="commission"
                      type="number"
                      step="0.01"
                      value={marketingInputs.commissionPct}
                      onChange={(e) => updateMarketingInput('commissionPct', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Results */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Results</CardTitle>
                      <CardDescription>Calculated metrics</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyResults('marketing')}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Leads:</span>
                    <Badge variant="secondary">{formatInteger(marketingDerived.totalLeads)}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Quoted HH:</span>
                    <Badge variant="secondary">{formatInteger(marketingDerived.quotedHH)}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Cost per Quoted HH:</span>
                    <Badge variant="secondary">
                      {marketingDerived.costPerQuotedHH ? formatCurrency(marketingDerived.costPerQuotedHH) : '—'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Closed HH:</span>
                    <Badge variant="secondary">{formatInteger(marketingDerived.closedHH)}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Sold Items:</span>
                    <Badge variant="secondary">{formatInteger(marketingDerived.soldItems)}</Badge>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Sold Premium:</span>
                    <Badge className="font-semibold">{formatCurrency(marketingDerived.soldPremium)}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Total Compensation:</span>
                    <Badge className="font-semibold">{formatCurrency(marketingDerived.totalComp)}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="mailer" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Mailer Inputs */}
              <Card>
                <CardHeader>
                  <CardTitle>Mailer Inputs</CardTitle>
                  <CardDescription>Enter your direct mail parameters</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="mailSource">Mail Source</Label>
                    <Input
                      id="mailSource"
                      value={mailerInputs.mailSource || ''}
                      onChange={(e) => updateMailerInput('mailSource', e.target.value)}
                      placeholder="e.g., Postcard Campaign"
                    />
                  </div>
                  <div>
                    <Label htmlFor="mailerSpend">Spend ($)</Label>
                    <Input
                      id="mailerSpend"
                      type="number"
                      value={mailerInputs.spend}
                      onChange={(e) => updateMailerInput('spend', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="costPerPiece">Cost Per Piece ($)</Label>
                    <Input
                      id="costPerPiece"
                      type="number"
                      step="0.01"
                      value={mailerInputs.costPerPiece}
                      onChange={(e) => updateMailerInput('costPerPiece', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="responseRate">Response Rate (%)</Label>
                    <Input
                      id="responseRate"
                      type="number"
                      step="0.01"
                      value={mailerInputs.responseRatePct}
                      onChange={(e) => updateMailerInput('responseRatePct', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="quotedPct">Quoted % of Inbound (%)</Label>
                    <Input
                      id="quotedPct"
                      type="number"
                      step="0.01"
                      value={mailerInputs.quotedPctOfInboundPct}
                      onChange={(e) => updateMailerInput('quotedPctOfInboundPct', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="mailerCloseRate">Close Rate (%)</Label>
                    <Input
                      id="mailerCloseRate"
                      type="number"
                      step="0.01"
                      value={mailerInputs.closeRatePct}
                      onChange={(e) => updateMailerInput('closeRatePct', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="mailerAvgItems">Avg Items per HH</Label>
                    <Input
                      id="mailerAvgItems"
                      type="number"
                      step="0.1"
                      value={mailerInputs.avgItemsPerHH}
                      onChange={(e) => updateMailerInput('avgItemsPerHH', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="mailerAvgValue">Avg Item Value ($)</Label>
                    <Input
                      id="mailerAvgValue"
                      type="number"
                      step="0.01"
                      value={mailerInputs.avgItemValue}
                      onChange={(e) => updateMailerInput('avgItemValue', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="mailerCommission">Commission (%)</Label>
                    <Input
                      id="mailerCommission"
                      type="number"
                      step="0.01"
                      value={mailerInputs.commissionPct}
                      onChange={(e) => updateMailerInput('commissionPct', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Mailer Results */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Mailer Results</CardTitle>
                      <CardDescription>Calculated metrics</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyResults('mailer')}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Mailers Sent:</span>
                    <Badge variant="secondary">{formatInteger(mailerDerived.totalMailersSent)}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Inbound Calls:</span>
                    <Badge variant="secondary">{formatInteger(mailerDerived.inboundCalls)}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Quoted HH:</span>
                    <Badge variant="secondary">{formatInteger(mailerDerived.quotedHH)}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Cost per Quoted HH:</span>
                    <Badge variant="secondary">
                      {mailerDerived.costPerQuotedHH ? formatCurrency(mailerDerived.costPerQuotedHH) : '—'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Closed HH:</span>
                    <Badge variant="secondary">{formatInteger(mailerDerived.closedHH)}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Sold Items:</span>
                    <Badge variant="secondary">{formatInteger(mailerDerived.soldItems)}</Badge>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Sold Premium:</span>
                    <Badge className="font-semibold">{formatCurrency(mailerDerived.soldPremium)}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Total Compensation:</span>
                    <Badge className="font-semibold">{formatCurrency(mailerDerived.totalComp)}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="transfer" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Transfer Inputs */}
              <Card>
                <CardHeader>
                  <CardTitle>Live Transfer Inputs</CardTitle>
                  <CardDescription>Enter your live transfer parameters</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="transferSource">Live Transfer Source</Label>
                    <Input
                      id="transferSource"
                      value={transferInputs.liveTransferSource || ''}
                      onChange={(e) => updateTransferInput('liveTransferSource', e.target.value)}
                      placeholder="e.g., Call Vendor"
                    />
                  </div>
                  <div>
                    <Label htmlFor="transferSpend">Spend ($)</Label>
                    <Input
                      id="transferSpend"
                      type="number"
                      value={transferInputs.spend}
                      onChange={(e) => updateTransferInput('spend', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="costPerTransfer">Cost Per Transfer ($)</Label>
                    <Input
                      id="costPerTransfer"
                      type="number"
                      step="0.01"
                      value={transferInputs.costPerTransfer}
                      onChange={(e) => updateTransferInput('costPerTransfer', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="transferQuotedPct">Quoted % of Inbound (%)</Label>
                    <Input
                      id="transferQuotedPct"
                      type="number"
                      step="0.01"
                      value={transferInputs.quotedPctOfInboundPct}
                      onChange={(e) => updateTransferInput('quotedPctOfInboundPct', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="transferCloseRate">Close Rate (%)</Label>
                    <Input
                      id="transferCloseRate"
                      type="number"
                      step="0.01"
                      value={transferInputs.closeRatePct}
                      onChange={(e) => updateTransferInput('closeRatePct', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="transferAvgItems">Avg Items per HH</Label>
                    <Input
                      id="transferAvgItems"
                      type="number"
                      step="0.1"
                      value={transferInputs.avgItemsPerHH}
                      onChange={(e) => updateTransferInput('avgItemsPerHH', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="transferAvgValue">Avg Item Value ($)</Label>
                    <Input
                      id="transferAvgValue"
                      type="number"
                      step="0.01"
                      value={transferInputs.avgItemValue}
                      onChange={(e) => updateTransferInput('avgItemValue', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="transferCommission">Commission (%)</Label>
                    <Input
                      id="transferCommission"
                      type="number"
                      step="0.01"
                      value={transferInputs.commissionPct}
                      onChange={(e) => updateTransferInput('commissionPct', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Transfer Results */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Transfer Results</CardTitle>
                      <CardDescription>Calculated metrics</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyResults('transfer')}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Transfers:</span>
                    <Badge variant="secondary">{formatInteger(transferDerived.totalTransfers)}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Quoted HH:</span>
                    <Badge variant="secondary">{formatInteger(transferDerived.quotedHH)}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Cost per Quoted HH:</span>
                    <Badge variant="secondary">
                      {transferDerived.costPerQuotedHH ? formatCurrency(transferDerived.costPerQuotedHH) : '—'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Closed HH:</span>
                    <Badge variant="secondary">{formatInteger(transferDerived.closedHH)}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Sold Items:</span>
                    <Badge variant="secondary">{formatInteger(transferDerived.soldItems)}</Badge>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Sold Premium:</span>
                    <Badge className="font-semibold">{formatCurrency(transferDerived.soldPremium)}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Total Compensation:</span>
                    <Badge className="font-semibold">{formatCurrency(transferDerived.totalComp)}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}