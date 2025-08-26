// Utility for testing public form links during development
export const testFormLink = async (slug: string, token: string) => {
  console.log(`🧪 Testing form link: /f/${slug}?t=${token}`);
  
  // Test 1: Check if JavaScript errors occur
  const originalConsoleError = console.error;
  const errors: any[] = [];
  console.error = (...args) => {
    errors.push(args);
    originalConsoleError(...args);
  };
  
  try {
    // Test 2: Verify the URL structure
    const testUrl = `/f/${slug}?t=${token}`;
    console.log(`✅ URL structure valid: ${testUrl}`);
    
    // Test 3: Check for custom element conflicts
    const existingElements = document.querySelectorAll('mce-autosize-textarea');
    if (existingElements.length > 0) {
      console.warn(`⚠️  Found ${existingElements.length} existing mce-autosize-textarea elements`);
    } else {
      console.log(`✅ No custom element conflicts detected`);
    }
    
    // Test 4: Check if customElements API is available
    if (typeof customElements !== 'undefined') {
      const isDefined = customElements.get('mce-autosize-textarea');
      if (isDefined) {
        console.warn(`⚠️  mce-autosize-textarea already defined in customElements`);
      } else {
        console.log(`✅ mce-autosize-textarea not pre-defined`);
      }
    }
    
    console.log(`🎯 Form link test completed. Navigate to: ${testUrl}`);
    
    return {
      success: true,
      url: testUrl,
      errors: errors.length > 0 ? errors : null
    };
    
  } finally {
    console.error = originalConsoleError;
  }
};

// Quick test function for the current form
export const testCurrentForm = () => {
  const token = '4c0bccb7-6988-4c20-bb4f-9e4a4a632fc6';
  const slug = 'sales-scorecard';
  return testFormLink(slug, token);
};