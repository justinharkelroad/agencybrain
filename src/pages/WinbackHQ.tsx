import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RotateCcw } from "lucide-react";

export default function WinbackHQ() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <RotateCcw className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Win-Back HQ</h1>
          <p className="text-muted-foreground">
            Track terminated policies and win back former customers
          </p>
        </div>
      </div>

      {/* Coming Soon Card */}
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            Win-Back HQ is being built. Phase 1 database schema is complete.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            This feature will allow you to:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Upload termination audit reports</li>
            <li>Track customers approaching their competitor's renewal date</li>
            <li>Assign win-back opportunities to team members</li>
            <li>Monitor progress and win-back success rates</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
