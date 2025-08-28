import "@/lib/custom-elements-guard"; // MUST be first
import "@/boot/webcomponents-guard";
import { supa } from "@/lib/supabase";

// Verify session at bootstrap
supa.auth.getSession().then(({ data }) => {
  console.log("auth session present?", Boolean(data.session));
});

import "./polyfills/ce-define-guard";
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);