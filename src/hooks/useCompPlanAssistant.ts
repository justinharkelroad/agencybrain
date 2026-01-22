import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  hasDocument?: boolean;
}

export interface ExtractedCompPlanConfig {
  name?: string;
  description?: string;
  is_active?: boolean;
  payout_type?: string;
  tier_metric?: string;
  chargeback_rule?: string;
  tiers?: Array<{ min_threshold: number; commission_value: number; sort_order?: number }>;
  brokered_payout_type?: string;
  brokered_flat_rate?: number;
  brokered_counts_toward_tier?: boolean;
  brokered_tiers?: Array<{ min_threshold: number; commission_value: number; sort_order?: number }>;
  bundle_configs?: Record<string, { enabled: boolean; payout_type: string; rate: number }>;
  product_rates?: Record<string, { payout_type: string; rate: number }>;
  point_values?: Record<string, number>;
  bundling_multipliers?: { thresholds: Array<{ min_percent: number; multiplier: number }> };
  commission_modifiers?: {
    self_gen_requirement?: {
      min_percent: number;
      source: "written" | "issued";
      affects_qualification: boolean;
      affects_payout: boolean;
    };
    self_gen_kicker?: {
      enabled: boolean;
      type: "per_item" | "per_policy" | "per_household";
      amount: number;
      min_self_gen_percent: number;
    };
  };
}

interface UseCompPlanAssistantOptions {
  agencyId: string | null;
  userId: string | null;
}

export function useCompPlanAssistant({ agencyId, userId }: UseCompPlanAssistantOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [extractedConfig, setExtractedConfig] = useState<ExtractedCompPlanConfig | null>(null);

  const sendMessage = useCallback(
    async (
      message: string,
      documentContent?: string | null,
      documentType?: "text" | "image" | "pdf" | null
    ) => {
      if (!message.trim() && !documentContent) return;

      setIsLoading(true);

      // Add user message to the list
      const userMessage: ChatMessage = {
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
        hasDocument: !!documentContent,
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        const { data, error } = await supabase.functions.invoke("comp-plan-assistant", {
          body: {
            message,
            conversation_history: messages,
            document_content: documentContent,
            document_type: documentType,
            agency_id: agencyId,
            user_id: userId,
          },
        });

        if (error) {
          throw new Error(error.message);
        }

        // Add assistant response
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: data.response,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Check if config was extracted
        if (data.extracted_config) {
          setExtractedConfig(data.extracted_config);
        }

        return data;
      } catch (err) {
        console.error("Error sending message:", err);
        toast.error("Failed to get response. Please try again.");

        // Add error message
        const errorMessage: ChatMessage = {
          role: "assistant",
          content:
            "I'm having trouble right now. Please try again or contact info@standardplaybook.com for help.",
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);

        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [messages, agencyId, userId]
  );

  const resetConversation = useCallback(() => {
    setMessages([]);
    setExtractedConfig(null);
  }, []);

  // Convert file to base64 for upload
  const processFileUpload = useCallback(async (file: File): Promise<{ content: string; type: "text" | "image" | "pdf" } | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result as string;

        // Determine type based on file mime type
        if (file.type.startsWith("image/")) {
          // Extract base64 data (remove data:image/...;base64, prefix)
          const base64 = result.split(",")[1];
          resolve({ content: base64, type: "image" });
        } else if (file.type === "application/pdf") {
          const base64 = result.split(",")[1];
          resolve({ content: base64, type: "pdf" });
        } else {
          // For text files, just use the text content
          resolve({ content: result, type: "text" });
        }
      };

      reader.onerror = () => {
        toast.error("Failed to read file");
        resolve(null);
      };

      // Read as data URL for images/PDFs, text for others
      if (file.type.startsWith("image/") || file.type === "application/pdf") {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });
  }, []);

  return {
    messages,
    isLoading,
    extractedConfig,
    sendMessage,
    resetConversation,
    processFileUpload,
    hasConfig: !!extractedConfig,
  };
}
