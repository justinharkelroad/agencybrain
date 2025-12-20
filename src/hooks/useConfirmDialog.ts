import { useState, useCallback } from 'react';

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  variant: 'default' | 'destructive';
  onConfirm: () => void;
}

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    description: '',
    confirmLabel: 'Confirm',
    variant: 'default',
    onConfirm: () => {},
  });
  
  const confirm = useCallback(({
    title,
    description,
    confirmLabel = 'Confirm',
    variant = 'default',
  }: {
    title: string;
    description: string;
    confirmLabel?: string;
    variant?: 'default' | 'destructive';
  }): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        title,
        description,
        confirmLabel,
        variant,
        onConfirm: () => {
          setState(prev => ({ ...prev, isOpen: false }));
          resolve(true);
        },
      });
    });
  }, []);
  
  const cancel = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
  }, []);
  
  return {
    ...state,
    confirm,
    cancel,
  };
}
