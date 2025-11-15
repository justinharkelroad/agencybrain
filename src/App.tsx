import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PublicFormErrorBoundary } from "@/components/PublicFormErrorBoundary";
import { SidebarLayout } from "@/components/SidebarLayout";
import { LifeTargetsGuard } from "@/components/LifeTargetsGuard";
import { enableMetrics } from "@/lib/featureFlags";
import Targets from "./pages/Targets";
import ScorecardSettings from "./pages/ScorecardSettings";
import ProspectSettings from "./pages/ProspectSettings";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import TeamRingsGrid from "./pages/TeamRingsGrid";
// Index page removed
import Auth from "./pages/Auth";
import MetricsDashboard from "./pages/MetricsDashboard";
import Submit from "./pages/Submit";
import Uploads from "./pages/Uploads";
import UploadSelection from "./pages/UploadSelection";
import FileProcessor from "./pages/FileProcessor";
import ProcessVault from "./pages/ProcessVault";
import ScorecardForms from "./pages/ScorecardForms";
import ScorecardFormBuilder from "./pages/ScorecardFormBuilder";
import ScorecardFormEditor from "./pages/ScorecardFormEditor";
import PublicFormRoute from "./pages/PublicFormRoute";
import Dashboard from "./pages/Dashboard";
import MetricsEditRedirect from "./components/MetricsEditRedirect";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminAnalysis from "./pages/admin/AdminAnalysis";
import AdminPrompts from "./pages/admin/AdminPrompts";
import AdminProcessVaultTypes from "./pages/admin/AdminProcessVaultTypes";
import AdminTeam from "./pages/admin/AdminTeam";
import AdminMember from "./pages/admin/AdminMember";
import AdminChecklists from "./pages/admin/AdminChecklists";
import RoleplayReports from "./pages/admin/RoleplayReports";
import ClientDetail from "./pages/admin/ClientDetail";
import FieldMappingSetup from "./pages/admin/FieldMappingSetup";
import AdminFocusManagement from "./pages/admin/AdminFocusManagement";
import Agency from "./pages/Agency";
import AgencyMember from "./pages/agency/AgencyMember";
import NotFound from "./pages/NotFound";
import Health from "./pages/Health";
import Landing from "./pages/Landing";
import BonusGrid from "./pages/BonusGrid";
import SnapshotPlanner from "./pages/SnapshotPlanner";
import SubmissionDetail from "./pages/SubmissionDetail";
import RepairExplorer from "./pages/RepairExplorer";
import RunRepair from "./pages/RunRepair";
import TestBackfill from "./pages/TestBackfill";
import RoleplayBot from "./pages/RoleplayBot";
import RoleplayStaff from "./pages/RoleplayStaff";
import ThetaTalkTrack from "./pages/ThetaTalkTrack";
const ThetaTalkTrackCreate = lazy(() => import("./pages/ThetaTalkTrackCreate"));
import ThetaTalkTrackDownload from "./pages/ThetaTalkTrackDownload";
// Lazy load Life Targets pages for better performance
const LifeTargets = lazy(() => import("./pages/LifeTargets"));
const LifeTargetsBrainstorm = lazy(() => import("./pages/LifeTargetsBrainstorm"));
const LifeTargetsSelection = lazy(() => import("./pages/LifeTargetsSelection"));
const LifeTargetsQuarterly = lazy(() => import("./pages/LifeTargetsQuarterly"));
const LifeTargetsMissions = lazy(() => import("./pages/LifeTargetsMissions"));
const LifeTargetsDaily = lazy(() => import("./pages/LifeTargetsDaily"));
const LifeTargetsCascade = lazy(() => import("./pages/LifeTargetsCascade"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 60 seconds
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider defaultTheme="dark">
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
            <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <Dashboard />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/explorer" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <ScorecardForms />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/submit" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <Submit />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/uploads" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <Uploads />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/uploads/select" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <UploadSelection />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/file-processor" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <FileProcessor />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/process-vault" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <ProcessVault />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            {/* Metrics Routes */}
            {enableMetrics && (
              <>
                <Route path="/metrics" element={
                  <ProtectedRoute>
                    <SidebarLayout>
                      <ScorecardForms />
                    </SidebarLayout>
                  </ProtectedRoute>
                } />
                <Route path="/scorecard-forms" element={<Navigate to="/metrics" replace />} />
                <Route path="/metrics/builder" element={
                  <ProtectedRoute>
                    <SidebarLayout>
                      <ScorecardFormBuilder />
                    </SidebarLayout>
                  </ProtectedRoute>
                } />
                <Route path="/metrics/edit/:formId" element={
                  <ProtectedRoute>
                    <SidebarLayout>
                      <ScorecardFormEditor />
                    </SidebarLayout>
                  </ProtectedRoute>
                } />
                {/* Legacy scorecard-forms routes redirect to metrics */}
                <Route path="/scorecard-forms/builder" element={<Navigate to="/metrics/builder" replace />} />
                <Route path="/scorecard-forms/edit/:formId" element={<MetricsEditRedirect />} />
              </>
            )}
            {/* Public form submission - no auth required */}
            <Route path="/f/:agencySlug/:formSlug" element={<PublicFormRoute />} />
            {/* Phase 2: Targets and Scorecard Settings */}
            <Route path="/targets" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <Targets />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/life-targets" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
                    <LifeTargets />
                  </Suspense>
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/life-targets/brainstorm" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
                    <LifeTargetsBrainstorm />
                  </Suspense>
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/life-targets/selection" element={
              <ProtectedRoute>
                <LifeTargetsGuard requiredStep="selection">
                  <SidebarLayout>
                    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
                      <LifeTargetsSelection />
                    </Suspense>
                  </SidebarLayout>
                </LifeTargetsGuard>
              </ProtectedRoute>
            } />
            <Route path="/life-targets/quarterly" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
                    <LifeTargetsQuarterly />
                  </Suspense>
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/life-targets/missions" element={
              <ProtectedRoute>
                <LifeTargetsGuard requiredStep="missions">
                  <SidebarLayout>
                    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
                      <LifeTargetsMissions />
                    </Suspense>
                  </SidebarLayout>
                </LifeTargetsGuard>
              </ProtectedRoute>
            } />
            <Route path="/life-targets/daily" element={
              <ProtectedRoute>
                <LifeTargetsGuard requiredStep="actions">
                  <SidebarLayout>
                    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
                      <LifeTargetsDaily />
                    </Suspense>
                  </SidebarLayout>
                </LifeTargetsGuard>
              </ProtectedRoute>
            } />
            <Route path="/life-targets/cascade" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
                    <LifeTargetsCascade />
                  </Suspense>
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <Settings />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/scorecard-settings" element={<Navigate to="/settings" replace />} />
            <Route path="/prospect-settings" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <ProspectSettings />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/analytics" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <Analytics />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/team-rings" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <TeamRingsGrid />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <AdminDashboard />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/client/:clientId" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <ClientDetail />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/analysis" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <AdminAnalysis />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/prompts" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <AdminPrompts />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/process-vault-types" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <AdminProcessVaultTypes />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/roleplay-reports" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <RoleplayReports />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/team" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <AdminTeam />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/checklists" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <AdminChecklists />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/field-mapping-setup" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <FieldMappingSetup />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/focus-management" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <AdminFocusManagement />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/team/:memberId" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <AdminMember />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/agency" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <Agency />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/agency/team/:memberId" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <AgencyMember />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/health" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <Health />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/bonus-grid" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <BonusGrid />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/snapshot-planner" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <SnapshotPlanner />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/submissions/:submissionId" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <SubmissionDetail />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/repair-explorer" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <RepairExplorer />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/run-repair" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <RunRepair />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/test-backfill" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <TestBackfill />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/roleplaybot" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <RoleplayBot />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/roleplay-staff" element={<RoleplayStaff />} />
            
            {/* Public Theta Talk Track Routes */}
            <Route path="/theta-talk-track" element={<ThetaTalkTrack />} />
            <Route path="/theta-talk-track/create" element={
              <Suspense fallback={<div>Loading...</div>}>
                <ThetaTalkTrackCreate />
              </Suspense>
            } />
            <Route path="/theta-talk-track/download" element={<ThetaTalkTrackDownload />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
        </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
