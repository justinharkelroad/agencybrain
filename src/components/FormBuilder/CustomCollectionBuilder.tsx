import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings, Trash2 } from "lucide-react";
import { 
  CustomDetailCollection, 
  CustomDetailField, 
  CustomCollectionSchemaItem,
  generateFieldKey,
  FIELD_TYPE_LABELS,
  CustomFieldType 
} from "@/types/custom-collections";
import CreateCollectionDialog from "./CreateCollectionDialog";
import CustomCollectionFieldEditor from "./CustomCollectionFieldEditor";

interface CustomCollectionBuilderProps {
  collections: CustomCollectionSchemaItem[];
  kpiFields: Array<{ key: string; label: string }>;
  onAddCollection: (collection: CustomCollectionSchemaItem) => void;
  onUpdateCollection: (id: string, updates: Partial<CustomCollectionSchemaItem>) => void;
  onDeleteCollection: (id: string) => void;
}

export default function CustomCollectionBuilder({
  collections,
  kpiFields,
  onAddCollection,
  onUpdateCollection,
  onDeleteCollection,
}: CustomCollectionBuilderProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);

  const handleCreateCollection = (data: { name: string; description?: string; controllingKpiKey: string }) => {
    const newCollection: CustomCollectionSchemaItem = {
      id: crypto.randomUUID(),
      name: data.name,
      description: data.description,
      controllingKpiKey: data.controllingKpiKey,
      enabled: true,
      fields: [],
    };
    onAddCollection(newCollection);
    setShowCreateDialog(false);
    // Open field editor for the new collection
    setEditingCollectionId(newCollection.id);
  };

  const toggleCollectionEnabled = (id: string, enabled: boolean) => {
    onUpdateCollection(id, { enabled });
  };

  const getControllingKpiLabel = (kpiKey: string) => {
    const kpi = kpiFields.find(k => k.key === kpiKey);
    return kpi?.label || kpiKey;
  };

  const editingCollection = editingCollectionId 
    ? collections.find(c => c.id === editingCollectionId) 
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom Detail Collections</CardTitle>
        <CardDescription>
          Create custom repeater sections with your own fields
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {collections.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No custom collections yet
          </p>
        ) : (
          <div className="space-y-3">
            {collections.map((collection) => (
              <div 
                key={collection.id} 
                className="border rounded-lg p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={collection.enabled}
                      onCheckedChange={(enabled) => toggleCollectionEnabled(collection.id, enabled)}
                    />
                    <div>
                      <h4 className="font-medium">{collection.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        Controlled by: {getControllingKpiLabel(collection.controllingKpiKey)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {collection.fields.length} {collection.fields.length === 1 ? 'field' : 'fields'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingCollectionId(collection.id)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteCollection(collection.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {collection.description && (
                  <p className="text-sm text-muted-foreground pl-12">
                    {collection.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          onClick={() => setShowCreateDialog(true)}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Custom Details
        </Button>

        <CreateCollectionDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          kpiFields={kpiFields}
          onSubmit={handleCreateCollection}
        />

        {editingCollection && (
          <CustomCollectionFieldEditor
            open={!!editingCollectionId}
            onOpenChange={(open) => !open && setEditingCollectionId(null)}
            collection={editingCollection}
            kpiFields={kpiFields}
            onUpdate={(updates) => onUpdateCollection(editingCollection.id, updates)}
          />
        )}
      </CardContent>
    </Card>
  );
}
