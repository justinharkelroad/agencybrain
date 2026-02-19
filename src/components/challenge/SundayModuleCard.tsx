import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RatingScale } from './RatingScale';
import {
  Sun,
  Lock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { SundayModule, Core4Domain, SundayResponse } from '@/types/challenge-sunday';
import { CORE4_DOMAINS } from '@/types/challenge-sunday';
import { cn } from '@/lib/utils';

interface SundayModuleCardProps {
  module: SundayModule;
  assignmentId: string;
  sessionToken: string;
  onComplete: (response: SundayResponse) => void;
}

export function SundayModuleCard({
  module,
  assignmentId,
  sessionToken,
  onComplete,
}: SundayModuleCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state initialized from existing response or empty
  const [ratings, setRatings] = useState<Record<Core4Domain, number | null>>({
    body: module.response?.rating_body ?? null,
    being: module.response?.rating_being ?? null,
    balance: module.response?.rating_balance ?? null,
    business: module.response?.rating_business ?? null,
  });

  const [accomplished, setAccomplished] = useState<Record<Core4Domain, boolean | null>>({
    body: module.response?.accomplished_body ?? null,
    being: module.response?.accomplished_being ?? null,
    balance: module.response?.accomplished_balance ?? null,
    business: module.response?.accomplished_business ?? null,
  });

  const [commitments, setCommitments] = useState<Record<Core4Domain, string>>({
    body: module.response?.commitment_body || '',
    being: module.response?.commitment_being || '',
    balance: module.response?.commitment_balance || '',
    business: module.response?.commitment_business || '',
  });

  const [finalReflection, setFinalReflection] = useState(
    module.response?.final_reflection || ''
  );

  const isLocked = !module.is_unlocked;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('challenge-complete-sunday', {
        headers: { 'x-staff-session': sessionToken },
        body: {
          assignment_id: assignmentId,
          sunday_module_id: module.id,
          sunday_number: module.sunday_number,
          ...(module.has_rating_section && {
            rating_body: ratings.body,
            rating_being: ratings.being,
            rating_balance: ratings.balance,
            rating_business: ratings.business,
            accomplished_body: accomplished.body,
            accomplished_being: accomplished.being,
            accomplished_balance: accomplished.balance,
            accomplished_business: accomplished.business,
          }),
          ...(module.has_commitment_section && {
            commitment_body: commitments.body || null,
            commitment_being: commitments.being || null,
            commitment_balance: commitments.balance || null,
            commitment_business: commitments.business || null,
          }),
          ...(module.has_final_reflection && {
            final_reflection: finalReflection || null,
          }),
        },
      });

      if (error) throw error;

      toast.success('Sunday module saved!');
      onComplete(data.response);
    } catch (err) {
      console.error('Sunday submit error:', err);
      toast.error('Failed to save Sunday module');
    } finally {
      setSubmitting(false);
    }
  };

  const getVideoEmbedUrl = (url: string): string | null => {
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([a-zA-Z0-9]+))?/);
    if (vimeoMatch) {
      const hash = vimeoMatch[2] ? `?h=${vimeoMatch[2]}` : '';
      return `https://player.vimeo.com/video/${vimeoMatch[1]}${hash}`;
    }
    const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (youtubeMatch) return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    const loomMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
    if (loomMatch) return `https://www.loom.com/embed/${loomMatch[1]}`;
    return url;
  };

  return (
    <Card
      className={cn(
        'border-l-4 transition-colors',
        isLocked
          ? 'border-l-muted opacity-60'
          : module.is_completed
          ? 'border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/10'
          : 'border-l-amber-400'
      )}
    >
      <CardHeader
        className="cursor-pointer pb-3"
        onClick={() => !isLocked && setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'p-2 rounded-full',
                isLocked
                  ? 'bg-muted'
                  : module.is_completed
                  ? 'bg-amber-500/10'
                  : 'bg-amber-100 dark:bg-amber-900/30'
              )}
            >
              {isLocked ? (
                <Lock className="h-4 w-4 text-muted-foreground" />
              ) : module.is_completed ? (
                <CheckCircle2 className="h-4 w-4 text-amber-600" />
              ) : (
                <Sun className="h-4 w-4 text-amber-500" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{module.title}</CardTitle>
                <Badge
                  variant="outline"
                  className="text-xs border-amber-300 text-amber-700 dark:text-amber-400"
                >
                  Optional
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {module.sunday_number === 0
                  ? 'Set your weekly commitments'
                  : module.sunday_number === 6
                  ? 'Final reflection'
                  : 'Rate & recommit'}
              </p>
            </div>
          </div>
          {!isLocked && (
            <div className="text-muted-foreground">
              {expanded ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </div>
          )}
        </div>
      </CardHeader>

      {expanded && !isLocked && (
        <CardContent className="space-y-6 pt-0">
          {/* Blurb */}
          {module.blurb_html && (
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: module.blurb_html }}
            />
          )}

          {/* Video */}
          {module.video_url && (
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <iframe
                src={getVideoEmbedUrl(module.video_url) || ''}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {/* A. Rating Section (Sundays 1-6) */}
          {module.has_rating_section && (
            <div className="space-y-6">
              <h3 className="font-semibold text-sm text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                Rate Your Week
              </h3>
              {CORE4_DOMAINS.map(({ key, label, icon }) => (
                <div key={key} className="space-y-3 p-4 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2 font-medium">
                    <span>{icon}</span>
                    <span>{label}</span>
                  </div>

                  {/* Previous commitment (read-only) */}
                  {module.previous_commitments ? (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Your commitment: </span>
                      <span className="italic">
                        {module.previous_commitments[key] || 'No previous commitment set'}
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground italic">
                      No previous commitment set
                    </div>
                  )}

                  {/* Rating scale */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">
                      How did your week go?
                    </Label>
                    <RatingScale
                      value={ratings[key]}
                      onChange={(v) => setRatings((prev) => ({ ...prev, [key]: v }))}
                    />
                  </div>

                  {/* Accomplished? */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">
                      I ACCOMPLISHED THIS
                    </Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={accomplished[key] === true ? 'default' : 'outline'}
                        className={cn(
                          accomplished[key] === true &&
                            'bg-green-600 hover:bg-green-700 text-white'
                        )}
                        onClick={() =>
                          setAccomplished((prev) => ({ ...prev, [key]: true }))
                        }
                      >
                        YES
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={accomplished[key] === false ? 'default' : 'outline'}
                        className={cn(
                          accomplished[key] === false &&
                            'bg-red-600 hover:bg-red-700 text-white'
                        )}
                        onClick={() =>
                          setAccomplished((prev) => ({ ...prev, [key]: false }))
                        }
                      >
                        NO
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* B. Commitment Section (Sundays 0-5) */}
          {module.has_commitment_section && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                This Week&apos;s Commitments
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {CORE4_DOMAINS.map(({ key, label, icon }) => (
                  <div key={key} className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-sm font-medium">
                      <span>{icon}</span> {label}
                    </Label>
                    <Input
                      placeholder={`One specific ${label.toLowerCase()} commitment...`}
                      value={commitments[key]}
                      onChange={(e) =>
                        setCommitments((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* C. Final Reflection (Sunday 6) */}
          {module.has_final_reflection && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                Final Reflection
              </h3>
              {module.final_reflection_prompt && (
                <p className="text-sm text-muted-foreground italic">
                  {module.final_reflection_prompt}
                </p>
              )}
              <Textarea
                placeholder="Reflect on your 6-week journey..."
                value={finalReflection}
                onChange={(e) => setFinalReflection(e.target.value)}
                rows={6}
              />
            </div>
          )}

          {/* Submit */}
          <Button
            className="w-full bg-amber-500 hover:bg-amber-600 text-white"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : module.is_completed ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Update Response
              </>
            ) : (
              <>
                <Sun className="h-4 w-4 mr-2" />
                Submit
              </>
            )}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
