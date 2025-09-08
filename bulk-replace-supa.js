// Simple utility to replace all 'supa' with 'supabase' across all files
const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all TypeScript files in src
glob('src/**/*.{ts,tsx}', (err, files) => {
  if (err) throw err;
  
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const newContent = content.replace(/\bsupa\b/g, 'supabase');
    
    if (content !== newContent) {
      fs.writeFileSync(file, newContent, 'utf8');
      console.log(`Updated: ${file}`);
    }
  });
  
  console.log('Replacement complete!');
});