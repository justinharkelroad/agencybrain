import { useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { StanAvatar } from "./StanAvatar";
import { StanChatWindow } from "./StanChatWindow";
import { ChatMessageData } from "./ChatMessage";
import { cn } from "@/lib/utils";
import { useStanContext } from "@/hooks/useStanContext";
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

interface StanChatBotProps {
  portal?: 'brain' | 'staff';
}

export function StanChatBot({ portal = 'brain' }: StanChatBotProps) {
  const location = useLocation();
  const context = useStanContext();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageData[]>([INITIAL_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);

  // Check if we should hide Stan on current route
  const shouldHide = EXCLUDED_ROUTES.some(route => location.pathname.startsWith(route)) || 
                     location.pathname === '/';

  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // Add user message
    const userMessage: ChatMessageData = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Show typing indicator
    setIsTyping(true);

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
    } catch (error) {
      console.error('Stan chat error:', error);
      
      const errorMessage: ChatMessageData = {
        id: `stan-error-${Date.now()}`,
        role: 'stan',
        content: "I'm having a moment! Please try again, or reach out to info@standardplaybook.com if this keeps happening.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  }, [messages, context, portal]);

  const handleClearChat = useCallback(() => {
    setMessages([INITIAL_MESSAGE]);
  }, []);

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);

  // Don't render on excluded routes
  if (shouldHide) return null;

  return (
    <>
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
              "bg-primary shadow-lg shadow-primary/25",
              "flex items-center justify-center",
              "hover:scale-105 transition-transform duration-200",
              "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
            )}
            title="Ask Stan"
          >
            <StanAvatar variant="talking" size="lg" />
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
