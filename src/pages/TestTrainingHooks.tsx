import { useState, useEffect } from 'react';
import { useTrainingCategories } from '@/hooks/useTrainingCategories';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

// Test page to demonstrate Phase 3 hook functionality
export default function TestTrainingHooks() {
  const [agencyId, setAgencyId] = useState<string>('');
  const [testCategoryId, setTestCategoryId] = useState<string>('');
  const [testLog, setTestLog] = useState<string[]>([]);

  const { 
    categories, 
    isLoading, 
    createCategory, 
    deleteCategory,
    isCreating,
    isDeleting
  } = useTrainingCategories(agencyId);

  // Get agency ID from user profile
  useEffect(() => {
    const fetchAgencyId = async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('agency_id')
          .eq('id', user.id)
          .single();
        
        if (profile?.agency_id) {
          setAgencyId(profile.agency_id);
          addLog(`✓ Agency ID loaded: ${profile.agency_id}`);
        } else {
          addLog('✗ No agency ID found for user');
        }
      } else {
        addLog('✗ User not authenticated');
      }
    };

    fetchAgencyId();
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTestLog(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[Training Test] ${message}`);
  };

  const runFullTest = async () => {
    if (!agencyId) {
      addLog('✗ Cannot run test: No agency ID');
      return;
    }

    setTestLog([]);
    addLog('Starting full CRUD test...');

    // Step 1: Create
    addLog('Step 1: Creating test category...');
    const testCategory = {
      agency_id: agencyId,
      name: `Test Category ${Date.now()}`,
      sort_order: 999,
      is_active: true,
    };

    createCategory(testCategory, {
      onSuccess: async (data) => {
        addLog(`✓ Category created: ${data.name} (ID: ${data.id})`);
        setTestCategoryId(data.id);

        // Step 2: Explicitly fetch fresh data to avoid stale closure
        setTimeout(async () => {
          addLog('Step 2: Fetching categories...');
          
          const { supabase } = await import('@/integrations/supabase/client');
          const { data: freshCategories } = await supabase
            .from('training_categories')
            .select('*')
            .eq('agency_id', agencyId)
            .order('sort_order', { ascending: true });
          
          const found = freshCategories?.find(c => c.id === data.id);
          if (found) {
            addLog(`✓ Category fetched: ${found.name}`);
            
            // Step 3: Delete
            setTimeout(() => {
              addLog('Step 3: Deleting test category...');
              deleteCategory(data.id, {
                onSuccess: () => {
                  addLog('✓ Category deleted successfully');
                  addLog('✓ Full CRUD test completed!');
                  setTestCategoryId('');
                },
                onError: (error) => {
                  addLog(`✗ Delete failed: ${error}`);
                }
              });
            }, 1000);
          } else {
            addLog('✗ Category not found in fetch results');
          }
        }, 1000);
      },
      onError: (error) => {
        addLog(`✗ Create failed: ${error}`);
      }
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Phase 3: Training Hooks Test</CardTitle>
          <CardDescription>
            Testing useTrainingCategories hook with full CRUD operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Agency Info */}
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium">Agency ID: {agencyId || 'Loading...'}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Categories loaded: {categories?.length || 0}
            </p>
          </div>

          {/* Test Button */}
          <Button 
            onClick={runFullTest} 
            disabled={!agencyId || isCreating || isDeleting || isLoading}
            size="lg"
            className="w-full"
          >
            {(isCreating || isDeleting || isLoading) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Run Full CRUD Test (Create → Fetch → Delete)
          </Button>

          {/* Test Log */}
          <div className="space-y-2">
            <h3 className="font-semibold">Test Log:</h3>
            <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-xs h-64 overflow-y-auto">
              {testLog.length === 0 ? (
                <p className="text-muted-foreground">No tests run yet. Click the button above to start.</p>
              ) : (
                testLog.map((log, i) => (
                  <div key={i} className="mb-1">{log}</div>
                ))
              )}
            </div>
          </div>

          {/* Current Categories */}
          {categories && categories.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Current Categories:</h3>
              <div className="space-y-2">
                {categories.map(cat => (
                  <div 
                    key={cat.id} 
                    className={`p-3 border rounded-lg ${cat.id === testCategoryId ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <p className="font-medium">{cat.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ID: {cat.id} | Order: {cat.sort_order}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
