import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Upload, FileText } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const uploadCategories = [
  { id: 'sales', name: 'Sales', description: 'Sales reports, commission statements, client data' },
  { id: 'marketing', name: 'Marketing', description: 'Marketing campaigns, lead generation reports, analytics' },
  { id: 'current-biz-metrics', name: 'Current Biz Metrics', description: 'Business performance metrics, KPI reports' },
  { id: 'termination-report', name: 'Termination Report', description: 'Client termination reports, retention analysis' },
];

export default function UploadSelection() {
  const navigate = useNavigate();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleContinue = () => {
    if (selectedCategories.length > 0) {
      // Navigate to uploads page with selected categories
      navigate('/uploads', { state: { selectedCategories } });
    } else {
      // Skip uploads and go to dashboard
      navigate('/dashboard');
    }
  };

  const handleSkip = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-6">
          <Link to="/submit">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Form
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mt-4 mb-2">Upload Documents</h1>
          <p className="text-muted-foreground">
            Would you like to upload any of the following documents to be analyzed deeper?
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Select Document Categories
            </CardTitle>
            <CardDescription>
              Choose which types of documents you'd like to upload for analysis. You can select multiple categories or skip this step.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              {uploadCategories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    id={category.id}
                    checked={selectedCategories.includes(category.id)}
                    onCheckedChange={() => handleCategoryToggle(category.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor={category.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {category.name}
                    </label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {category.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-6 border-t">
              <Button variant="outline" onClick={handleSkip}>
                Skip & Complete
              </Button>
              <Button onClick={handleContinue} className="flex items-center gap-2">
                {selectedCategories.length > 0 ? (
                  <>
                    <Upload className="w-4 h-4" />
                    Continue to Upload ({selectedCategories.length} selected)
                  </>
                ) : (
                  'Complete Submission'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}