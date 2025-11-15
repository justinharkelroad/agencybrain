import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLifeTargetsStore } from '@/lib/lifeTargetsStore';
import { useQuarterlyTargets } from '@/hooks/useQuarterlyTargets';
import { toast } from 'sonner';

interface LifeTargetsGuardProps {
  children: React.ReactNode;
  requiredStep: 'targets' | 'missions' | 'primary' | 'actions';
}

export function LifeTargetsGuard({ children, requiredStep }: LifeTargetsGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentQuarter } = useLifeTargetsStore();
  const { data: targets } = useQuarterlyTargets(currentQuarter);

  useEffect(() => {
    if (!targets) return;

    const targetsSet = [
      targets.body_target,
      targets.being_target,
      targets.balance_target,
      targets.business_target,
    ].filter(Boolean).length;

    const hasMissions = [
      targets.body_monthly_missions,
      targets.being_monthly_missions,
      targets.balance_monthly_missions,
      targets.business_monthly_missions,
    ].some(m => m && Object.keys(m).length > 0);

    const domainsWithMultipleTargets = [
      { target1: targets.body_target, target2: targets.body_target2 },
      { target1: targets.being_target, target2: targets.being_target2 },
      { target1: targets.balance_target, target2: targets.balance_target2 },
      { target1: targets.business_target, target2: targets.business_target2 },
    ].filter(d => d.target1 && d.target2).length;

    const hasPrimarySelections = domainsWithMultipleTargets === 0 || [
      targets.body_primary_is_target1,
      targets.being_primary_is_target1,
      targets.balance_primary_is_target1,
      targets.business_primary_is_target1,
    ].some(p => p !== null && p !== undefined);

    // Enforce sequential flow
    if (requiredStep === 'missions' && targetsSet === 0) {
      toast.error('Please set your quarterly targets first');
      navigate('/life-targets', { replace: true });
    } else if (requiredStep === 'primary' && !hasMissions) {
      toast.error('Please generate monthly missions first');
      navigate('/life-targets', { replace: true });
    } else if (requiredStep === 'actions' && (!hasMissions || !hasPrimarySelections)) {
      toast.error('Please generate missions and select primary targets first');
      navigate('/life-targets', { replace: true });
    }
  }, [targets, requiredStep, navigate, location.pathname, currentQuarter]);

  return <>{children}</>;
}
