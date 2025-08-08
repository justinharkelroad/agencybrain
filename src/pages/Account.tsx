import React from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const Account: React.FC = () => {
  const { user, isAdmin } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <img
              src="/lovable-uploads/58ab6d02-1a05-474c-b0c9-58e420b4a692.png"
              alt="Standard Analytics logo"
              className="h-8 mr-3"
              loading="lazy"
            />
            <span className="text-lg font-medium text-muted-foreground ml-2">My Account</span>
          </div>
          <Button asChild variant="outline">
            <Link to="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <h1 className="sr-only">My Account</h1>
        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>View your profile information</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input id="name" value={user?.user_metadata?.full_name || 'N/A'} className="col-span-3" readOnly />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">Email</Label>
              <Input id="email" value={user?.email || 'N/A'} className="col-span-3" readOnly />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">Role</Label>
              <Input id="role" value={isAdmin ? 'Admin' : 'User'} className="col-span-3" readOnly />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Account;
