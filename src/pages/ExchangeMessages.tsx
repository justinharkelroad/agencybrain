import { useState } from 'react';
import { SidebarLayout } from '@/components/SidebarLayout';
import { ExchangeMessagesInbox } from '@/components/exchange/ExchangeMessagesInbox';
import { ExchangeConversationView } from '@/components/exchange/ExchangeConversationView';
import { Card } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';
import { ExchangeConversation } from '@/hooks/useExchangeMessages';

export default function ExchangeMessages() {
  const [selectedConversation, setSelectedConversation] = useState<ExchangeConversation | null>(null);
  
  return (
    <SidebarLayout>
      <div className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Messages</h1>
          <p className="text-muted-foreground">Direct messages with other community members</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-200px)]">
          {/* Inbox */}
          <Card className="border-border/50 bg-card/50 md:col-span-1 overflow-hidden">
            <ExchangeMessagesInbox
              selectedId={selectedConversation?.id}
              onSelect={setSelectedConversation}
            />
          </Card>
          
          {/* Conversation View */}
          <div className="md:col-span-2 h-full">
            {selectedConversation ? (
              <ExchangeConversationView
                conversation={selectedConversation}
                onBack={() => setSelectedConversation(null)}
              />
            ) : (
              <Card className="h-full border-border/50 bg-card/50 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Select a conversation to view messages</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
