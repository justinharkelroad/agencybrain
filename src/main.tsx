import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Prevent custom element conflicts globally
if (typeof window !== 'undefined') {
  // Handle existing custom elements to prevent duplicate registration errors
  const handleCustomElementConflicts = () => {
    try {
      // Remove any existing mce-autosize-textarea elements
      const existingElements = document.querySelectorAll('mce-autosize-textarea');
      existingElements.forEach(el => el.remove());
      
      // Prevent registration conflicts by checking if already defined
      const elementName = 'mce-autosize-textarea';
      if (customElements.get(elementName)) {
        console.debug(`Custom element ${elementName} already registered, skipping`);
      }
    } catch (error) {
      console.debug('Custom element conflict handling:', error);
    }
  };

  // Run on initial load
  handleCustomElementConflicts();
  
  // Run on DOM changes to handle dynamic content
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleCustomElementConflicts);
  }
}

createRoot(document.getElementById("root")!).render(<App />);
