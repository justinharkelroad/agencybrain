import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface UseExchangeKeyboardShortcutsProps {
  onNewPost?: () => void;
  onSearch?: () => void;
  onRefresh?: () => void;
}

export function useExchangeKeyboardShortcuts({
  onNewPost,
  onSearch,
  onRefresh,
}: UseExchangeKeyboardShortcutsProps) {
  const navigate = useNavigate();
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }
      
      // n - New post
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onNewPost?.();
      }
      
      // / - Focus search
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onSearch?.();
      }
      
      // r - Refresh feed
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onRefresh?.();
      }
      
      // m - Go to messages
      if (e.key === 'm' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        navigate('/exchange/messages');
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigate, onNewPost, onSearch, onRefresh]);
}
