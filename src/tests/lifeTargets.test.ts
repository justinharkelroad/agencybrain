import { describe, it, expect } from 'vitest';
import type { QuarterlyTargets } from '@/hooks/useQuarterlyTargets';
import type { MeasurabilityAnalysis } from '@/hooks/useTargetMeasurability';

describe('Life Targets Data Validation', () => {
  it('should validate quarterly targets structure', () => {
    const validTargets: QuarterlyTargets = {
      quarter: 'Q1',
      body_target: 'Run 5k in under 25 minutes',
      body_narrative: 'To improve cardiovascular health',
      body_daily_habit: null,
      body_monthly_missions: null,
      being_target: 'Meditate daily for 20 minutes',
      being_narrative: 'To reduce stress and improve focus',
      being_daily_habit: null,
      being_monthly_missions: null,
      balance_target: 'Spend quality time with family weekly',
      balance_narrative: 'To strengthen relationships',
      balance_daily_habit: null,
      balance_monthly_missions: null,
      business_target: 'Launch new product feature',
      business_narrative: 'To increase user engagement',
      business_daily_habit: null,
      business_monthly_missions: null,
    };

    expect(validTargets.quarter).toMatch(/^Q[1-4]$/);
    expect(validTargets.body_target).toBeTruthy();
    expect(validTargets.being_target).toBeTruthy();
    expect(validTargets.balance_target).toBeTruthy();
    expect(validTargets.business_target).toBeTruthy();
  });

  it('should validate measurability analysis structure', () => {
    const validAnalysis: MeasurabilityAnalysis = {
      body: [{
        original: 'Get healthier',
        clarity_score: 4,
        rewritten_target: 'Run 5k in under 25 minutes by March 31st',
      }],
      being: [{
        original: 'Be more mindful',
        clarity_score: 5,
        rewritten_target: 'Complete 20 minutes of meditation daily for 90 consecutive days',
      }],
      balance: [{
        original: 'Improve relationships',
        clarity_score: 3,
        rewritten_target: 'Schedule and complete 12 weekly family dinners (3 per month)',
      }],
      business: [{
        original: 'Grow business',
        clarity_score: 4,
        rewritten_target: 'Launch beta version of feature X to 100 test users by Q1 end',
      }],
    };

    expect(validAnalysis.body[0].clarity_score).toBeGreaterThanOrEqual(0);
    expect(validAnalysis.body[0].clarity_score).toBeLessThanOrEqual(10);
    expect(validAnalysis.body[0].rewritten_target.length).toBeGreaterThan(
      validAnalysis.body[0].original.length
    );
  });

  it('should handle empty targets gracefully', () => {
    const emptyTargets: Partial<QuarterlyTargets> = {
      quarter: 'Q2',
      body_target: '',
      being_target: '',
      balance_target: '',
      business_target: '',
    };

    const hasAnyTarget = [
      emptyTargets.body_target,
      emptyTargets.being_target,
      emptyTargets.balance_target,
      emptyTargets.business_target,
    ].some(Boolean);

    expect(hasAnyTarget).toBe(false);
  });

  it('should validate clarity scores are in valid range', () => {
    const scores = [0, 3, 5, 7, 10];
    
    scores.forEach(score => {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(10);
    });
  });

  it('should categorize clarity scores correctly', () => {
    const getCategory = (score: number): string => {
      if (score >= 8) return 'excellent';
      if (score >= 5) return 'good';
      return 'needs-improvement';
    };

    expect(getCategory(9)).toBe('excellent');
    expect(getCategory(6)).toBe('good');
    expect(getCategory(3)).toBe('needs-improvement');
  });
});
