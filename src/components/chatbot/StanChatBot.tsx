import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { StanAvatar, StanVariant } from "./StanAvatar";
import { StanChatWindow } from "./StanChatWindow";
import { ChatMessageData } from "./ChatMessage";
import { ProactiveTipBubble } from "./ProactiveTipBubble";
import { cn } from "@/lib/utils";
import { useStanContext } from "@/hooks/useStanContext";
import { useProactiveTip } from "@/hooks/useProactiveTip";
import { supabase } from "@/integrations/supabase/client";

// Initial greeting message
const INITIAL_MESSAGE: ChatMessageData = {
  id: 'initial',
  role: 'stan',
  content: "Hey there! 👋 I'm Stan, your Agency Brain assistant. I'm here to help you navigate the platform and answer any questions. What can I help you with today?",
  timestamp: new Date(),
};

// Routes where Stan should NOT appear
const EXCLUDED_ROUTES = [
  '/auth',
  '/staff/login',
  '/staff/forgot-password',
  '/staff/reset-password',
  '/staff/accept-invite',
  '/f/', // public form pages
];

// Keywords that trigger celebration
const GRATITUDE_KEYWORDS = [
  'thank', 'thanks', 'awesome', 'perfect', 'great', 'amazing', 
  'helpful', 'appreciate', 'love it', 'exactly what i needed',
  'you rock', 'fantastic', 'excellent', 'wonderful'
];

function detectGratitude(message: string): boolean {
  const lower = message.toLowerCase();
  return GRATITUDE_KEYWORDS.some(keyword => lower.includes(keyword));
}

interface StanChatBotProps {
  portal?: 'brain' | 'staff';
}

export function StanChatBot({ portal = 'brain' }: StanChatBotProps) {
  const location = useLocation();
  const context = useStanContext();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageData[]>([INITIAL_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);
  const [stanMood, setStanMood] = useState<StanVariant>('idle');
  const [hasInteractedWithStan, setHasInteractedWithStan] = useState(false);

  // Proactive tips hook
  const { activeTip, dismissTip, showTip } = useProactiveTip({
    portal,
    membershipTier: context.membership_tier,
    isStanOpen: isOpen,
    hasInteractedWithStan,
  });

  // Check if we should hide Stan on current route
  const shouldHide = EXCLUDED_ROUTES.some(route => location.pathname.startsWith(route)) || 
                     location.pathname === '/';

  // Set waving mood when chat opens
  useEffect(() => {
    if (isOpen) {
      setStanMood('waving');
      // Return to idle after greeting animation
      const timeout = setTimeout(() => setStanMood('idle'), 3000);
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  // Update mood when typing state changes
  useEffect(() => {
    if (isTyping) {
      setStanMood('thinking');
    }
  }, [isTyping]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // Mark as interacted
    setHasInteractedWithStan(true);

    // Add user message
    const userMessage: ChatMessageData = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Show typing indicator and thinking mood
    setIsTyping(true);
    setStanMood('thinking');

    try {
      // Prepare conversation history (exclude greeting, last 6 messages)
      const historyForApi = messages
        .filter(m => m.id !== 'initial')
        .slice(-6)
        .map(m => ({
          role: m.role,
          content: m.content
        }));

      const { data, error } = await supabase.functions.invoke('stan_chat', {
        body: {
          message: content.trim(),
          conversation_history: historyForApi,
          context: {
            ...context,
            portal
          }
        }
      });

      if (error) throw error;

      const stanResponse: ChatMessageData = {
        id: `stan-${Date.now()}`,
        role: 'stan',
        content: data?.response || "I'm having trouble responding right now. Please try again!",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, stanResponse]);

      // Check if user expressed gratitude - celebrate!
      if (detectGratitude(content)) {
        setStanMood('celebrating');
        setTimeout(() => setStanMood('idle'), 2500);
      } else {
        // Normal response - talking then idle
        setStanMood('talking');
        setTimeout(() => setStanMood('idle'), 2000);
      }
    } catch (error) {
      console.error('Stan chat error:', error);
      
      const errorMessage: ChatMessageData = {
        id: `stan-error-${Date.now()}`,
        role: 'stan',
        content: "I'm having a moment! Please try again, or reach out to info@standardplaybook.com if this keeps happening.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setStanMood('idle');
    } finally {
      setIsTyping(false);
    }
  }, [messages, context, portal]);

  const handleClearChat = useCallback(() => {
    setMessages([INITIAL_MESSAGE]);
    setStanMood('waving');
    setTimeout(() => setStanMood('idle'), 3000);
  }, []);

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);

  // Handle accepting a proactive tip
  const handleAcceptTip = useCallback(() => {
    setHasInteractedWithStan(true);
    setIsOpen(true);
    dismissTip();
    
    // If the tip has a suggested question, send it after chat opens
    if (activeTip?.suggested_question) {
      // Small delay to let chat open first
      setTimeout(() => {
        handleSendMessage(activeTip.suggested_question!);
      }, 500);
    }
  }, [activeTip, dismissTip, handleSendMessage]);

  // Don't render on excluded routes
  if (shouldHide) return null;

  return (
    <>
      {/* Proactive Tip Bubble */}
      <ProactiveTipBubble
        message={activeTip?.tip_message || ''}
        isVisible={showTip && !isOpen}
        onAccept={handleAcceptTip}
        onDismiss={dismissTip}
      />

      {/* Floating Button (when closed) */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            onClick={handleOpen}
            className={cn(
              "fixed z-50 bottom-6 right-6",
              "w-[60px] h-[60px] rounded-full",
              "bg-transparent border-2 border-primary/60 shadow-lg shadow-primary/20",
              "flex items-center justify-center",
              "hover:scale-105 hover:border-primary transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
            )}
            title="Ask Stan"
          >
            <StanAvatar variant="talking" size="lg" animate={false} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window (when open) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <StanChatWindow
              messages={messages}
              isTyping={isTyping}
              stanMood={stanMood}
              onSendMessage={handleSendMessage}
              onClose={handleClose}
              onClearChat={handleClearChat}
              portal={portal}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
