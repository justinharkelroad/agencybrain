import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Enhanced custom element protection - prevents conflicts and overlay issues
if (typeof window !== 'undefined') {
  try {
    const isDevelopment = import.meta.env.DEV;
    
    if (isDevelopment) {
      console.log('🛡️ Development mode: Enhanced custom element protection enabled');
    }
    
    // Robust custom element registration interceptor
    const originalDefine = customElements.define;
    customElements.define = function(name, constructor, options) {
      try {
        if (customElements.get(name)) {
          console.debug(`🔒 Prevented duplicate custom element registration: ${name}`);
          return;
        }
        return originalDefine.call(this, name, constructor, options);
      } catch (error) {
        console.debug(`Custom element registration error for ${name}:`, error);
        return; // Fail silently to prevent crashes
      }
    };
    
    // Enhanced cleanup for problematic elements
    const cleanupProblematicElements = () => {
      try {
        // Target known problematic elements
        const selectors = [
          'mce-autosize-textarea',
          '[is="mce-autosize-textarea"]',
          'textarea[is="mce-autosize-textarea"]'
        ];
        
        selectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            try {
              // Try to properly dispose if it has cleanup methods
              if (el && typeof (el as any).disconnect === 'function') {
                (el as any).disconnect();
              }
              if (el && typeof el.remove === 'function') {
                el.remove();
              }
            } catch (e) {
              console.debug(`Element cleanup error for ${selector}:`, e);
            }
          });
        });
      } catch (error) {
        console.debug('Comprehensive element cleanup failed:', error);
      }
    };

    // Multiple cleanup triggers
    cleanupProblematicElements(); // Immediate
    
    // DOM ready cleanup
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', cleanupProblematicElements);
    } else {
      // DOM already ready, run again
      setTimeout(cleanupProblematicElements, 0);
    }
    
    // Additional cleanup on window load (for late-loading scripts)
    window.addEventListener('load', cleanupProblematicElements);
    
    // Periodic cleanup for persistent conflicts
    if (isDevelopment) {
      setInterval(cleanupProblematicElements, 5000); // Every 5 seconds in dev mode
    }
    
  } catch (error) {
    console.debug('Enhanced custom element protection setup failed:', error);
  }
}

createRoot(document.getElementById("root")!).render(<App />);
