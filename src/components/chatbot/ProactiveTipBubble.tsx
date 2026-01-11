import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { StanAvatar } from './StanAvatar';

interface ProactiveTipBubbleProps {
  message: string;
  isVisible: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

export function ProactiveTipBubble({ 
  message, 
  isVisible, 
  onAccept, 
  onDismiss 
}: ProactiveTipBubbleProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed z-50 bottom-24 right-6"
        >
          {/* Speech bubble */}
          <div 
            onClick={onAccept}
            className="relative bg-gradient-to-br from-slate-800 to-slate-900 border border-primary/30 rounded-2xl p-4 pr-10 shadow-xl cursor-pointer hover:border-primary/50 transition-colors max-w-[280px]"
          >
            {/* Dismiss button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="absolute top-2 right-2 p-1 hover:bg-white/10 rounded-full transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Content */}
            <div className="flex gap-3 items-start">
              <StanAvatar variant="waving" size="sm" animate={false} />
              <div className="flex-1">
                <p className="text-sm text-foreground leading-snug">
                  {message}
                </p>
                <p className="text-xs text-primary mt-1.5 font-medium">
                  Click to chat →
                </p>
              </div>
            </div>

            {/* Pointer triangle */}
            <div className="absolute -bottom-2 right-8 w-4 h-4 bg-slate-900 border-r border-b border-primary/30 transform rotate-45" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
