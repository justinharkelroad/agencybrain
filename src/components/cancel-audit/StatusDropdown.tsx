import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateRecordStatus } from '@/hooks/useCancelAuditActivities';
import { RecordStatus } from '@/types/cancel-audit';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusDropdownProps {
  recordId: string;
  currentStatus: RecordStatus;
  onStatusChange?: (newStatus: RecordStatus) => void;
}

const STATUS_OPTIONS: { value: RecordStatus; label: string; color: string }[] = [
  { value: 'new', label: 'New', color: 'bg-gray-500' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-500' },
  { value: 'resolved', label: 'Resolved', color: 'bg-green-500' },
  { value: 'lost', label: 'Lost', color: 'bg-red-500' },
];

export function StatusDropdown({
  recordId,
  currentStatus,
  onStatusChange,
}: StatusDropdownProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const updateStatus = useUpdateRecordStatus();

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === currentStatus) return;
    
    setIsUpdating(true);
    
    try {
      await updateStatus.mutateAsync({
        recordId,
        status: newStatus,
      });
      
      toast.success('Status updated');
      onStatusChange?.(newStatus as RecordStatus);
    } catch (error: any) {
      toast.error('Failed to update status', {
        description: error.message || 'Please try again',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const currentOption = STATUS_OPTIONS.find(opt => opt.value === currentStatus);

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select
        value={currentStatus}
        onValueChange={handleStatusChange}
        disabled={isUpdating}
      >
        <SelectTrigger className="w-[130px] h-7 text-xs">
          {isUpdating ? (
            <div className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Updating...</span>
            </div>
          ) : (
            <SelectValue>
              <div className="flex items-center gap-1.5">
                <div className={cn('h-2 w-2 rounded-full', currentOption?.color)} />
                <span>{currentOption?.label}</span>
              </div>
            </SelectValue>
          )}
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                <div className={cn('h-2 w-2 rounded-full', option.color)} />
                <span>{option.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
