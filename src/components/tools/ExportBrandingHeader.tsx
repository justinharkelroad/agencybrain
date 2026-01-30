import React from "react";

const LOGO_URL = "https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/AgencyBrain%20Logo/Agency%20Brain%20Logo%20Stan.png";

const COLORS = {
  cursive: '#c4b5fd',        // violet-300 for elegance
  star: '#818cf8',           // indigo-400
  dividerLine: '#334155',    // slate-700
  tagline: '#64748b',        // slate-500
  separator: '#6366f1',      // indigo-500
};

export function ExportBrandingHeader() {
  return (
    <div style={{ 
      textAlign: 'center', 
      paddingTop: '24px',
      paddingBottom: '24px', 
      marginBottom: '24px',
      borderBottom: `1px solid ${COLORS.dividerLine}`
    }}>
      {/* "Produced By" in cursive */}
      <p style={{ 
        fontFamily: "'Dancing Script', cursive",
        fontSize: '24px',
        fontWeight: 500,
        color: COLORS.cursive,
        margin: 0,
        marginBottom: '12px'
      }}>
        Produced By
      </p>
      
      {/* Agency Brain Logo */}
      <img 
        src={LOGO_URL}
        alt="Agency Brain"
        style={{ 
          height: '48px', 
          width: 'auto',
          display: 'block',
          margin: '0 auto 16px'
        }}
        crossOrigin="anonymous"
      />
      
      {/* Decorative divider with star */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: '12px', 
        marginBottom: '12px' 
      }}>
        <div style={{ 
          width: '60px', 
          height: '1px', 
          background: `linear-gradient(to right, transparent, ${COLORS.dividerLine})` 
        }} />
        <span style={{ color: COLORS.star, fontSize: '10px' }}>✦</span>
        <div style={{ 
          width: '60px', 
          height: '1px', 
          background: `linear-gradient(to left, transparent, ${COLORS.dividerLine})` 
        }} />
      </div>
      
      {/* Exclusivity tagline */}
      <p style={{
        fontSize: '10px',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color: COLORS.tagline,
        margin: 0
      }}>
        Exclusively through The Standard Playbook
      </p>
    </div>
  );
}
