import { lazy, Suspense, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PublicFormErrorBoundary } from "@/components/PublicFormErrorBoundary";
import { SidebarLayout } from "@/components/SidebarLayout";
import { LifeTargetsGuard } from "@/components/LifeTargetsGuard";
import { enableMetrics } from "@/lib/featureFlags";
import { useSessionRecovery } from "@/hooks/useSessionRecovery";
import { PWAUpdatePrompt } from "@/components/PWAUpdatePrompt";
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
import AdminTraining from "./pages/admin/AdminTraining";
import AdminStandardPlaybook from "./pages/admin/AdminStandardPlaybook";
import AdminSPCategoryEditor from "./pages/admin/AdminSPCategoryEditor";
import AdminSPCategoryDetail from "./pages/admin/AdminSPCategoryDetail";
import AdminSPModuleDetail from "./pages/admin/AdminSPModuleDetail";
import AdminSPLessonEditor from "./pages/admin/AdminSPLessonEditor";
import TestTrainingComponents from "./pages/TestTrainingComponents";
import Agency from "./pages/Agency";
import AgencyMember from "./pages/agency/AgencyMember";
import NotFound from "./pages/NotFound";
import Health from "./pages/Health";
import Landing from "./pages/Landing";
import BonusGrid from "./pages/BonusGrid";
import SnapshotPlanner from "./pages/SnapshotPlanner";
import CancelAudit from "./pages/CancelAudit";
import SubmissionDetail from "./pages/SubmissionDetail";
import RepairExplorer from "./pages/RepairExplorer";
import RunRepair from "./pages/RunRepair";
import TestBackfill from "./pages/TestBackfill";
import RoleplayBot from "./pages/RoleplayBot";
import RoleplayStaff from "./pages/RoleplayStaff";
import ThetaTalkTrack from "./pages/ThetaTalkTrack";
const ThetaTalkTrackCreate = lazy(() => import("./pages/ThetaTalkTrackCreate"));
import ThetaTalkTrackDownload from "./pages/ThetaTalkTrackDownload";
import TestTrainingHooks from "./pages/TestTrainingHooks";
import StaffLogin from "./pages/StaffLogin";
import StaffForgotPassword from "./pages/staff/ForgotPassword";
import StaffResetPassword from "./pages/staff/ResetPassword";
import StaffAcceptInvite from "./pages/staff/AcceptInvite";
import StaffTraining from "./pages/StaffTraining";
import StaffSPTrainingHub from "./pages/staff/StaffSPTrainingHub";
import StaffSPCategory from "./pages/staff/StaffSPCategory";
import StaffSPLesson from "./pages/staff/StaffSPLesson";
import StaffFormSubmission from "./pages/StaffFormSubmission";
import { StaffProtectedRoute } from "./components/StaffProtectedRoute";
import { StaffLayout, StaffDashboard, StaffAccountSettings, StaffSubmitWrapper } from "./components/staff";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AcceptKeyEmployeeInvite from "./pages/AcceptKeyEmployeeInvite";
// Lazy load Life Targets pages for better performance
const LifeTargets = lazy(() => import("./pages/LifeTargets"));
const LifeTargetsBrainstorm = lazy(() => import("./pages/LifeTargetsBrainstorm"));
const LifeTargetsSelection = lazy(() => import("./pages/LifeTargetsSelection"));
const LifeTargetsQuarterly = lazy(() => import("./pages/LifeTargetsQuarterly"));
const LifeTargetsMissions = lazy(() => import("./pages/LifeTargetsMissions"));
const LifeTargetsDaily = lazy(() => import("./pages/LifeTargetsDaily"));
const LifeTargetsCascade = lazy(() => import("./pages/LifeTargetsCascade"));
const LifeTargetsHistory = lazy(() => import("./pages/LifeTargetsHistory"));
const Core4Page = lazy(() => import("./pages/Core4"));

// Flows pages
import Flows from "./pages/Flows";
import FlowProfile from "./pages/flows/FlowProfile";
import FlowStart from "./pages/flows/FlowStart";
import FlowSession from "./pages/flows/FlowSession";
import FlowComplete from "./pages/flows/FlowComplete";
import FlowView from "./pages/flows/FlowView";
import FlowLibrary from "./pages/flows/FlowLibrary";
import AdminFlows from "./pages/admin/AdminFlows";
import AdminFlowEditor from "./pages/admin/AdminFlowEditor";
import AdminHelpVideos from "./pages/admin/AdminHelpVideos";
import CallScoringTemplates from "./pages/admin/CallScoringTemplates";
import AdminExchangeTags from "./pages/admin/AdminExchangeTags";
import AdminExchangeReports from "./pages/admin/AdminExchangeReports";
import AdminExchangeAnalytics from "./pages/admin/AdminExchangeAnalytics";
import CallScoring from "./pages/CallScoring";
import Exchange from "./pages/Exchange";
import ExchangeMessages from "./pages/ExchangeMessages";
import ExchangePostPage from "./pages/ExchangePost";
import StaffFlows from "./pages/staff/StaffFlows";
import StaffCore4 from "./pages/staff/StaffCore4";
import StaffFlowProfile from "./pages/staff/StaffFlowProfile";

