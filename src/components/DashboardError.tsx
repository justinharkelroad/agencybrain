import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface DashboardErrorProps {
  error: Error;
  onRetry: () => void;
  isRetrying?: boolean;
}

export function DashboardError({ error, onRetry, isRetrying = false }: DashboardErrorProps) {
  return (
    <div className="container mx-auto px-4 py-6">
      <Card className="glass-surface border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Dashboard Error
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              We encountered an error while loading your dashboard data:
            </p>
            <p className="text-sm font-mono bg-muted/30 p-3 rounded border">
              {error.message || "Unknown error occurred"}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              onClick={onRetry}
              disabled={isRetrying}
              variant="outline"
              size="sm"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </>
              )}
            </Button>
            
            <p className="text-xs text-muted-foreground">
              If this persists, please contact support
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}