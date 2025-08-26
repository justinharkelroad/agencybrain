import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Prevent custom element conflicts globally - defensive approach
if (typeof window !== 'undefined') {
  try {
    // Intercept and prevent duplicate custom element registrations
    const originalDefine = customElements.define;
    customElements.define = function(name, constructor, options) {
      if (customElements.get(name)) {
        console.debug(`Custom element ${name} already defined, preventing duplicate registration`);
        return;
      }
      return originalDefine.call(this, name, constructor, options);
    };
    
    // Clean up any existing problematic elements
    const cleanupElements = () => {
      try {
        const existingElements = document.querySelectorAll('mce-autosize-textarea');
        existingElements.forEach(el => {
          try {
            el.remove();
          } catch (e) {
            console.debug('Element cleanup error:', e);
          }
        });
      } catch (error) {
        console.debug('Element cleanup failed:', error);
      }
    };

    // Run cleanup immediately
    cleanupElements();
    
    // Run cleanup after DOM loads
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', cleanupElements);
    }
    
  } catch (error) {
    console.debug('Custom element protection setup failed:', error);
  }
}

createRoot(document.getElementById("root")!).render(<App />);
