import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, FileText, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import FileUpload from '@/components/FileUpload';

interface Upload {
  id: string;
  original_name: string;
  file_path: string;
  file_size: number;
  file_type?: string;
  category: string;
  created_at: string;
  mime_type?: string;
  user_id: string;
}

export const UploadsContent = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
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
  }, [user]);

  const fetchUploads = async () => {
    try {
      const { data, error } = await supabase
        .from('uploads')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUploads((data || []).map(item => ({
        ...item,
        file_type: item.mime_type || item.category
      })));
    } catch (error) {
      console.error('Error fetching uploads:', error);
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
      const { error: storageError } = await supabase.storage
        .from('uploads')
        .remove([upload.file_path]);

      if (storageError) throw storageError;

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
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="upload">Upload Documents</TabsTrigger>
          <TabsTrigger value="manage">Manage Files</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          {categories.map((category) => (
            <Card key={category.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {category.label}
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
  );
};
