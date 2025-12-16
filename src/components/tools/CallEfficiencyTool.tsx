import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, FileText, AlertTriangle, CheckCircle2, X, Users, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { parseCallLogCSV, ParsedCallLog } from "@/utils/callLogParser";
import { calculateCallEfficiency, CallEfficiencyResults } from "@/utils/callEfficiencyCalculator";
import { format } from "date-fns";
import CallEfficiencyReportCard from "./CallEfficiencyReportCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

interface CallEfficiencyToolProps {
  onBack: () => void;
}

interface UserMatch {
  csvName: string;
  teamMember: { id: string; name: string } | null;
  confidence: 'exact' | 'partial' | 'none';
  callCount: number;
}

const THRESHOLD_OPTIONS = [
  { value: "2", label: "2 minutes" },
  { value: "3", label: "3 minutes" },
  { value: "4", label: "4 minutes" },
  { value: "5", label: "5 minutes" },
  { value: "10", label: "10 minutes" },
  { value: "20", label: "20 minutes" },
];

function matchUsersToTeamMembers(
  csvUsers: string[], 
  teamMembers: { id: string; name: string }[],
  callsPerUser: Record<string, number>
): UserMatch[] {
  return csvUsers.map(csvName => {
    const normalizedCsvName = csvName.toLowerCase().trim();
    
    // Try exact match first
    let match = teamMembers.find(tm => 
      tm.name.toLowerCase().trim() === normalizedCsvName
    );
    
    if (match) {
      return { csvName, teamMember: match, confidence: 'exact' as const, callCount: callsPerUser[csvName] || 0 };
    }
    
    // Try first name match (CSV name contains team member's first name)
    match = teamMembers.find(tm => {
      const firstName = tm.name.split(' ')[0].toLowerCase();
      const csvFirstName = normalizedCsvName.split(' ')[0];
      return normalizedCsvName.includes(firstName) || firstName.includes(csvFirstName);
    });
    
    if (match) {
      return { csvName, teamMember: match, confidence: 'partial' as const, callCount: callsPerUser[csvName] || 0 };
    }
    
    // Try if team member name appears anywhere in CSV name (for "Nate Carty (806) 866-0619" format)
    match = teamMembers.find(tm => {
      const tmFirstName = tm.name.split(' ')[0].toLowerCase();
      const tmLastName = tm.name.split(' ').slice(-1)[0]?.toLowerCase();
      return normalizedCsvName.includes(tmFirstName) || 
             (tmLastName && tmLastName.length > 2 && normalizedCsvName.includes(tmLastName));
    });
    
    if (match) {
      return { csvName, teamMember: match, confidence: 'partial' as const, callCount: callsPerUser[csvName] || 0 };
    }
    
    // No match found
    return { csvName, teamMember: null, confidence: 'none' as const, callCount: callsPerUser[csvName] || 0 };
  });
}

