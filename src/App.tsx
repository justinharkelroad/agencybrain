import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/ThemeProvider";
// Index page removed
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Submit from "./pages/Submit";
import Uploads from "./pages/Uploads";
import UploadSelection from "./pages/UploadSelection";
import FileProcessor from "./pages/FileProcessor";
import ProcessVault from "./pages/ProcessVault";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminAnalysis from "./pages/admin/AdminAnalysis";
import AdminPrompts from "./pages/admin/AdminPrompts";
import AdminProcessVaultTypes from "./pages/admin/AdminProcessVaultTypes";
import ClientDetail from "./pages/admin/ClientDetail";
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";
import Health from "./pages/Health";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
            <Routes>
            <Route path="/" element={<Auth />} />
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="/account" element={
              <ProtectedRoute>
                <Account />
              </ProtectedRoute>
            } />
            <Route path="/health" element={<Health />} />
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
