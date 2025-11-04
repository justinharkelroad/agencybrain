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
import ClientDetail from "./pages/admin/ClientDetail";
import FieldMappingSetup from "./pages/admin/FieldMappingSetup";
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
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/explorer" element={
              <ProtectedRoute>
                <ScorecardForms />
              </ProtectedRoute>
            } />
            <Route path="/submit" element={
              <ProtectedRoute>
                <Submit />
              </ProtectedRoute>
            } />
            <Route path="/uploads" element={
              <ProtectedRoute>
                <Uploads />
              </ProtectedRoute>
            } />
            <Route path="/uploads/select" element={
              <ProtectedRoute>
                <UploadSelection />
              </ProtectedRoute>
            } />
            <Route path="/file-processor" element={
              <ProtectedRoute>
                <FileProcessor />
              </ProtectedRoute>
            } />
            <Route path="/process-vault" element={
              <ProtectedRoute>
                <ProcessVault />
              </ProtectedRoute>
            } />
            {/* Metrics Routes */}
            {enableMetrics && (
              <>
                <Route path="/metrics" element={
                  <ProtectedRoute>
                    <ScorecardForms />
                  </ProtectedRoute>
                } />
                <Route path="/scorecard-forms" element={<Navigate to="/metrics" replace />} />
                <Route path="/metrics/builder" element={
                  <ProtectedRoute>
                    <ScorecardFormBuilder />
                  </ProtectedRoute>
                } />
                <Route path="/metrics/edit/:formId" element={
                  <ProtectedRoute>
                    <ScorecardFormEditor />
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
                <Targets />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/scorecard-settings" element={<Navigate to="/settings" replace />} />
            <Route path="/prospect-settings" element={
              <ProtectedRoute>
                <ProspectSettings />
              </ProtectedRoute>
            } />
            <Route path="/analytics" element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            } />
            <Route path="/team-rings" element={
              <ProtectedRoute>
                <TeamRingsGrid />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute requireAdmin>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/client/:clientId" element={
              <ProtectedRoute requireAdmin>
                <ClientDetail />
              </ProtectedRoute>
            } />
            <Route path="/admin/analysis" element={
              <ProtectedRoute requireAdmin>
                <AdminAnalysis />
              </ProtectedRoute>
            } />
            <Route path="/admin/prompts" element={
              <ProtectedRoute requireAdmin>
                <AdminPrompts />
              </ProtectedRoute>
            } />
            <Route path="/admin/process-vault-types" element={
              <ProtectedRoute requireAdmin>
                <AdminProcessVaultTypes />
              </ProtectedRoute>
            } />
            <Route path="/admin/team" element={
              <ProtectedRoute requireAdmin>
                <AdminTeam />
              </ProtectedRoute>
            } />
            <Route path="/admin/checklists" element={
              <ProtectedRoute requireAdmin>
                <AdminChecklists />
              </ProtectedRoute>
            } />
            <Route path="/admin/field-mapping-setup" element={
              <ProtectedRoute requireAdmin>
                <FieldMappingSetup />
              </ProtectedRoute>
            } />
            <Route path="/admin/team/:memberId" element={
              <ProtectedRoute requireAdmin>
                <AdminMember />
              </ProtectedRoute>
            } />
            <Route path="/agency" element={
              <ProtectedRoute>
                <Agency />
              </ProtectedRoute>
            } />
            <Route path="/agency/team/:memberId" element={
              <ProtectedRoute>
                <AgencyMember />
              </ProtectedRoute>
            } />
            <Route path="/health" element={
              <ProtectedRoute requireAdmin>
                <Health />
              </ProtectedRoute>
            } />
            <Route path="/bonus-grid" element={
              <ProtectedRoute>
                <BonusGrid />
              </ProtectedRoute>
            } />
            <Route path="/snapshot-planner" element={
              <ProtectedRoute>
                <SnapshotPlanner />
              </ProtectedRoute>
            } />
            <Route path="/submissions/:submissionId" element={
              <ProtectedRoute>
                <SubmissionDetail />
              </ProtectedRoute>
            } />
            <Route path="/repair-explorer" element={
              <ProtectedRoute requireAdmin>
                <RepairExplorer />
              </ProtectedRoute>
            } />
            <Route path="/run-repair" element={
              <ProtectedRoute requireAdmin>
                <RunRepair />
              </ProtectedRoute>
            } />
            <Route path="/test-backfill" element={
              <ProtectedRoute requireAdmin>
                <TestBackfill />
              </ProtectedRoute>
            } />
            <Route path="/roleplaybot" element={
              <ProtectedRoute>
                <RoleplayBot />
              </ProtectedRoute>
            } />
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
