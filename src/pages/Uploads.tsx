import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, FileText, Trash2, ArrowLeft } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import FileUpload from '@/components/FileUpload';

interface Upload {
  id: string;
  original_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  category: string;
  created_at: string;
}

const Uploads = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("upload");

  const categories = [
    { id: 'sales', label: 'Sales (New Business Details Reports Etc)' },
    { id: 'marketing', label: 'Marketing (Any Leads Purchased Reports Etc)' },
    { id: 'current-biz-metrics', label: 'Current Biz Metrics' },
    { id: 'termination-report', label: 'Termination Report' },
    { id: 'miscellaneous', label: 'Miscellaneous' },
  ];

  useEffect(() => {
    if (user) {
      fetchUploads();
    }
    // Check if we came from upload selection
    if (location.state?.selectedCategories) {
      setSelectedCategories(location.state.selectedCategories);
    }
  }, [user, location.state]);

  const fetchUploads = async () => {
    try {
      const { data, error } = await supabase
        .from('uploads')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUploads(data || []);
    } catch (error) {
      console.error('Error fetching uploads:', error);
      // Only show error if it's not just an empty result
      if (error && (error as any).code !== 'PGRST116') {
        toast({
          title: "Error",
          description: "Failed to load uploads",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = () => {
    fetchUploads();
  };

  const downloadFile = async (filePath: string, originalName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('uploads')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const deleteFile = async (upload: Upload) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('uploads')
        .remove([upload.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('uploads')
        .delete()
        .eq('id', upload.id);

      if (dbError) throw dbError;

      setUploads(uploads.filter(u => u.id !== upload.id));
      
      toast({
        title: "File deleted",
        description: "File has been deleted successfully",
      });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: "Failed to delete file",
        variant: "destructive",
      });
    }
  };

  const getUploadsByCategory = (category: string) => {
    return uploads.filter(upload => upload.category === category);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold mb-2">Files</h1>
          <p className="text-muted-foreground">
            Upload and manage your files organized by performance domains
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="upload">Upload Documents</TabsTrigger>
            <TabsTrigger value="manage">Manage Files</TabsTrigger>
          </TabsList>
          
          {selectedCategories.length > 0 && (
            <Card className="bg-accent/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Upload Progress</p>
                    <p className="text-sm text-muted-foreground">
                      Selected {selectedCategories.length} categories for upload
                    </p>
                  </div>
                  <Button onClick={() => navigate('/dashboard')}>
                    Complete & View Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <TabsContent value="upload" className="space-y-6">
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Upload Documents</h2>
                  <p className="text-muted-foreground">Choose a category and upload your files for analysis</p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setActiveTab("manage")}
                  className="flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Manage Files
                </Button>
              </div>
            </div>
            {categories
              .filter(category => selectedCategories.length === 0 || selectedCategories.includes(category.id))
              .map((category) => (
              <Card key={category.id} className={selectedCategories.includes(category.id) ? 'ring-2 ring-primary/20' : ''}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {category.label}
                    {selectedCategories.includes(category.id) && (
                      <Badge variant="default" className="mr-2">Selected</Badge>
                    )}
                    <Badge variant="outline">
                      {getUploadsByCategory(category.id).length} files
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FileUpload
                    category={category.id}
                    onUploadComplete={handleUploadComplete}
                    maxFiles={10}
                  />
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="manage" className="space-y-6">
            {categories.map((category) => {
              const categoryUploads = getUploadsByCategory(category.id);
              
              return (
                <Card key={category.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {category.label}
                      <Badge variant="outline">
                        {categoryUploads.length} files
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {categoryUploads.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No files uploaded for this category
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {categoryUploads.map((upload) => (
                          <div
                            key={upload.id}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex items-center space-x-3">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{upload.original_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {formatFileSize(upload.file_size)} • {formatDate(upload.created_at)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadFile(upload.file_path, upload.original_name)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteFile(upload)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Uploads;