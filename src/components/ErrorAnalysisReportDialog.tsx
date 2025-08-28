import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getErrorAnalysisReport, analyzePromptFetchingPatterns } from '@/lib/promptFetcher';
import { BarChart3, AlertTriangle, CheckCircle, Clock, Info } from 'lucide-react';

export function ErrorAnalysisReportDialog() {
  const [report, setReport] = React.useState<any>(null);
  const [promptPatterns, setPromptPatterns] = React.useState<any>(null);

  const generateReport = () => {
    const errorReport = getErrorAnalysisReport();
    const fetchingPatterns = analyzePromptFetchingPatterns();
    
    setReport(errorReport);
    setPromptPatterns(fetchingPatterns);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={generateReport}
          className="gap-2"
        >
          <BarChart3 className="h-4 w-4" />
          Error Analysis
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Comprehensive Error Analysis Report
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh]">
          <div className="space-y-6 p-4">
            
            {/* Summary Cards */}
            {report && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary">
                      {report.summary.totalLogs}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Logs</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {report.summary.totalErrors}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Errors</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {report.summary.totalSuccesses}
                    </div>
                    <div className="text-sm text-muted-foreground">Successes</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {report.summary.recentFailures}
                    </div>
                    <div className="text-sm text-muted-foreground">Recent Failures</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Prompt Fetching Analysis */}
            {promptPatterns && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Prompt Fetching Analysis
                  </CardTitle>
                  <CardDescription>
                    Analysis of prompt fetching success rates and patterns
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-semibold">{promptPatterns.authFailures}</div>
                    <div className="text-sm text-muted-foreground">Auth Failures</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">{promptPatterns.anonFailures}</div>
                    <div className="text-sm text-muted-foreground">Anonymous Failures</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">{promptPatterns.totalAttempts}</div>
                    <div className="text-sm text-muted-foreground">Total Attempts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-green-600">{promptPatterns.successRate}%</div>
                    <div className="text-sm text-muted-foreground">Success Rate</div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Error Patterns */}
            {report && Object.keys(report.errorPatterns).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Error Patterns
                  </CardTitle>
                  <CardDescription>
                    Most common error types and their frequency
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(report.errorPatterns)
                      .sort(([,a], [,b]) => (b as number) - (a as number))
                      .map(([pattern, count]) => (
                        <div key={pattern} className="flex justify-between items-center p-2 border rounded">
                          <span className="font-mono text-sm">{pattern}</span>
                          <Badge variant="secondary">{String(count)} occurrences</Badge>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Failures */}
            {report && report.recentFailures.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Recent Failures (Last 10)
                  </CardTitle>
                  <CardDescription>
                    Most recent error occurrences with details
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {report.recentFailures.map((failure: any, index: number) => (
                      <div key={index} className="border rounded p-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <Badge variant="outline">{failure.errorType}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(failure.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-sm font-medium">{failure.context}</div>
                        {failure.error && (
                          <div className="text-xs space-y-1">
                            <div><strong>Code:</strong> {failure.error.code || 'undefined'}</div>
                            <div><strong>Name:</strong> {failure.error.name || 'undefined'}</div>
                            <div><strong>Message:</strong> {failure.error.message || 'undefined'}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recommendations */}
            {report && report.recommendations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="h-5 w-5" />
                    Recommendations
                  </CardTitle>
                  <CardDescription>
                    Actionable insights based on error analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {report.recommendations.map((rec: string, index: number) => (
                      <div key={index} className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-950 rounded">
                        <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{rec}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* No Data State */}
            {!report && (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="text-muted-foreground">
                    Click "Generate Report" to analyze error patterns and performance
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}