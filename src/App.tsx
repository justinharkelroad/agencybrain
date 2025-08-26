import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PublicFormErrorBoundary } from "@/components/PublicFormErrorBoundary";
// Index page removed
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Submit from "./pages/Submit";
import Uploads from "./pages/Uploads";
import UploadSelection from "./pages/UploadSelection";
import FileProcessor from "./pages/FileProcessor";
import ProcessVault from "./pages/ProcessVault";
import ScorecardForms from "./pages/ScorecardForms";
import ScorecardFormBuilder from "./pages/ScorecardFormBuilder";
import ScorecardFormEditor from "./pages/ScorecardFormEditor";
import PublicFormSubmission from "./pages/PublicFormSubmission";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminAnalysis from "./pages/admin/AdminAnalysis";
import AdminPrompts from "./pages/admin/AdminPrompts";
import AdminProcessVaultTypes from "./pages/admin/AdminProcessVaultTypes";
import AdminTeam from "./pages/admin/AdminTeam";
import AdminMember from "./pages/admin/AdminMember";
import AdminChecklists from "./pages/admin/AdminChecklists";
import ClientDetail from "./pages/admin/ClientDetail";
import Agency from "./pages/Agency";
import AgencyMember from "./pages/agency/AgencyMember";
import NotFound from "./pages/NotFound";
import Health from "./pages/Health";
import Landing from "./pages/Landing";
import BonusGrid from "./pages/BonusGrid";
import SnapshotPlanner from "./pages/SnapshotPlanner";

const queryClient = new QueryClient();

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
            {/* Scorecard Forms Routes */}
            <Route path="/scorecard-forms" element={
              <ProtectedRoute>
                <ScorecardForms />
              </ProtectedRoute>
            } />
            <Route path="/scorecard-forms/builder" element={
              <ProtectedRoute>
                <ScorecardFormBuilder />
              </ProtectedRoute>
            } />
            <Route path="/scorecard-forms/edit/:formId" element={
              <ProtectedRoute>
                <ScorecardFormEditor />
              </ProtectedRoute>
            } />
            {/* Public form submission - no auth required */}
            <Route path="/f/:slug" element={<PublicFormSubmission />} />
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
