import React from "react";
import { AlertCircle } from 'lucide-react';

export function ErrorAlert({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="relative w-full rounded-2xl border border-destructive/50 bg-destructive/15 backdrop-blur-md p-4 shadow-elegant transition-smooth hover:scale-[1.02] hover:shadow-2xl text-destructive-foreground [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4">
      <AlertCircle className="h-4 w-4" />
      {title && <h5 className="mb-1 font-inter font-normal leading-none tracking-tighter">{title}</h5>}
      <div className="text-sm [&_p]:leading-relaxed">
        {children}
      </div>
    </div>
  );
}

export default ErrorAlert;
