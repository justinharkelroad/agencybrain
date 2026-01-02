import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesLog } from "@/components/sales/SalesLog";
import { AddSaleForm } from "@/components/sales/AddSaleForm";

export default function Sales() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("log");

  // Admin-only access
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSaleCreated = () => {
    setActiveTab("log");
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Sales</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="log">Sales Log</TabsTrigger>
          <TabsTrigger value="add">Add Sale</TabsTrigger>
        </TabsList>

        <TabsContent value="log" className="mt-6">
          <SalesLog />
        </TabsContent>

        <TabsContent value="add" className="mt-6">
          <AddSaleForm onSuccess={handleSaleCreated} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
