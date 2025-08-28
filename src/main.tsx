import "@/lib/custom-elements-guard"; // MUST be first - ONLY custom element guard
import { supa } from "@/lib/supabase";

// Verify session at bootstrap with detailed debugging
supa.auth.getSession().then(({ data }) => {
  console.log("🔐 Auth session present?", Boolean(data.session));
  if (data.session) {
    console.log("👤 User ID:", data.session.user.id);
    console.log("📧 User email:", data.session.user.email);
  }
});
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);