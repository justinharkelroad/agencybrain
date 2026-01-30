import { useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, X, FileImage, Target, Lightbulb, AlertTriangle, Quote, Eye, Rocket, BarChart3, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { ExportBrandingHeader } from "./ExportBrandingHeader";

interface LeaderBlueprintReportCardProps {
  module: {
    id: string;
    title: string;
    content: string;
    role: 'leader' | 'community';
    created_at: string;
  };
  open: boolean;
  onClose: () => void;
}

// Parse the leader blueprint content
function parseLeaderContent(content: string) {
  const blueprint = {
    topic: '',
    category: '',
    targetAudience: '',
    videoLength: '',
    hook: '',
    mainConcept: { title: '', description: '' },
    keyPoints: [] as { title: string; description: string }[],
    framework: { name: '', components: [] as { name: string; description: string }[] },
    story: { setup: '', conflict: '', resolution: '', lesson: '' },
    mistakes: [] as { mistake: string; whyFails: string; instead: string }[],
    quotes: [] as string[],
    visuals: [] as string[],
    cta: { primary: '', accountability: '' },
    metric: { metric: '', baseline: '', target: '', howToTrack: '' },
    placement: { module: '', prerequisite: '', followUp: '' }
  };

  // Extract basic info
  const topicMatch = content.match(/TOPIC:\s*(.+)/i);
  if (topicMatch) blueprint.topic = topicMatch[1].trim();

  const categoryMatch = content.match(/CATEGORY:\s*(.+)/i);
  if (categoryMatch) blueprint.category = categoryMatch[1].trim();

  const audienceMatch = content.match(/TARGET AUDIENCE:\s*(.+)/i);
  if (audienceMatch) blueprint.targetAudience = audienceMatch[1].trim();

  const lengthMatch = content.match(/VIDEO LENGTH RECOMMENDATION:\s*(.+)/i);
  if (lengthMatch) blueprint.videoLength = lengthMatch[1].trim();

  // Extract hook
  const hookSection = content.match(/THE HOOK[\s\S]*?(?=---|\nCORE TEACHING)/i)?.[0] || '';
  const hookContent = hookSection.replace(/THE HOOK.*?\n/i, '').replace(/\(First 30 Seconds\)/i, '').trim();
  blueprint.hook = hookContent;

  // Extract main concept
  const mainConceptMatch = content.match(/MAIN CONCEPT:\s*(.+?)\n([\s\S]*?)(?=KEY POINT 1:|$)/i);
  if (mainConceptMatch) {
    blueprint.mainConcept = {
      title: mainConceptMatch[1].trim(),
      description: mainConceptMatch[2].trim()
    };
  }

  // Extract key points
  const keyPointMatches = content.matchAll(/KEY POINT (\d+):\s*(.+?)\n([\s\S]*?)(?=KEY POINT \d+:|---|\nTHE MEMORABLE|$)/gi);
  for (const match of keyPointMatches) {
    blueprint.keyPoints.push({
      title: match[2].trim(),
      description: match[3].trim()
    });
  }

  // Extract framework
  const frameworkSection = content.match(/THE MEMORABLE FRAMEWORK[\s\S]*?(?=---|\nSTORY)/i)?.[0] || '';
  const frameworkNameMatch = frameworkSection.match(/Framework Name:\s*(.+)/i);
  if (frameworkNameMatch) blueprint.framework.name = frameworkNameMatch[1].trim();
  
  const componentMatches = frameworkSection.matchAll(/^-\s*(.+?):\s*(.+)$/gm);
  for (const match of componentMatches) {
    blueprint.framework.components.push({
      name: match[1].trim(),
      description: match[2].trim()
    });
  }

  // Extract story
  const storySection = content.match(/STORY\/EXAMPLE[\s\S]*?(?=---|\nCOMMON MISTAKES)/i)?.[0] || '';
  const setupMatch = storySection.match(/SETUP:\s*(.+)/i);
  const conflictMatch = storySection.match(/CONFLICT:\s*(.+)/i);
  const resolutionMatch = storySection.match(/RESOLUTION:\s*(.+)/i);
  const lessonMatch = storySection.match(/LESSON:\s*(.+)/i);
  if (setupMatch) blueprint.story.setup = setupMatch[1].trim();
  if (conflictMatch) blueprint.story.conflict = conflictMatch[1].trim();
  if (resolutionMatch) blueprint.story.resolution = resolutionMatch[1].trim();
  if (lessonMatch) blueprint.story.lesson = lessonMatch[1].trim();

  // Extract mistakes
  const mistakesSection = content.match(/COMMON MISTAKES[\s\S]*?(?=---|\nQUOTABLE)/i)?.[0] || '';
  const mistakeMatches = mistakesSection.matchAll(/MISTAKE \d+:\s*(.+?)\nWHY IT FAILS:\s*(.+?)\nINSTEAD:\s*(.+?)(?=\n\nMISTAKE|\n---|\n\nQUOTABLE|$)/gis);
  for (const match of mistakeMatches) {
    blueprint.mistakes.push({
      mistake: match[1].trim(),
      whyFails: match[2].trim(),
      instead: match[3].trim()
    });
  }

  // Extract quotes
  const quotesSection = content.match(/QUOTABLE MOMENTS[\s\S]*?(?=---|\nVISUAL AIDS)/i)?.[0] || '';
  const quoteMatches = quotesSection.matchAll(/[•"]\s*"?([^"•\n]+)"?/g);
  for (const match of quoteMatches) {
    const quote = match[1].trim().replace(/^"|"$/g, '');
    if (quote.length > 10) blueprint.quotes.push(quote);
  }

  // Extract visuals
  const visualsSection = content.match(/VISUAL AIDS[\s\S]*?(?=---|\nCALL TO ACTION)/i)?.[0] || '';
  const visualMatches = visualsSection.matchAll(/[•-]\s*(.+)/g);
  for (const match of visualMatches) {
    blueprint.visuals.push(match[1].trim());
  }

  // Extract CTA
  const ctaSection = content.match(/CALL TO ACTION[\s\S]*?(?=---|\n90-DAY)/i)?.[0] || '';
  const primaryMatch = ctaSection.match(/PRIMARY CTA:\s*(.+)/i);
  const accountabilityMatch = ctaSection.match(/ACCOUNTABILITY PROMPT:\s*(.+)/i);
  if (primaryMatch) blueprint.cta.primary = primaryMatch[1].trim();
  if (accountabilityMatch) blueprint.cta.accountability = accountabilityMatch[1].trim();

  // Extract metric
  const metricSection = content.match(/90-DAY IMPLEMENTATION[\s\S]*?(?=---|\nSTANDARD PLAYBOOK)/i)?.[0] || '';
  const metricMatch = metricSection.match(/METRIC:\s*(.+)/i);
  const baselineMatch = metricSection.match(/BASELINE:\s*(.+)/i);
  const targetMatch = metricSection.match(/TARGET:\s*(.+)/i);
  const trackMatch = metricSection.match(/HOW TO TRACK:\s*(.+)/i);
  if (metricMatch) blueprint.metric.metric = metricMatch[1].trim();
  if (baselineMatch) blueprint.metric.baseline = baselineMatch[1].trim();
  if (targetMatch) blueprint.metric.target = targetMatch[1].trim();
  if (trackMatch) blueprint.metric.howToTrack = trackMatch[1].trim();

  // Extract placement
  const placementSection = content.match(/STANDARD PLAYBOOK PLACEMENT[\s\S]*/i)?.[0] || '';
  const moduleMatch = placementSection.match(/MODULE SUGGESTION:\s*(.+)/i);
  const prereqMatch = placementSection.match(/PREREQUISITE:\s*(.+)/i);
  const followMatch = placementSection.match(/FOLLOW-UP:\s*(.+)/i);
  if (moduleMatch) blueprint.placement.module = moduleMatch[1].trim();
  if (prereqMatch) blueprint.placement.prerequisite = prereqMatch[1].trim();
  if (followMatch) blueprint.placement.followUp = followMatch[1].trim();

  return blueprint;
}

// Colors
const COLORS = {
  background: '#0f172a',
  cardBg: '#1e293b',
  border: '#334155',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  primary: '#6366f1',
  primaryBg: 'rgba(99, 102, 241, 0.1)',
  hook: '#f43f5e',
  hookBg: 'rgba(244, 63, 94, 0.1)',
  framework: '#8b5cf6',
  frameworkBg: 'rgba(139, 92, 246, 0.1)',
  story: '#06b6d4',
  storyBg: 'rgba(6, 182, 212, 0.1)',
  warning: '#f59e0b',
  warningBg: 'rgba(245, 158, 11, 0.1)',
  success: '#22c55e',
  successBg: 'rgba(34, 197, 94, 0.1)',
  quote: '#ec4899',
  quoteBg: 'rgba(236, 72, 153, 0.1)',
};

const categoryColors: Record<string, string> = {
  'Sales Mastery': '#3b82f6',
  'Service Excellence': '#22c55e',
  'Leadership': '#8b5cf6',
  'Mindset': '#f59e0b',
  'Operations': '#64748b',
  'Recruiting': '#06b6d4',
  'Culture': '#ec4899',
};

export function LeaderBlueprintReportCard({ module, open, onClose }: LeaderBlueprintReportCardProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  
  const blueprint = parseLeaderContent(module.content);
  
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });

  const copyContent = () => {
    navigator.clipboard.writeText(module.content);
    toast.success('Copied to clipboard!');
  };

  const exportAsPNG = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(reportRef.current, {
        backgroundColor: COLORS.background,
        pixelRatio: 2,
      });
      
      const link = document.createElement('a');
      link.download = `training-blueprint-${blueprint.topic.toLowerCase().replace(/\s+/g, '-') || 'module'}-${formatDate(module.created_at)}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Downloaded as PNG!');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const categoryColor = categoryColors[blueprint.category] || COLORS.primary;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 bg-slate-900 border-slate-700">
        {/* Header Actions */}
        <div style={{ 
          position: 'sticky', 
          top: 0, 
          zIndex: 10, 
          background: COLORS.background, 
          padding: '16px 20px', 
          borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Badge variant="outline" style={{ background: COLORS.primaryBg, borderColor: COLORS.primary, color: COLORS.primary }}>
            Training Blueprint
          </Badge>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="outline" size="sm" onClick={copyContent} className="gap-1">
              <Copy className="h-3 w-3" />
              Copy
            </Button>
            <Button variant="outline" size="sm" onClick={exportAsPNG} disabled={exporting} className="gap-1">
              <FileImage className="h-3 w-3" />
              {exporting ? 'Exporting...' : 'PNG'}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onClose()}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Report Content */}
        <div ref={reportRef} style={{ background: COLORS.background, padding: '24px', minHeight: '100%' }}>
          {/* Export Branding Header */}
          <ExportBrandingHeader />
          
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
              {blueprint.category && (
                <span style={{ 
                  padding: '4px 12px', 
                  borderRadius: '9999px', 
                  fontSize: '12px', 
                  fontWeight: 600,
                  background: `${categoryColor}20`,
                  color: categoryColor,
                  border: `1px solid ${categoryColor}40`
                }}>
                  {blueprint.category}
                </span>
              )}
              {blueprint.targetAudience && (
                <span style={{ 
                  padding: '4px 12px', 
                  borderRadius: '9999px', 
                  fontSize: '12px',
                  background: COLORS.cardBg,
                  color: COLORS.textMuted,
                  border: `1px solid ${COLORS.border}`
                }}>
                  {blueprint.targetAudience}
                </span>
              )}
              {blueprint.videoLength && (
                <span style={{ 
                  padding: '4px 12px', 
                  borderRadius: '9999px', 
                  fontSize: '12px',
                  background: COLORS.cardBg,
                  color: COLORS.textMuted,
                  border: `1px solid ${COLORS.border}`
                }}>
                  ⏱️ {blueprint.videoLength}
                </span>
              )}
            </div>
            <h1 style={{ 
              fontSize: '28px', 
              fontWeight: 700, 
              color: COLORS.text, 
              marginBottom: '8px',
              lineHeight: 1.2
            }}>
              {blueprint.topic || module.title}
            </h1>
            <p style={{ fontSize: '14px', color: COLORS.textMuted }}>
              Training Video Blueprint • {formatDate(module.created_at)}
            </p>
          </div>

          {/* THE HOOK */}
          {blueprint.hook && (
            <div style={{ 
              background: COLORS.hookBg, 
              border: `1px solid ${COLORS.hook}40`, 
              borderRadius: '12px', 
              padding: '20px', 
              marginBottom: '20px' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '8px', 
                  background: COLORS.hook, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '16px'
                }}>
                  🎬
                </div>
                <span style={{ color: COLORS.hook, fontWeight: 600, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  The Hook (First 30 Seconds)
                </span>
              </div>
              <p style={{ 
                color: COLORS.text, 
                fontSize: '16px', 
                fontStyle: 'italic', 
                lineHeight: 1.6,
                margin: 0
              }}>
                "{blueprint.hook}"
              </p>
            </div>
          )}

          {/* CORE TEACHING */}
          <div style={{ 
            background: COLORS.cardBg, 
            border: `1px solid ${COLORS.border}`, 
            borderRadius: '12px', 
            padding: '20px', 
            marginBottom: '20px' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '8px', 
                background: COLORS.primary, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center'
              }}>
                <Target className="h-4 w-4" style={{ color: 'white' }} />
              </div>
              <span style={{ color: COLORS.text, fontWeight: 600, fontSize: '16px' }}>
                Core Teaching Framework
              </span>
            </div>

            {/* Main Concept */}
            {blueprint.mainConcept.title && (
              <div style={{ 
                background: COLORS.primaryBg, 
                borderRadius: '8px', 
                padding: '16px', 
                marginBottom: '16px',
                borderLeft: `3px solid ${COLORS.primary}`
              }}>
                <h3 style={{ color: COLORS.primary, fontWeight: 600, fontSize: '16px', marginBottom: '8px' }}>
                  {blueprint.mainConcept.title}
                </h3>
                <p style={{ color: COLORS.text, fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                  {blueprint.mainConcept.description}
                </p>
              </div>
            )}

            {/* Key Points Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {blueprint.keyPoints.map((point, i) => (
                <div key={i} style={{ 
                  background: COLORS.background, 
                  borderRadius: '8px', 
                  padding: '14px',
                  border: `1px solid ${COLORS.border}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ 
                      width: '22px', 
                      height: '22px', 
                      borderRadius: '50%', 
                      background: COLORS.primary, 
                      color: 'white', 
                      fontSize: '12px', 
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {i + 1}
                    </span>
                    <span style={{ color: COLORS.text, fontWeight: 600, fontSize: '14px' }}>
                      {point.title}
                    </span>
                  </div>
                  <p style={{ color: COLORS.textMuted, fontSize: '13px', lineHeight: 1.5, margin: 0 }}>
                    {point.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* TWO COLUMN LAYOUT */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            
            {/* FRAMEWORK */}
            {blueprint.framework.name && (
              <div style={{ 
                background: COLORS.frameworkBg, 
                border: `1px solid ${COLORS.framework}40`, 
                borderRadius: '12px', 
                padding: '16px' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ 
                    width: '28px', 
                    height: '28px', 
                    borderRadius: '6px', 
                    background: COLORS.framework, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center'
                  }}>
                    <Lightbulb className="h-4 w-4" style={{ color: 'white' }} />
                  </div>
                  <span style={{ color: COLORS.framework, fontWeight: 600, fontSize: '13px', textTransform: 'uppercase' }}>
                    Memorable Framework
                  </span>
                </div>
                <div style={{ 
                  background: 'rgba(0,0,0,0.2)', 
                  borderRadius: '6px', 
                  padding: '10px', 
                  marginBottom: '10px' 
                }}>
                  <span style={{ color: COLORS.text, fontWeight: 700, fontSize: '15px' }}>
                    {blueprint.framework.name}
                  </span>
                </div>
                {blueprint.framework.components.map((comp, i) => (
                  <p key={i} style={{ color: COLORS.text, fontSize: '13px', margin: '6px 0', lineHeight: 1.4 }}>
                    <strong style={{ color: COLORS.framework }}>{comp.name}:</strong>{' '}
                    {comp.description}
                  </p>
                ))}
              </div>
            )}

            {/* STORY */}
            {blueprint.story.setup && (
              <div style={{ 
                background: COLORS.storyBg, 
                border: `1px solid ${COLORS.story}40`, 
                borderRadius: '12px', 
                padding: '16px' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ 
                    width: '28px', 
                    height: '28px', 
                    borderRadius: '6px', 
                    background: COLORS.story, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontSize: '14px'
                  }}>
                    📖
                  </div>
                  <span style={{ color: COLORS.story, fontWeight: 600, fontSize: '13px', textTransform: 'uppercase' }}>
                    Story to Include
                  </span>
                </div>
                <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
                  <p style={{ color: COLORS.text, margin: '4px 0' }}><strong>Setup:</strong> {blueprint.story.setup}</p>
                  <p style={{ color: COLORS.text, margin: '4px 0' }}><strong>Conflict:</strong> {blueprint.story.conflict}</p>
                  <p style={{ color: COLORS.text, margin: '4px 0' }}><strong>Resolution:</strong> {blueprint.story.resolution}</p>
                  <p style={{ 
                    color: COLORS.story, 
                    margin: '8px 0 0 0', 
                    fontWeight: 600,
                    background: 'rgba(0,0,0,0.2)',
                    padding: '8px',
                    borderRadius: '4px'
                  }}>
                    💡 Lesson: {blueprint.story.lesson}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* COMMON MISTAKES */}
          {blueprint.mistakes.length > 0 && (
            <div style={{ 
              background: COLORS.warningBg, 
              border: `1px solid ${COLORS.warning}40`, 
              borderRadius: '12px', 
              padding: '16px', 
              marginBottom: '20px' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ 
                  width: '28px', 
                  height: '28px', 
                  borderRadius: '6px', 
                  background: COLORS.warning, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center'
                }}>
                  <AlertTriangle className="h-4 w-4" style={{ color: 'white' }} />
                </div>
                <span style={{ color: COLORS.warning, fontWeight: 600, fontSize: '13px', textTransform: 'uppercase' }}>
                  Common Mistakes to Address
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {blueprint.mistakes.map((m, i) => (
                  <div key={i} style={{ 
                    background: 'rgba(0,0,0,0.2)', 
                    borderRadius: '8px', 
                    padding: '12px',
                    fontSize: '13px'
                  }}>
                    <p style={{ color: '#f87171', fontWeight: 600, margin: '0 0 6px 0' }}>
                      ❌ {m.mistake}
                    </p>
                    <p style={{ color: COLORS.textMuted, margin: '0 0 6px 0', fontSize: '12px' }}>
                      Why it fails: {m.whyFails}
                    </p>
                    <p style={{ color: COLORS.success, margin: 0, fontSize: '12px' }}>
                      ✓ Instead: {m.instead}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* QUOTABLES + VISUALS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            
            {/* Quotes */}
            {blueprint.quotes.length > 0 && (
              <div style={{ 
                background: COLORS.quoteBg, 
                border: `1px solid ${COLORS.quote}40`, 
                borderRadius: '12px', 
                padding: '16px' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ 
                    width: '28px', 
                    height: '28px', 
                    borderRadius: '6px', 
                    background: COLORS.quote, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center'
                  }}>
                    <Quote className="h-4 w-4" style={{ color: 'white' }} />
                  </div>
                  <span style={{ color: COLORS.quote, fontWeight: 600, fontSize: '13px', textTransform: 'uppercase' }}>
                    Quotable Moments
                  </span>
                </div>
                {blueprint.quotes.map((q, i) => (
                  <div key={i} style={{ 
                    background: 'rgba(0,0,0,0.2)', 
                    borderRadius: '6px', 
                    padding: '10px', 
                    marginBottom: '8px' 
                  }}>
                    <p style={{ color: COLORS.text, fontSize: '13px', fontStyle: 'italic', margin: 0 }}>
                      "{q}"
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Visuals */}
            {blueprint.visuals.length > 0 && (
              <div style={{ 
                background: COLORS.cardBg, 
                border: `1px solid ${COLORS.border}`, 
                borderRadius: '12px', 
                padding: '16px' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ 
                    width: '28px', 
                    height: '28px', 
                    borderRadius: '6px', 
                    background: COLORS.primary, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center'
                  }}>
                    <Eye className="h-4 w-4" style={{ color: 'white' }} />
                  </div>
                  <span style={{ color: COLORS.text, fontWeight: 600, fontSize: '13px', textTransform: 'uppercase' }}>
                    Visual Aids
                  </span>
                </div>
                {blueprint.visuals.map((v, i) => (
                  <p key={i} style={{ 
                    color: COLORS.textMuted, 
                    fontSize: '13px', 
                    margin: '6px 0',
                    paddingLeft: '12px',
                    borderLeft: `2px solid ${COLORS.border}`
                  }}>
                    {v}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* CTA + METRIC + PLACEMENT */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
            
            {/* CTA */}
            <div style={{ 
              background: COLORS.successBg, 
              border: `1px solid ${COLORS.success}40`, 
              borderRadius: '12px', 
              padding: '14px' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <Rocket className="h-4 w-4" style={{ color: COLORS.success }} />
                <span style={{ color: COLORS.success, fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>
                  Call to Action
                </span>
              </div>
              {blueprint.cta.primary && (
                <p style={{ color: COLORS.text, fontSize: '13px', fontWeight: 600, margin: '0 0 6px 0' }}>
                  {blueprint.cta.primary}
                </p>
              )}
              {blueprint.cta.accountability && (
                <p style={{ color: COLORS.textMuted, fontSize: '12px', margin: 0, fontStyle: 'italic' }}>
                  {blueprint.cta.accountability}
                </p>
              )}
            </div>

            {/* Metric */}
            <div style={{ 
              background: COLORS.cardBg, 
              border: `1px solid ${COLORS.border}`, 
              borderRadius: '12px', 
              padding: '14px' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <BarChart3 className="h-4 w-4" style={{ color: COLORS.primary }} />
                <span style={{ color: COLORS.primary, fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>
                  90-Day Metric
                </span>
              </div>
              {blueprint.metric.metric && (
                <p style={{ color: COLORS.text, fontSize: '13px', fontWeight: 600, margin: '0 0 6px 0' }}>
                  {blueprint.metric.metric}
                </p>
              )}
              <div style={{ fontSize: '11px' }}>
                {blueprint.metric.baseline && <p style={{ color: COLORS.textMuted, margin: '2px 0' }}>📍 Baseline: {blueprint.metric.baseline}</p>}
                {blueprint.metric.target && <p style={{ color: COLORS.success, margin: '2px 0' }}>🎯 Target: {blueprint.metric.target}</p>}
              </div>
            </div>

            {/* Placement */}
            <div style={{ 
              background: COLORS.cardBg, 
              border: `1px solid ${COLORS.border}`, 
              borderRadius: '12px', 
              padding: '14px' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <FolderOpen className="h-4 w-4" style={{ color: COLORS.textMuted }} />
                <span style={{ color: COLORS.textMuted, fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>
                  Playbook Placement
                </span>
              </div>
              {blueprint.placement.module && (
                <p style={{ color: COLORS.text, fontSize: '13px', fontWeight: 600, margin: '0 0 4px 0' }}>
                  📁 {blueprint.placement.module}
                </p>
              )}
              {blueprint.placement.prerequisite && (
                <p style={{ color: COLORS.textMuted, fontSize: '11px', margin: '2px 0' }}>
                  ← Prereq: {blueprint.placement.prerequisite}
                </p>
              )}
              {blueprint.placement.followUp && (
                <p style={{ color: COLORS.textMuted, fontSize: '11px', margin: '2px 0' }}>
                  → Next: {blueprint.placement.followUp}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{ 
            borderTop: `1px solid ${COLORS.border}`, 
            paddingTop: '16px', 
            textAlign: 'center' 
          }}>
            <p style={{ color: COLORS.textMuted, fontSize: '11px', letterSpacing: '1px', margin: 0 }}>
              AGENCY BRAIN • TRAINING VIDEO BLUEPRINT • {formatDate(module.created_at).toUpperCase()}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
