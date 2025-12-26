import { useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, X, FileImage } from "lucide-react";
import { toast } from "sonner";

interface LearningCycleReportCardProps {
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

// Parse the structured content from Gemini
function parseContent(content: string) {
  const sections = {
    topic: '',
    train: { concepts: [] as { title: string; description: string }[], takeaway: '' },
    typeText: { instruction: '', capturing: '' },
    talk: { opener: '', focus: '', questions: [] as string[] },
    teach: { standDeliver: '', prompt: '', actionCommitment: '', examples: [] as string[] }
  };

  // Extract topic
  const topicMatch = content.match(/TOPIC:\s*(.+)/i);
  if (topicMatch) sections.topic = topicMatch[1].trim();

  // Extract TRAIN section
  const trainSection = content.match(/STEP 1: TRAIN[\s\S]*?(?=STEP 2:|$)/i)?.[0] || '';
  
  const conceptMatches = trainSection.matchAll(/KEY CONCEPT \d+:\s*(.+?)\n([\s\S]*?)(?=KEY CONCEPT|CORE TAKEAWAY|$)/gi);
  for (const match of conceptMatches) {
    sections.train.concepts.push({
      title: match[1].trim(),
      description: match[2].trim()
    });
  }
  
  const takeawayMatch = trainSection.match(/CORE TAKEAWAY:\s*(.+)/i);
  if (takeawayMatch) sections.train.takeaway = takeawayMatch[1].trim();

  // Extract TYPE/TEXT section
  const typeSection = content.match(/STEP 2: TYPE\/TEXT[\s\S]*?(?=STEP 3:|$)/i)?.[0] || '';
  const instructionMatch = typeSection.match(/INSTRUCTION FOR TEAM:\s*([\s\S]*?)(?=WHAT THEY'RE CAPTURING:|$)/i);
  if (instructionMatch) sections.typeText.instruction = instructionMatch[1].trim();
  const capturingMatch = typeSection.match(/WHAT THEY'RE CAPTURING:\s*([\s\S]*?)$/i);
  if (capturingMatch) sections.typeText.capturing = capturingMatch[1].trim();

  // Extract TALK section
  const talkSection = content.match(/STEP 3: TALK[\s\S]*?(?=STEP 4:|$)/i)?.[0] || '';
  const openerMatch = talkSection.match(/FACILITATOR OPENS WITH:\s*"?([^"]+)"?/i);
  if (openerMatch) sections.talk.opener = openerMatch[1].trim();
  const focusMatch = talkSection.match(/DISCUSSION FOCUS:\s*([\s\S]*?)(?=FOLLOW-UP QUESTIONS:|$)/i);
  if (focusMatch) sections.talk.focus = focusMatch[1].trim();
  const questionsMatch = talkSection.match(/FOLLOW-UP QUESTIONS:\s*([\s\S]*?)$/i);
  if (questionsMatch) {
    sections.talk.questions = questionsMatch[1]
      .split('\n')
      .filter(q => q.trim().startsWith('-'))
      .map(q => q.replace(/^-\s*/, '').trim());
  }

  // Extract TEACH section
  const teachSection = content.match(/STEP 4: TEACH[\s\S]*/i)?.[0] || '';
  const standMatch = teachSection.match(/STAND & DELIVER:\s*([\s\S]*?)(?=PROMPT FOR TEACHER:|$)/i);
  if (standMatch) sections.teach.standDeliver = standMatch[1].trim();
  const promptMatch = teachSection.match(/PROMPT FOR TEACHER:\s*"?([^"]+)"?/i);
  if (promptMatch) sections.teach.prompt = promptMatch[1].trim();
  const actionMatch = teachSection.match(/ACTION COMMITMENT:\s*([\s\S]*?)(?=EXAMPLE COMMITMENTS:|$)/i);
  if (actionMatch) sections.teach.actionCommitment = actionMatch[1].trim();
  const examplesMatch = teachSection.match(/EXAMPLE COMMITMENTS:\s*([\s\S]*?)$/i);
  if (examplesMatch) {
    sections.teach.examples = examplesMatch[1]
      .split('\n')
      .filter(e => e.trim().startsWith('-'))
      .map(e => e.replace(/^-\s*/, '').trim());
  }

  return sections;
}

// Colors matching Agency Brain theme
const COLORS = {
  background: '#0f172a',
  cardBg: '#1e293b',
  border: '#334155',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  train: '#3b82f6',
  trainBg: 'rgba(59, 130, 246, 0.1)',
  typeText: '#8b5cf6',
  typeTextBg: 'rgba(139, 92, 246, 0.1)',
  talk: '#f59e0b',
  talkBg: 'rgba(245, 158, 11, 0.1)',
  teach: '#22c55e',
  teachBg: 'rgba(34, 197, 94, 0.1)',
};

// Curved Arrow SVG Component
const CurvedArrow = ({ 
  direction, 
  color 
}: { 
  direction: 'right' | 'down' | 'left' | 'up';
  color: string;
}) => {
  const paths = {
    right: "M 5 25 Q 25 25 45 25 Q 55 25 55 35 L 55 45",
    down: "M 25 5 Q 25 25 25 45 Q 25 55 35 55 L 45 55",
    left: "M 55 25 Q 35 25 15 25 Q 5 25 5 35 L 5 45",
    up: "M 25 55 Q 25 35 25 15 Q 25 5 15 5 L 5 5",
  };
  
  const arrowHeads = {
    right: "M 50 45 L 55 55 L 60 45",
    down: "M 40 50 L 50 55 L 40 60",
    left: "M 10 45 L 5 55 L 0 45",
    up: "M 10 10 L 5 0 L 0 10",
  };

  return (
    <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
      <path d={paths[direction]} stroke={color} strokeWidth="2" strokeDasharray="4 4" fill="none" />
      <path d={arrowHeads[direction]} stroke={color} strokeWidth="2" fill="none" />
    </svg>
  );
};

export function LearningCycleReportCard({ module, open, onClose }: LearningCycleReportCardProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  
  const sections = parseContent(module.content);
  
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
      link.download = `learning-cycle-${sections.topic.toLowerCase().replace(/\s+/g, '-') || 'huddle'}-${formatDate(module.created_at)}.png`;
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

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0" style={{ backgroundColor: COLORS.background }}>
        {/* Header Actions */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '16px 24px',
          borderBottom: `1px solid ${COLORS.border}`
        }}>
          <Badge style={{ backgroundColor: module.role === 'leader' ? COLORS.typeText : COLORS.train, color: 'white' }}>
            {module.role === 'leader' ? 'Leader Playbook' : 'Team Framework'}
          </Badge>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Button variant="outline" size="sm" onClick={copyContent} style={{ borderColor: COLORS.border, color: COLORS.text }}>
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
            <Button variant="outline" size="sm" onClick={exportAsPNG} disabled={exporting} style={{ borderColor: COLORS.border, color: COLORS.text }}>
              <FileImage className="h-4 w-4 mr-2" />
              {exporting ? 'Exporting...' : 'PNG'}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onClose()} style={{ color: COLORS.textMuted }}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Report Card Content */}
        <div ref={reportRef} style={{ padding: '32px', backgroundColor: COLORS.background }}>
          {/* Title Header */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <p style={{ 
              fontSize: '12px', 
              letterSpacing: '0.2em', 
              color: COLORS.textMuted, 
              textTransform: 'uppercase',
              marginBottom: '8px'
            }}>
              The Standard Playbook
            </p>
            <h1 style={{ 
              fontSize: '28px', 
              fontWeight: 'bold', 
              color: COLORS.text,
              marginBottom: '8px'
            }}>
              {sections.topic || module.title}
            </h1>
            <p style={{ fontSize: '14px', color: COLORS.textMuted }}>
              Learning Cycle Huddle • {formatDate(module.created_at)}
            </p>
          </div>

          {/* CYCLE LAYOUT */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* ===== TRAIN (TOP) ===== */}
            <div style={{ 
              backgroundColor: COLORS.trainBg, 
              border: `1px solid ${COLORS.train}`, 
              borderRadius: '12px', 
              padding: '20px' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ 
                  width: '36px', 
                  height: '36px', 
                  borderRadius: '50%', 
                  backgroundColor: COLORS.train, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  boxShadow: `0 0 20px ${COLORS.train}40`
                }}>
                  <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>1</span>
                </div>
                <div>
                  <h3 style={{ color: COLORS.train, fontWeight: 'bold', fontSize: '18px', margin: 0 }}>TRAIN</h3>
                  <p style={{ color: COLORS.textMuted, fontSize: '12px', margin: 0 }}>The Knowledge Transfer</p>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sections.train.concepts.map((concept, i) => (
                  <div key={i} style={{ 
                    backgroundColor: COLORS.cardBg, 
                    borderRadius: '8px', 
                    padding: '12px' 
                  }}>
                    <h4 style={{ color: COLORS.text, fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>
                      {concept.title}
                    </h4>
                    <p style={{ color: COLORS.textMuted, fontSize: '13px', margin: 0, lineHeight: '1.5' }}>
                      {concept.description}
                    </p>
                  </div>
                ))}
              </div>
              
              {sections.train.takeaway && (
                <div style={{ 
                  marginTop: '16px', 
                  padding: '12px', 
                  backgroundColor: `${COLORS.train}20`, 
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px'
                }}>
                  <span>💡</span>
                  <p style={{ color: COLORS.text, fontSize: '14px', fontWeight: '500', margin: 0 }}>
                    {sections.train.takeaway}
                  </p>
                </div>
              )}
            </div>

            {/* Arrow: Train → Type/Text */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginRight: '20%' }}>
              <svg width="80" height="40" viewBox="0 0 80 40" fill="none">
                <path d="M 10 5 Q 40 5 60 20 Q 70 28 70 35" stroke={COLORS.typeText} strokeWidth="2" strokeDasharray="4 4" fill="none" />
                <path d="M 65 30 L 70 40 L 75 30" stroke={COLORS.typeText} strokeWidth="2" fill="none" />
              </svg>
            </div>

            {/* TYPE/TEXT (RIGHT SIDE) */}
            <div style={{ marginLeft: '20%' }}>
              <div style={{ 
                backgroundColor: COLORS.typeTextBg, 
                border: `1px solid ${COLORS.typeText}`, 
                borderRadius: '12px', 
                padding: '20px' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ 
                    width: '36px', 
                    height: '36px', 
                    borderRadius: '50%', 
                    backgroundColor: COLORS.typeText, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    boxShadow: `0 0 20px ${COLORS.typeText}40`
                  }}>
                    <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>2</span>
                  </div>
                  <div>
                    <h3 style={{ color: COLORS.typeText, fontWeight: 'bold', fontSize: '18px', margin: 0 }}>TYPE/TEXT</h3>
                    <p style={{ color: COLORS.textMuted, fontSize: '12px', margin: 0 }}>2-3 Min Reflection</p>
                  </div>
                </div>
                
                <div style={{ 
                  backgroundColor: COLORS.cardBg, 
                  borderRadius: '8px', 
                  padding: '12px',
                  marginBottom: '12px'
                }}>
                  <p style={{ color: COLORS.text, fontSize: '14px', margin: 0, lineHeight: '1.5' }}>
                    ✏️ {sections.typeText.instruction}
                  </p>
                </div>
                
                {sections.typeText.capturing && (
                  <p style={{ color: COLORS.textMuted, fontSize: '13px', margin: 0, fontStyle: 'italic' }}>
                    {sections.typeText.capturing}
                  </p>
                )}
              </div>
            </div>

            {/* Arrow: Type/Text → Talk */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <svg width="60" height="40" viewBox="0 0 60 40" fill="none">
                <path d="M 50 5 Q 30 20 30 35" stroke={COLORS.talk} strokeWidth="2" strokeDasharray="4 4" fill="none" />
                <path d="M 25 30 L 30 40 L 35 30" stroke={COLORS.talk} strokeWidth="2" fill="none" />
              </svg>
            </div>

            {/* ===== TALK (BOTTOM) ===== */}
            <div style={{ 
              backgroundColor: COLORS.talkBg, 
              border: `1px solid ${COLORS.talk}`, 
              borderRadius: '12px', 
              padding: '20px' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ 
                  width: '36px', 
                  height: '36px', 
                  borderRadius: '50%', 
                  backgroundColor: COLORS.talk, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  boxShadow: `0 0 20px ${COLORS.talk}40`
                }}>
                  <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>3</span>
                </div>
                <div>
                  <h3 style={{ color: COLORS.talk, fontWeight: 'bold', fontSize: '18px', margin: 0 }}>TALK</h3>
                  <p style={{ color: COLORS.textMuted, fontSize: '12px', margin: 0 }}>Team Discussion</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  {sections.talk.opener && (
                    <div style={{ marginBottom: '12px' }}>
                      <p style={{ color: COLORS.talk, fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>
                        Facilitator Opens With:
                      </p>
                      <p style={{ 
                        color: COLORS.text, 
                        fontSize: '14px', 
                        backgroundColor: COLORS.cardBg, 
                        padding: '12px', 
                        borderRadius: '8px',
                        margin: 0
                      }}>
                        🎯 "{sections.talk.opener}"
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <p style={{ color: COLORS.talk, fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>
                      Discussion Focus:
                    </p>
                    <p style={{ color: COLORS.textMuted, fontSize: '13px', margin: 0, lineHeight: '1.5' }}>
                      {sections.talk.focus || "Each team member shares what they're hearing or seeing for themselves - specifically how this applies to how they operate at the agency."}
                    </p>
                  </div>
                </div>
                
                <div>
                  {sections.talk.questions.length > 0 && (
                    <div>
                      <p style={{ color: COLORS.talk, fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>
                        Follow-Up Questions:
                      </p>
                      {sections.talk.questions.map((q, i) => (
                        <p key={i} style={{ 
                          color: COLORS.textMuted, 
                          fontSize: '13px', 
                          margin: '0 0 6px 0',
                          paddingLeft: '12px',
                          borderLeft: `2px solid ${COLORS.talk}40`
                        }}>
                          {q}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Arrow: Talk → Teach */}
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginLeft: '20%' }}>
              <svg width="80" height="40" viewBox="0 0 80 40" fill="none">
                <path d="M 70 5 Q 40 5 20 20 Q 10 28 10 35" stroke={COLORS.teach} strokeWidth="2" strokeDasharray="4 4" fill="none" />
                <path d="M 5 30 L 10 40 L 15 30" stroke={COLORS.teach} strokeWidth="2" fill="none" />
              </svg>
            </div>

            {/* ===== TEACH (LEFT SIDE) ===== */}
            <div style={{ marginRight: '20%' }}>
              <div style={{ 
                backgroundColor: COLORS.teachBg, 
                border: `1px solid ${COLORS.teach}`, 
                borderRadius: '12px', 
                padding: '20px' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ 
                    width: '36px', 
                    height: '36px', 
                    borderRadius: '50%', 
                    backgroundColor: COLORS.teach, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    boxShadow: `0 0 20px ${COLORS.teach}40`
                  }}>
                    <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>4</span>
                  </div>
                  <div>
                    <h3 style={{ color: COLORS.teach, fontWeight: 'bold', fontSize: '18px', margin: 0 }}>TEACH</h3>
                    <p style={{ color: COLORS.textMuted, fontSize: '12px', margin: 0 }}>Solidification</p>
                  </div>
                </div>
                
                <div style={{ 
                  backgroundColor: COLORS.cardBg, 
                  borderRadius: '8px', 
                  padding: '12px',
                  marginBottom: '12px'
                }}>
                  <p style={{ color: COLORS.teach, fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>
                    🎤 Stand & Deliver
                  </p>
                  <p style={{ color: COLORS.textMuted, fontSize: '13px', margin: 0, lineHeight: '1.5' }}>
                    {sections.teach.standDeliver || "Select one team member to stand and teach back the core concept to the group in their own words."}
                  </p>
                </div>
                
                {sections.teach.prompt && (
                  <p style={{ 
                    color: COLORS.text, 
                    fontSize: '13px', 
                    backgroundColor: `${COLORS.teach}20`,
                    padding: '10px',
                    borderRadius: '6px',
                    marginBottom: '12px'
                  }}>
                    💬 Prompt: "{sections.teach.prompt}"
                  </p>
                )}
                
                <div>
                  <p style={{ color: COLORS.teach, fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>
                    ✅ Action Commitment
                  </p>
                  <p style={{ 
                    color: COLORS.textMuted, 
                    fontSize: '13px', 
                    marginBottom: sections.teach.examples.length > 0 ? '10px' : '0',
                    lineHeight: '1.5'
                  }}>
                    {sections.teach.actionCommitment || 'Every team member states ONE specific action they will deploy. Not "I\'ll try to..." but "I will [action] by [time]."'}
                  </p>
                  {sections.teach.examples.length > 0 && (
                    <div style={{ paddingLeft: '12px', borderLeft: `2px solid ${COLORS.teach}40` }}>
                      <p style={{ color: COLORS.teach, fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>Examples:</p>
                      {sections.teach.examples.map((ex, i) => (
                        <p key={i} style={{ color: COLORS.textMuted, fontSize: '12px', margin: '0 0 4px 0' }}>• {ex}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Arrow: Teach → Train (completing the cycle) */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <svg width="120" height="50" viewBox="0 0 120 50" fill="none">
                <path d="M 20 45 Q 20 25 40 15 Q 60 5 80 5 Q 100 5 100 5" stroke={COLORS.train} strokeWidth="2" strokeDasharray="4 4" fill="none" />
                <path d="M 95 0 L 105 5 L 95 10" stroke={COLORS.train} strokeWidth="2" fill="none" />
              </svg>
            </div>

            {/* Center Cycle Label */}
            <div style={{ 
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none'
            }}>
              <div style={{ 
                backgroundColor: COLORS.cardBg, 
                border: `2px solid ${COLORS.border}`,
                borderRadius: '12px',
                padding: '12px 20px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
              }}>
                <p style={{ color: COLORS.textMuted, fontSize: '10px', letterSpacing: '0.15em', margin: 0 }}>Learning</p>
                <p style={{ color: COLORS.text, fontSize: '16px', fontWeight: 'bold', margin: 0 }}>CYCLE</p>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div style={{ 
            marginTop: '32px', 
            paddingTop: '16px', 
            borderTop: `1px solid ${COLORS.border}`,
            textAlign: 'center'
          }}>
            <p style={{ 
              color: COLORS.textMuted, 
              fontSize: '10px', 
              letterSpacing: '0.15em',
              margin: 0
            }}>
              AGENCY BRAIN • VIDEO TRAINING ARCHITECT • {formatDate(module.created_at).toUpperCase()}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
