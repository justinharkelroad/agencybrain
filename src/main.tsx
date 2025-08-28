import "@/boot/webcomponents-guard";
import "./polyfills/ce-define-guard";
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
    
    // Prevent problematic custom element registration
    const preventProblematicElements = () => {
      const problematicElements = ['mce-autosize-textarea'];
      
      problematicElements.forEach(elementName => {
        try {
          if (!customElements.get(elementName)) {
            // Register a dummy component to prevent the problematic one from loading
            customElements.define(elementName, class extends HTMLElement {
              constructor() {
                super();
                console.debug(`🔒 Blocked problematic element: ${elementName}`);
              }
            });
          }
        } catch (e) {
          console.debug(`Failed to block ${elementName}:`, e);
        }
      });
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
              if (el && typeof (el as any).destroy === 'function') {
                (el as any).destroy();
              }
              if (el && el.parentNode) {
                el.parentNode.removeChild(el);
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

    // Advanced MutationObserver to catch dynamic elements
    const setupMutationObserver = () => {
      const observer = new MutationObserver((mutations) => {
        let shouldCleanup = false;
        
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as Element;
                
                // Check if the added element or any of its children are problematic
                if (element.tagName === 'MCE-AUTOSIZE-TEXTAREA' || 
                    element.querySelector('mce-autosize-textarea') ||
                    element.getAttribute('is') === 'mce-autosize-textarea') {
                  console.debug('🔒 Detected problematic element added to DOM, scheduling cleanup');
                  shouldCleanup = true;
                }
              }
            });
          }
        });
        
        if (shouldCleanup) {
          // Delay cleanup to let the element fully initialize
          setTimeout(cleanupProblematicElements, 100);
        }
      });
      
      // Start observing
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      return observer;
    };

    // Run prevention immediately
    preventProblematicElements();

    // Multiple cleanup triggers
    cleanupProblematicElements(); // Immediate
    
    // DOM ready cleanup
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        cleanupProblematicElements();
        setupMutationObserver();
      });
    } else {
      // DOM already ready, run again
      setTimeout(() => {
        cleanupProblematicElements();
        setupMutationObserver();
      }, 0);
    }
    
    // Additional cleanup on window load (for late-loading scripts)
    window.addEventListener('load', () => {
      cleanupProblematicElements();
      // Extra aggressive cleanup after window load
      setTimeout(cleanupProblematicElements, 1000);
    });
    
    // Periodic cleanup for persistent conflicts
    if (isDevelopment) {
      setInterval(cleanupProblematicElements, 5000); // Every 5 seconds in dev mode
    }
    
  } catch (error) {
    console.debug('Enhanced custom element protection setup failed:', error);
  }
}

createRoot(document.getElementById("root")!).render(<App />);