// Training pages
import UnifiedTrainingHub from "./pages/training/UnifiedTrainingHub";
import TrainingHub from "./pages/training/TrainingHub";
import TrainingCategory from "./pages/training/TrainingCategory";
import TrainingLesson from "./pages/training/TrainingLesson";
import StaffUnifiedTrainingHub from "./pages/staff/StaffUnifiedTrainingHub";

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

// Fix encoded URLs before router matching (handles %3F encoding bug)
const URLFixer = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname.includes('%3F')) {
      const decodedPath = decodeURIComponent(location.pathname);
      navigate(decodedPath + location.search + location.hash, { replace: true });
    }
  }, [location.pathname, navigate]);

  return null;
};

// Global session recovery - detects invalid sessions and redirects to login
const SessionRecoveryHandler = () => {
  useSessionRecovery();
  return null;
};

const App = () => {
  // Hide PWA splash screen once app is ready
  useEffect(() => {
    const splash = document.getElementById('splash-screen');
    if (splash) {
      // Minimum display time of 1.5 seconds for branding
      setTimeout(() => {
        splash.classList.add('fade-out');
        setTimeout(() => {
          splash.remove();
        }, 300);
      }, 1500);
    }
  }, []);

  return (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider defaultTheme="dark">
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <PWAUpdatePrompt />
            <BrowserRouter>
            <URLFixer />
            <SessionRecoveryHandler />
            <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/accept-key-employee-invite" element={<AcceptKeyEmployeeInvite />} />
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
            <Route path="/cancel-audit" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <CancelAudit />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            {/* Exchange Routes */}
            <Route path="/exchange" element={
              <ProtectedRoute>
                <Exchange />
              </ProtectedRoute>
            } />
            <Route path="/exchange/messages" element={
              <ProtectedRoute>
                <ExchangeMessages />
              </ProtectedRoute>
            } />
            <Route path="/exchange/post/:postId" element={
              <ProtectedRoute>
                <ExchangePostPage />
              </ProtectedRoute>
            } />
            {/* Flows Routes */}
            <Route path="/flows" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <Flows />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/flows/profile" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <FlowProfile />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/flows/start/:slug" element={
              <ProtectedRoute>
                <FlowStart />
              </ProtectedRoute>
            } />
            <Route path="/flows/session/:slug" element={
              <ProtectedRoute>
                <FlowSession />
              </ProtectedRoute>
            } />
            <Route path="/flows/complete/:sessionId" element={
              <ProtectedRoute>
                <FlowComplete />
              </ProtectedRoute>
            } />
            <Route path="/flows/view/:sessionId" element={
              <ProtectedRoute>
                <FlowView />
              </ProtectedRoute>
            } />
            <Route path="/flows/library" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <FlowLibrary />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            {/* Training Routes - Unified Hub */}
            <Route path="/training" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <UnifiedTrainingHub />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            {/* Standard Playbook Routes */}
            <Route path="/training/standard" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <TrainingHub />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/training/standard/:categorySlug" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <TrainingCategory />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/training/standard/:categorySlug/:moduleSlug/:lessonSlug" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <TrainingLesson />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            {/* Agency Training Routes */}
            <Route path="/training/agency" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <StaffTraining />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/training/agency/manage" element={
              <ProtectedRoute requireAgencyOwner>
                <SidebarLayout>
                  <AdminTraining />
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
            <Route path="/life-targets/history" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
                    <LifeTargetsHistory />
                  </Suspense>
                </SidebarLayout>
              </ProtectedRoute>
            } />
            {/* Core 4 Route */}
            <Route path="/core4" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
                    <Core4Page />
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
            <Route path="/call-scoring" element={
              <ProtectedRoute>
                <SidebarLayout>
                  <CallScoring />
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
            <Route path="/admin/help-videos" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <AdminHelpVideos />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/exchange-reports" element={
              <ProtectedRoute requireAdmin>
                <AdminExchangeReports />
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
            <Route path="/admin/exchange-tags" element={
              <ProtectedRoute requireAdmin>
                <AdminExchangeTags />
              </ProtectedRoute>
            } />
            <Route path="/admin/exchange-analytics" element={
              <ProtectedRoute requireAdmin>
                <AdminExchangeAnalytics />
              </ProtectedRoute>
            } />
            <Route path="/admin/training" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <AdminTraining />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            {/* Standard Playbook Routes */}
            <Route path="/admin/standard-playbook" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <AdminStandardPlaybook />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/standard-playbook/category/new" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <AdminSPCategoryEditor />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/standard-playbook/category/:categoryId/edit" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <AdminSPCategoryEditor />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/standard-playbook/category/:categoryId" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <AdminSPCategoryDetail />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/standard-playbook/module/:moduleId" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <AdminSPModuleDetail />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/standard-playbook/lesson/new" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <AdminSPLessonEditor />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/standard-playbook/lesson/:lessonId" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <AdminSPLessonEditor />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            {/* Admin Flow Template Manager */}
            <Route path="/admin/flows" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <AdminFlows />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/flows/new" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <AdminFlowEditor />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/flows/edit/:templateId" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <AdminFlowEditor />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            {/* Call Scoring Routes */}
            <Route path="/admin/call-scoring/templates" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <CallScoringTemplates />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            {/* Redirect legacy agency training route to unified hub */}
            <Route path="/agency/training" element={<Navigate to="/training/agency/manage" replace />} />
            {/* Redirect old training routes to new tabbed interface */}
            <Route path="/admin/staff-users" element={<Navigate to="/admin/training?tab=staff" replace />} />
            <Route path="/admin/training-assignments" element={<Navigate to="/admin/training?tab=assignments" replace />} />
            <Route path="/admin/training-progress" element={<Navigate to="/admin/training?tab=progress" replace />} />
            <Route path="/test-training-components" element={
              <ProtectedRoute requireAdmin>
                <TestTrainingComponents />
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
            
            <Route path="/test-training-hooks" element={
              <ProtectedRoute requireAdmin>
                <SidebarLayout>
                  <TestTrainingHooks />
                </SidebarLayout>
              </ProtectedRoute>
            } />
            
            {/* Staff Portal Routes - separate auth system */}
            <Route path="/staff/login" element={<StaffLogin />} />
            <Route path="/staff/forgot-password" element={<StaffForgotPassword />} />
            <Route path="/staff/reset-password" element={<StaffResetPassword />} />
            <Route path="/staff/accept-invite" element={<StaffAcceptInvite />} />
            
            {/* Protected Staff Routes with Sidebar Layout */}
            <Route path="/staff" element={
              <StaffProtectedRoute>
                <StaffLayout />
              </StaffProtectedRoute>
            }>
              <Route index element={<Navigate to="/staff/dashboard" replace />} />
              <Route path="dashboard" element={<StaffDashboard />} />
              <Route path="submit" element={<StaffSubmitWrapper />} />
              <Route path="submit/:formSlug" element={<StaffFormSubmission />} />
              {/* Unified Training Hub */}
              <Route path="training" element={<StaffUnifiedTrainingHub />} />
              {/* Standard Playbook */}
              <Route path="training/standard" element={<StaffSPTrainingHub />} />
              <Route path="training/standard/:categorySlug" element={<StaffSPCategory />} />
              <Route path="training/standard/:categorySlug/:moduleSlug/:lessonSlug" element={<StaffSPLesson />} />
              {/* Agency Training */}
              <Route path="training/agency" element={<StaffTraining />} />
              {/* Legacy redirects for backward compatibility */}
              <Route path="playbook/*" element={<Navigate to="/staff/training/standard" replace />} />
              <Route path="account" element={<StaffAccountSettings />} />
              {/* Core 4 */}
              <Route path="core4" element={<StaffCore4 />} />
              {/* Flows */}
              <Route path="flows" element={<StaffFlows />} />
              <Route path="flows/profile" element={<StaffFlowProfile />} />
              <Route path="flows/library" element={<FlowLibrary />} />
              {/* Call Scoring */}
              <Route path="call-scoring" element={<CallScoring />} />
            </Route>
            {/* Staff Flows Routes - Full screen (no sidebar) */}
            <Route path="/staff/flows/start/:slug" element={
              <StaffProtectedRoute>
                <FlowStart />
              </StaffProtectedRoute>
            } />
            <Route path="/staff/flows/session/:slug" element={
              <StaffProtectedRoute>
                <FlowSession />
              </StaffProtectedRoute>
            } />
            <Route path="/staff/flows/complete/:sessionId" element={
              <StaffProtectedRoute>
                <FlowComplete />
              </StaffProtectedRoute>
            } />
            <Route path="/staff/flows/view/:sessionId" element={
              <StaffProtectedRoute>
                <FlowView />
              </StaffProtectedRoute>
            } />
            
            {/* Regular User Password Reset */}
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
        </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;
