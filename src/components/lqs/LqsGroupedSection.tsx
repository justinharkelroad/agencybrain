import { useState, useMemo, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { LqsHouseholdTable } from './LqsHouseholdTable';
import type { HouseholdWithRelations } from '@/hooks/useLqsData';

interface LqsGroupedSectionProps {
  groupName: string;
  households: HouseholdWithRelations[];
  activeTab: string;
  onAssignLeadSource: (id: string) => void;
  onViewHouseholdDetail: (household: HouseholdWithRelations) => void;
  onViewSaleDetail: (saleId: string) => void;
  onViewProfile?: (household: HouseholdWithRelations) => void;
  isLoading: boolean;
}

export function LqsGroupedSection({
  groupName,
  households,
  activeTab,
  onAssignLeadSource,
  onViewHouseholdDetail,
  onViewSaleDetail,
  onViewProfile,
  isLoading,
}: LqsGroupedSectionProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Reset to page 1 when households change (e.g., filter applied)
  useEffect(() => {
    setCurrentPage(1);
  }, [households.length]);

  const paginatedHouseholds = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return households.slice(start, start + pageSize);
  }, [households, currentPage, pageSize]);

  const totalPages = Math.ceil(households.length / pageSize);
  const startRecord = households.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, households.length);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // Format group name for date tabs
  const formattedGroupName = activeTab === 'by-date' && groupName !== 'Unknown'
    ? format(parseISO(groupName), 'MMMM d, yyyy')
    : groupName;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="font-semibold">{formattedGroupName}</h3>
        <Badge variant="secondary">{households.length}</Badge>
      </div>
      <LqsHouseholdTable
        households={paginatedHouseholds}
        loading={isLoading}
        onAssignLeadSource={onAssignLeadSource}
        onViewHouseholdDetail={onViewHouseholdDetail}
        onViewSaleDetail={onViewSaleDetail}
        onViewProfile={onViewProfile}
        totalRecords={households.length}
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={handlePageSizeChange}
        startRecord={startRecord}
        endRecord={endRecord}
      />
    </div>
  );
}