export function CallEfficiencyTool({ onBack }: CallEfficiencyToolProps) {
  const { user } = useAuth();
  const [parsedData, setParsedData] = useState<ParsedCallLog | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [threshold, setThreshold] = useState<string>("2");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [results, setResults] = useState<CallEfficiencyResults | null>(null);
  const [showReport, setShowReport] = useState(false);
  
  // Team member matching state
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);
  const [userMatches, setUserMatches] = useState<UserMatch[]>([]);
  const [showMatchConfirmation, setShowMatchConfirmation] = useState(false);
  const [isLoadingTeamMembers, setIsLoadingTeamMembers] = useState(true);

  // Fetch team members on mount
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!user) {
        setIsLoadingTeamMembers(false);
        return;
      }
      
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('agency_id')
          .eq('id', user.id)
          .single();
        
        if (!profile?.agency_id) {
          setIsLoadingTeamMembers(false);
          return;
        }
        
        const { data: members } = await supabase
          .from('team_members')
          .select('id, name')
          .eq('agency_id', profile.agency_id)
          .eq('status', 'active');
        
        setTeamMembers(members || []);
      } catch (error) {
        console.error('Error fetching team members:', error);
      } finally {
        setIsLoadingTeamMembers(false);
      }
    };
    
    fetchTeamMembers();
  }, [user]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCallLogCSV(text);
      setParsedData(parsed);
      
      // Set default date range from parsed data
      if (parsed.dateRange.start && parsed.dateRange.end) {
        setStartDate(format(parsed.dateRange.start, "yyyy-MM-dd"));
        setEndDate(format(parsed.dateRange.end, "yyyy-MM-dd"));
      }
      
      // Clear previous results and confirmation
      setResults(null);
      setShowReport(false);
      setShowMatchConfirmation(false);
      setUserMatches([]);
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".csv"],
    },
    maxFiles: 1,
  });

  const handleGenerateClick = () => {
    if (!parsedData) return;
    
    // Calculate calls per user for display in confirmation
    const callsPerUser = parsedData.calls.reduce((acc, call) => {
      acc[call.user] = (acc[call.user] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Match CSV users to team members
    const matches = matchUsersToTeamMembers(parsedData.users, teamMembers, callsPerUser);
    setUserMatches(matches);
    setShowMatchConfirmation(true);
  };

  const updateMatch = (csvName: string, newTeamMemberId: string) => {
    setUserMatches(prev => prev.map(m => {
      if (m.csvName !== csvName) return m;
      if (newTeamMemberId === '__none__') {
        return { ...m, teamMember: null, confidence: 'none' as const };
      }
      const newMember = teamMembers.find(tm => tm.id === newTeamMemberId);
      return { ...m, teamMember: newMember || null, confidence: newMember ? 'partial' as const : 'none' as const };
    }));
  };

  const generateReportWithMatches = () => {
    if (!parsedData) return;
    
    // Build mapping of CSV names to team member names
    const matchedUsers = userMatches
      .filter(m => m.teamMember)
      .reduce((acc, m) => {
        acc[m.csvName] = m.teamMember!.name;
        return acc;
      }, {} as Record<string, string>);
    
    // Filter calls to only include matched users
    const filteredCalls = parsedData.calls.filter(call => 
      matchedUsers.hasOwnProperty(call.user)
    );
    
    // Rename users to their clean team member names
    const renamedCalls = filteredCalls.map(call => ({
      ...call,
      user: matchedUsers[call.user]
    }));
    
    // Apply date filter if set
    const dateFilter = startDate && endDate
      ? { start: new Date(startDate), end: new Date(endDate) }
      : undefined;
    
    // Calculate with filtered/renamed data
    const calculatedResults = calculateCallEfficiency(
      renamedCalls,
      parseInt(threshold),
      dateFilter
    );
    
    setResults(calculatedResults);
    setShowMatchConfirmation(false);
    setShowReport(true);
  };

  const handleClearFile = () => {
    setParsedData(null);
    setFileName("");
    setResults(null);
    setShowReport(false);
    setShowMatchConfirmation(false);
    setUserMatches([]);
    setStartDate("");
    setEndDate("");
  };

  const getFormatLabel = (format: string) => {
    switch (format) {
      case "ringcentral": return "RingCentral";
      case "ricochet": return "Ricochet";
      default: return "Generic CSV";
    }
  };

  const dateFilter = startDate && endDate
    ? { start: new Date(startDate), end: new Date(endDate) }
    : null;

  const matchedCount = userMatches.filter(m => m.teamMember).length;
  const unmatchedCount = userMatches.filter(m => !m.teamMember).length;

  // Show report card
  if (showReport && results && parsedData) {
    return (
      <CallEfficiencyReportCard
        results={results}
        parsedData={parsedData}
        fileName={fileName}
        dateFilter={dateFilter}
        onClose={() => setShowReport(false)}
      />
    );
  }

  // Show match confirmation
  if (showMatchConfirmation && parsedData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowMatchConfirmation(false)} aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-base font-medium text-muted-foreground">Call Efficiency Tool</h3>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Confirm Team Member Matches
            </CardTitle>
            <CardDescription>
              Review how CSV users were matched to your team members. Only matched users will be included in the report.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Matched Users */}
            {matchedCount > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-emerald-500 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Matched ({matchedCount})
                </h4>
                <div className="space-y-2">
                  {userMatches.filter(m => m.teamMember).map((match, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-muted-foreground text-sm">"{match.csvName}"</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{match.teamMember!.name}</span>
                        {match.confidence === 'partial' && (
                          <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                            Partial Match
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-sm">{match.callCount} calls</span>
                        <Select 
                          value={match.teamMember!.id} 
                          onValueChange={(newId) => updateMatch(match.csvName, newId)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {teamMembers.map(tm => (
                              <SelectItem key={tm.id} value={tm.id}>{tm.name}</SelectItem>
                            ))}
                            <SelectItem value="__none__">Don't include</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Unmatched Users */}
            {unmatchedCount > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-red-500 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Not Matched - Will Be Excluded ({unmatchedCount})
                </h4>
                <div className="space-y-2">
                  {userMatches.filter(m => !m.teamMember).map((match, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-sm">"{match.csvName}"</span>
                        <span className="text-muted-foreground text-xs">({match.callCount} calls)</span>
                      </div>
                      <Select 
                        value="__none__"
                        onValueChange={(newId) => updateMatch(match.csvName, newId)}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Assign to team member..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Exclude from report</SelectItem>
                          {teamMembers.map(tm => (
                            <SelectItem key={tm.id} value={tm.id}>{tm.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No team members warning */}
            {teamMembers.length === 0 && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-500">No team members found</p>
                  <p className="text-muted-foreground">
                    Add team members in your Agency settings to match CSV users.
                  </p>
                </div>
              </div>
            )}
            
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setShowMatchConfirmation(false)}>
              Back
            </Button>
            <Button 
              onClick={generateReportWithMatches}
              disabled={matchedCount === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Generate Report ({matchedCount} team member{matchedCount !== 1 ? 's' : ''})
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back to tools">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-base font-medium text-muted-foreground">Call Efficiency Tool</h3>
        </div>
      </div>

      {/* Upload Section */}
      <Card className="p-6">
        <h4 className="text-sm font-medium mb-4">Upload Call Log CSV</h4>
        
        {!parsedData ? (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-sm text-muted-foreground">Drop the CSV file here...</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-1">
                  Drag & drop a CSV file here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports RingCentral, Ricochet, and generic call log formats
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* File Info */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    Detected format: <span className="font-medium">{getFormatLabel(parsedData.format)}</span>
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClearFile}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Parse Status */}
            <div className="flex items-start gap-2 p-3 bg-emerald-500/10 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-emerald-500">Successfully parsed</p>
                <p className="text-muted-foreground">
                  {parsedData.calls.length} calls found • {parsedData.users.length} user{parsedData.users.length !== 1 ? "s" : ""} detected
                </p>
                {parsedData.dateRange.start && parsedData.dateRange.end && (
                  <p className="text-muted-foreground">
                    Date range: {format(parsedData.dateRange.start, "MMM d, yyyy")} → {format(parsedData.dateRange.end, "MMM d, yyyy")}
                  </p>
                )}
              </div>
            </div>

            {/* Team members status */}
            {isLoadingTeamMembers ? (
              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="text-sm">
                  <p className="text-muted-foreground">Loading team members...</p>
                </div>
              </div>
            ) : teamMembers.length > 0 ? (
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 rounded-lg">
                <Users className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-500">{teamMembers.length} team member{teamMembers.length !== 1 ? 's' : ''} available</p>
                  <p className="text-muted-foreground">
                    CSV users will be matched to your team members before generating the report.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-500">No team members found</p>
                  <p className="text-muted-foreground">
                    Add team members in your Agency settings to filter CSV users.
                  </p>
                </div>
              </div>
            )}

            {/* Parse Errors */}
            {parsedData.parseErrors.length > 0 && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-500">Parse warnings</p>
                  <ul className="text-muted-foreground list-disc list-inside">
                    {parsedData.parseErrors.slice(0, 5).map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                    {parsedData.parseErrors.length > 5 && (
                      <li>...and {parsedData.parseErrors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Controls Section */}
      {parsedData && parsedData.calls.length > 0 && (
        <Card className="p-6">
          <h4 className="text-sm font-medium mb-4">Report Settings</h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Duration Threshold */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Duration Threshold</label>
              <Select value={threshold} onValueChange={setThreshold}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THRESHOLD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>

          <Button
            onClick={handleGenerateClick}
            className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={!parsedData || parsedData.calls.length === 0 || isLoadingTeamMembers}
          >
            {teamMembers.length > 0 ? 'Match Team Members & Generate Report' : 'Generate Report'}
          </Button>
        </Card>
      )}
    </div>
  );
}

export default CallEfficiencyTool;
