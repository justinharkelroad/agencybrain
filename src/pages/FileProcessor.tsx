import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import ColumnMappingWizard from '@/components/ColumnMappingWizard';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Settings, 
  Trash2,
  Download,
  LogOut
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { AgencyBrainBadge } from '@/components/AgencyBrainBadge';

interface ColumnMapping {
  id: string;
  file_type: string;
  category: string;
  original_columns: string[];
  mapped_columns: Record<string, string>;
  created_at: string;
  updated_at: string;
}

const FileProcessor = () => {
  const { user, signOut } = useAuth();
  const [savedMappings, setSavedMappings] = useState<ColumnMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const categories = [
    { id: 'sales', label: 'Sales Data', description: 'Premium, policies, commission data' },
    { id: 'marketing', label: 'Marketing Data', description: 'Spend, leads, conversion metrics' },
    { id: 'operations', label: 'Operations Data', description: 'Staff, efficiency, service metrics' },
    { id: 'retention', label: 'Retention Data', description: 'Customer satisfaction, renewals' },
    { id: 'cash_flow', label: 'Cash Flow Data', description: 'Revenue, expenses, profit data' },
    { id: 'qualitative', label: 'Qualitative Data', description: 'Comments, feedback, notes' }
  ];

  useEffect(() => {
    if (user) {
      fetchSavedMappings();
    }
  }, [user]);

  const fetchSavedMappings = async () => {
    try {
      const { data, error } = await supa
        .from('column_mappings')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setSavedMappings((data || []).map(item => ({
        ...item,
        original_columns: Array.isArray(item.original_columns) 
          ? (item.original_columns as any[]).filter(col => typeof col === 'string') as string[]
          : [],
        mapped_columns: typeof item.mapped_columns === 'object' && item.mapped_columns ? item.mapped_columns as Record<string, string> : {}
      })));
    } catch (error) {
      console.error('Error fetching mappings:', error);
      toast({
        title: "Error",
        description: "Failed to load saved mappings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteMapping = async (mappingId: string) => {
    if (!confirm('Are you sure you want to delete this mapping?')) return;

    try {
      const { error } = await supa
        .from('column_mappings')
        .update({ is_active: false })
        .eq('id', mappingId);

      if (error) throw error;

      toast({
        title: "Mapping Deleted",
        description: "Column mapping has been deleted",
      });

      fetchSavedMappings();
    } catch (error) {
      console.error('Error deleting mapping:', error);
      toast({
        title: "Error",
        description: "Failed to delete mapping",
        variant: "destructive",
      });
    }
  };

  const exportMapping = (mapping: ColumnMapping) => {
    const exportData = {
      category: mapping.category,
      fileType: mapping.file_type,
      originalColumns: mapping.original_columns,
      mappedColumns: mapping.mapped_columns,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `column-mapping-${mapping.category}-${mapping.file_type}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="frosted-header">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <AgencyBrainBadge size="md" />
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-2">
              <Link to="/dashboard">
                <Button variant="ghost" size="sm">Dashboard</Button>
              </Link>
              <Link to="/submit">
                <Button variant="ghost" size="sm">Submit</Button>
              </Link>
              <Link to="/uploads">
                <Button variant="ghost" size="sm">Uploads</Button>
              </Link>
              <Button variant="ghost" size="sm">File Processing</Button>
            </nav>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">File Processing & Column Mapping</h1>
          <p className="text-muted-foreground">
            Set up automatic column mapping for your data files to streamline future uploads
          </p>
        </div>

        <Tabs defaultValue="process" className="space-y-6">
          <TabsList>
            <TabsTrigger value="process">Process Files</TabsTrigger>
            <TabsTrigger value="mappings">Saved Mappings</TabsTrigger>
          </TabsList>

          <TabsContent value="process" className="space-y-6">
            {categories.map((category) => (
              <Card key={category.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg">{category.label}</h3>
                      <CardDescription className="mt-1">
                        {category.description}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {savedMappings.filter(m => m.category === category.id).length} mappings
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ColumnMappingWizard
                    category={category.id}
                    onMappingComplete={() => fetchSavedMappings()}
                  />
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="mappings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Saved Column Mappings
                </CardTitle>
                <CardDescription>
                  Manage your saved column mappings for different file types and categories
                </CardDescription>
              </CardHeader>
              <CardContent>
                {savedMappings.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-2">No saved mappings yet</p>
                    <p className="text-sm text-muted-foreground">
                      Process some files to create column mappings
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {savedMappings.map((mapping) => (
                      <div
                        key={mapping.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <FileText className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold capitalize">
                              {categories.find(c => c.id === mapping.category)?.label} - {mapping.file_type.toUpperCase()}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {mapping.original_columns.length} columns mapped • 
                              Updated {formatDate(mapping.updated_at)}
                            </p>
                            <div className="flex gap-1 mt-1">
                              <Badge variant="outline" className="text-xs capitalize">
                                {mapping.category}
                              </Badge>
                              <Badge variant="outline" className="text-xs uppercase">
                                {mapping.file_type}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => exportMapping(mapping)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteMapping(mapping.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default FileProcessor;