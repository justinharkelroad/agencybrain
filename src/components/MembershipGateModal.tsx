import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, Play, ArrowLeft, Sparkles, Crown, Clock } from "lucide-react";
import { VideoEmbed } from "@/components/training/VideoEmbed";
import { supabase } from "@/integrations/supabase/client";

interface MembershipGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName: string;
  featureDescription?: string;
  videoKey?: string;
  gateType?: 'one_on_one' | 'call_scoring_upsell' | 'coming_soon';
  returnPath?: string;
}

export function MembershipGateModal({ 
  open, 
  onOpenChange, 
  featureName,
  featureDescription,
  videoKey,
  gateType = 'one_on_one',
  returnPath
}: MembershipGateModalProps) {
  const navigate = useNavigate();
  const [showVideo, setShowVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Fetch video URL from help_videos table if videoKey is provided
  useEffect(() => {
    if (!videoKey) return;
    
    const fetchVideo = async () => {
      const { data } = await supabase
        .from('help_videos')
        .select('url')
        .eq('video_key', videoKey)
        .eq('is_active', true)
        .maybeSingle();
      
      if (data?.url && data.url.trim() !== '') {
        setVideoUrl(data.url);
      }
    };
    fetchVideo();
  }, [videoKey]);

  const handleGoBack = () => {
    onOpenChange(false);
    if (returnPath) {
      navigate(returnPath);
    }
  };

  const isCallScoringUpsell = gateType === 'call_scoring_upsell';
  const isComingSoon = gateType === 'coming_soon';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isComingSoon ? (
              <Clock className="h-5 w-5 text-blue-500" />
            ) : isCallScoringUpsell ? (
              <Crown className="h-5 w-5 text-amber-500" />
            ) : (
              <Lock className="h-5 w-5 text-muted-foreground" />
            )}
            {isComingSoon ? 'Coming Soon' : isCallScoringUpsell ? featureName : '1:1 Coaching Feature'}
          </DialogTitle>
          <DialogDescription>
            {featureDescription || (
              isComingSoon
                ? `${featureName} is coming soon! We're putting the finishing touches on this exciting new feature.`
                : isCallScoringUpsell
                  ? `${featureName} is available with a full Agency Brain membership.`
                  : `${featureName} is available exclusively for 1:1 Coaching members.`
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Coming Soon Card */}
          {isComingSoon && (
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 mt-0.5 text-blue-500" />
                  <div className="space-y-1">
                    <p className="font-medium text-sm">
                      Get Ready!
                    </p>
                    <p className="text-xs text-muted-foreground">
                      We'll notify you as soon as {featureName} is available. Stay tuned for updates!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Video Preview Section - only show if videoKey provided and video exists */}
          {!isComingSoon && videoKey && videoUrl && (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {showVideo ? (
                  <VideoEmbed url={videoUrl} className="rounded-lg" />
                ) : (
                  <button
                    onClick={() => setShowVideo(true)}
                    className="w-full aspect-video rounded-lg bg-black/30 flex flex-col items-center justify-center gap-3 hover:bg-black/40 transition-colors"
                  >
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                      <Play className="h-8 w-8 text-primary fill-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground">Watch feature preview</span>
                  </button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Upgrade Benefits Card - not shown for coming soon */}
          {!isComingSoon && (
            <Card className={isCallScoringUpsell ? "border-amber-500/30 bg-amber-500/5" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className={`h-5 w-5 mt-0.5 ${isCallScoringUpsell ? "text-amber-500" : "text-primary"}`} />
                  <div className="space-y-1">
                    <p className="font-medium text-sm">
                      {isCallScoringUpsell ? 'Unlock Full Platform Access' : 'Upgrade to 1:1 Coaching'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isCallScoringUpsell
                        ? 'Get access to Dashboard, Training, ROI Tools, Personal Growth features, The Exchange community, and more.'
                        : 'Contact us to upgrade your membership and unlock this feature.'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-2">
          {returnPath && !isComingSoon && (
            <Button variant="outline" onClick={handleGoBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          )}
          {isComingSoon ? (
            <Button
              className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
              onClick={() => onOpenChange(false)}
            >
              Got It
            </Button>
          ) : (
            <>
              <Button
                className={isCallScoringUpsell ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600" : ""}
                onClick={() => {
                  if (!returnPath) {
                    onOpenChange(false);
                  } else {
                    window.open('mailto:support@standardplaybook.com?subject=Agency Brain Upgrade Inquiry', '_blank');
                  }
                }}
              >
                {returnPath ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Contact to Upgrade
                  </>
                ) : (
                  'Close'
                )}
              </Button>
              {!returnPath && (
                <Button
                  onClick={() => window.open('mailto:support@standardplaybook.com?subject=1:1 Coaching Upgrade Inquiry', '_blank')}
                >
                  Contact Us
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
