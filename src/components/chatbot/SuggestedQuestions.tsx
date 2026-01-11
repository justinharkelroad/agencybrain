import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
  portal: 'brain' | 'staff';
}

interface SuggestedQuestion {
  id: string;
  page_route: string;
  question: string;
  sort_order: number;
  applies_to_portals: string[];
}

export function SuggestedQuestions({ onSelect, portal }: SuggestedQuestionsProps) {
  const location = useLocation();

  // Fetch suggested questions from database
  const { data: allQuestions = [] } = useQuery({
    queryKey: ['chatbot-suggested-questions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chatbot_suggested_questions')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as SuggestedQuestion[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Find questions for current page
  const getQuestionsForPage = (): string[] => {
    const currentPath = location.pathname;
    
    // Filter by portal
    const portalFiltered = allQuestions.filter(q => 
      q.applies_to_portals.includes('both') || q.applies_to_portals.includes(portal)
    );

    // Find exact match first
    let matched = portalFiltered.filter(q => currentPath === q.page_route);
    
    // If no exact match, try prefix match (e.g., /agency/team matches /agency)
    if (matched.length === 0) {
      matched = portalFiltered.filter(q => 
        q.page_route !== '_default' && currentPath.startsWith(q.page_route)
      );
    }

    // Fall back to default questions
    if (matched.length === 0) {
      matched = portalFiltered.filter(q => q.page_route === '_default');
    }

    // Return top 3 questions
    return matched.slice(0, 3).map(q => q.question);
  };

  const suggestions = getQuestionsForPage();

  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((question, index) => (
        <Button
          key={index}
          variant="ghost"
          size="sm"
          onClick={() => onSelect(question)}
          className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-3 py-1.5 h-auto transition-colors text-left whitespace-normal"
        >
          {question}
        </Button>
      ))}
    </div>
  );
}
