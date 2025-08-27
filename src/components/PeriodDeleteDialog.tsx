import React, { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supa } from '@/lib/supabase';

interface PeriodDeleteDialogProps {
  period: any;
  onDelete: () => void;
  isAdmin?: boolean;
  triggerButton?: React.ReactNode;
}

export const PeriodDeleteDialog: React.FC<PeriodDeleteDialogProps> = ({ 
  period, 
  onDelete, 
  isAdmin = false,
  triggerButton 
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
    const { error } = await supa
      .from('periods')
      .delete()
      .eq('id', period.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Period deleted successfully",
      });
      
      onDelete();
    } catch (error) {
      console.error('Error deleting period:', error);
      toast({
        title: "Error",
        description: "Failed to delete period",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const hasFormData = period?.form_data && Object.keys(period.form_data).length > 0;

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
      <Trash2 className="w-4 h-4 mr-2" />
      Delete
    </Button>
  );

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {triggerButton || defaultTrigger}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Period</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Are you sure you want to delete this period? This action cannot be undone.
            </p>
            <div className="bg-muted p-3 rounded-lg">
              <p className="font-medium">Period Details:</p>
              <p className="text-sm">
                {new Date(period.start_date).toLocaleDateString()} - {new Date(period.end_date).toLocaleDateString()}
              </p>
              <p className="text-sm">
                Status: <span className="capitalize">{period.status}</span>
              </p>
              {hasFormData && (
                <p className="text-sm text-amber-600 font-medium">
                  ⚠️ This period contains submitted form data
                </p>
              )}
            </div>
            {hasFormData && (
              <p className="text-red-600 font-medium">
                Deleting this period will permanently remove all form submissions and data.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? "Deleting..." : "Delete Period"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};