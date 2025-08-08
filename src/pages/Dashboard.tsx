import React from 'react';
import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, Upload, Youtube } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"
import { Link } from 'react-router-dom';
import SharedInsights from '@/components/client/SharedInsights';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast()

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <img 
              src="/lovable-uploads/a2a07245-ffb4-4abf-acb8-03c996ab79a1.png" 
              alt="Standard" 
              className="h-8 mr-3"
            />
            <span className="text-lg font-medium text-muted-foreground ml-2">Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-2">
              <Link to="/uploads">
                <Button variant="ghost" size="sm">Uploads</Button>
              </Link>
              <Button variant="ghost" size="sm">Insights</Button>
            </nav>
            <Button variant="outline" onClick={handleSignOut}>Sign Out</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Shared Insights section */}
        <SharedInsights />

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Welcome!</CardTitle>
              <CardDescription>Get started with these quick actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full" asChild>
                <Link to="/uploads">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload new files
                </Link>
              </Button>
              <Button className="w-full" disabled>
                <Play className="w-4 h-4 mr-2" />
                Generate AI insights
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Connect YouTube Channel</CardTitle>
              <CardDescription>Paste your channel URL to sync videos</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex items-center space-x-2">
                <Input type="url" placeholder="https://youtube.com/channel/..." />
                <Button type="submit">
                  <Youtube className="w-4 h-4 mr-2" />
                  Sync
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Watch Quick Start Video</CardTitle>
              <CardDescription>Learn how to use the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <Play className="w-4 h-4 mr-2" />
                    Watch Video
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Quick Start Guide</DialogTitle>
                    <DialogDescription>
                      Learn how to upload, analyze, and share insights.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="relative aspect-w-16 aspect-h-9">
                    <iframe
                      src="https://www.youtube.com/embed/your-video-id"
                      title="Quick Start Video"
                      allowFullScreen
                      className="absolute top-0 left-0 w-full h-full"
                    ></iframe>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
              <CardDescription>Manage your profile information</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input type="text" id="name" value={user.user_metadata?.full_name || 'N/A'} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">
                  Email
                </Label>
                <Input type="email" id="email" value={user.email || 'N/A'} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="agency" className="text-right">
                  Agency
                </Label>
                <Input type="text" id="agency" value="Standard Analytics" className="col-span-3" />
              </div>
              <Button variant="outline" className="col-start-4 justify-self-end">
                Update Profile
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
