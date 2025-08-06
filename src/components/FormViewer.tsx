import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileText, DollarSign, TrendingUp, Users, Target, MessageSquare } from 'lucide-react';

interface FormViewerProps {
  period: any;
  triggerButton?: React.ReactNode;
}

export const FormViewer: React.FC<FormViewerProps> = ({ period, triggerButton }) => {
  if (!period?.form_data) {
    return null;
  }

  const formData = period.form_data;
  
  const formatCurrency = (value: any) => {
    const num = parseFloat(value) || 0;
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  const formatNumber = (value: any) => {
    const num = parseFloat(value) || 0;
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <FileText className="w-4 h-4 mr-2" />
      View Details
    </Button>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        {triggerButton || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Form Details: {formatDate(period.start_date)} - {formatDate(period.end_date)}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="space-y-6 p-1">
            
            {/* Sales Section */}
            {formData.sales && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    Sales Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Total Premium</label>
                      <p className="text-lg font-semibold">{formatCurrency(formData.sales.premium)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Number of Policies</label>
                      <p className="text-lg font-semibold">{formatNumber(formData.sales.policies)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Cross-sells</label>
                      <p className="text-lg font-semibold">{formatNumber(formData.sales.crossSells)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Average Premium per Policy</label>
                      <p className="text-lg font-semibold">
                        {formData.sales.policies > 0 
                          ? formatCurrency(formData.sales.premium / formData.sales.policies)
                          : formatCurrency(0)
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Marketing Section */}
            {formData.marketing && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-blue-600" />
                    Marketing Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {formData.marketing.leadSources && formData.marketing.leadSources.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 block">Lead Sources</label>
                      <div className="space-y-2">
                        {formData.marketing.leadSources.map((source: any, index: number) => (
                          <div key={index} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                            <div>
                              <p className="font-medium">{source.source}</p>
                              <p className="text-sm text-muted-foreground">{formatNumber(source.leads)} leads</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{formatCurrency(source.spend)}</p>
                              <p className="text-sm text-muted-foreground">
                                {source.leads > 0 
                                  ? `${formatCurrency(source.spend / source.leads)} per lead`
                                  : 'N/A'
                                }
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex justify-between text-lg font-semibold">
                          <span>Total Marketing Spend:</span>
                          <span>{formatCurrency(formData.marketing.leadSources.reduce((sum: number, source: any) => sum + (parseFloat(source.spend) || 0), 0))}</span>
                        </div>
                        <div className="flex justify-between text-lg font-semibold">
                          <span>Total Leads:</span>
                          <span>{formatNumber(formData.marketing.leadSources.reduce((sum: number, source: any) => sum + (parseInt(source.leads) || 0), 0))}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {formData.marketing.goals && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Marketing Goals</label>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{formData.marketing.goals}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Operations Section */}
            {formData.operations && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-600" />
                    Operations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {formData.operations.teamMembers && formData.operations.teamMembers.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 block">Team Members</label>
                      <div className="space-y-2">
                        {formData.operations.teamMembers.map((member: any, index: number) => (
                          <div key={index} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                            <div>
                              <p className="font-medium">{member.name}</p>
                              <p className="text-sm text-muted-foreground">{member.role}</p>
                            </div>
                            <Badge variant="outline">{member.status}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">New Hires</label>
                      <p className="text-lg font-semibold">{formatNumber(formData.operations.newHires)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Departures</label>
                      <p className="text-lg font-semibold">{formatNumber(formData.operations.departures)}</p>
                    </div>
                  </div>
                  {formData.operations.challenges && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Operational Challenges</label>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{formData.operations.challenges}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Retention Section */}
            {formData.retention && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-orange-600" />
                    Client Retention
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Retention Rate</label>
                      <p className="text-lg font-semibold">{formatNumber(formData.retention.rate)}%</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Cancelled Policies</label>
                      <p className="text-lg font-semibold">{formatNumber(formData.retention.cancellations)}</p>
                    </div>
                  </div>
                  {formData.retention.strategies && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Retention Strategies</label>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{formData.retention.strategies}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Cash Flow Section */}
            {formData.cashFlow && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    Financial Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Total Compensation</label>
                      <p className="text-lg font-semibold">{formatCurrency(formData.cashFlow.compensation)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Business Expenses</label>
                      <p className="text-lg font-semibold">{formatCurrency(formData.cashFlow.expenses)}</p>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Net Profit</label>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency((parseFloat(formData.cashFlow.compensation) || 0) - (parseFloat(formData.cashFlow.expenses) || 0))}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Qualitative Section */}
            {formData.qualitative && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-indigo-600" />
                    Qualitative Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {formData.qualitative.wins && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Key Wins</label>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{formData.qualitative.wins}</p>
                    </div>
                  )}
                  {formData.qualitative.challenges && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Challenges Faced</label>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{formData.qualitative.challenges}</p>
                    </div>
                  )}
                  {formData.qualitative.goals && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Next Period Goals</label>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{formData.qualitative.goals}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};