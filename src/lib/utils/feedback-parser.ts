// Helper to parse STRENGTHS/GAPS/ACTION from feedback string
export function parseFeedback(feedback: string | null): { 
  strengths: string | null; 
  gaps: string | null; 
  action: string | null;
  raw: string | null;
} {
  if (!feedback) return { strengths: null, gaps: null, action: null, raw: null };
  
  // More robust regex patterns that handle inline format "STRENGTHS: text. GAPS: text. ACTION: text."
  // Using [\s\S] instead of [^] for better compatibility, and making the lookahead more flexible
  const strengthsMatch = feedback.match(/STRENGTHS?\s*[:-]\s*([\s\S]*?)(?=\s*GAPS?\s*[:-]|$)/i);
  const gapsMatch = feedback.match(/GAPS?\s*[:-]\s*([\s\S]*?)(?=\s*ACTIONS?\s*[:-]|$)/i);
  const actionMatch = feedback.match(/ACTIONS?\s*[:-]\s*([\s\S]*?)$/i);
  
  // Clean up extracted text - remove trailing periods if they're followed by a label
  const cleanText = (text: string | null) => {
    if (!text) return null;
    return text.replace(/\s*$/, '').trim();
  };
  
  return {
    strengths: cleanText(strengthsMatch?.[1]) || null,
    gaps: cleanText(gapsMatch?.[1]) || null,
    action: cleanText(actionMatch?.[1]) || null,
    raw: feedback
  };
}
