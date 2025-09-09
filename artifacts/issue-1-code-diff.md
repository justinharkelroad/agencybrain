# Issue 1 - KPI Field Linking - Code Diff

## Modified Files

### 1. KPIFieldManager.tsx
```diff
interface KPIField {
  key: string;
  label: string;
  required: boolean;
  type: 'number' | 'currency' | 'percentage';
+ selectedKpiId?: string; // Links to actual agency KPI
+ selectedKpiSlug?: string; // KPI slug for submission mapping
  target?: {
    minimum?: number;
    goal?: number;
    excellent?: number;
  };
}

+interface AgencyKPI {
+  kpi_id: string;
+  slug: string;
+  label: string;
+  active: boolean;
+}

interface KPIFieldManagerProps {
  kpis: KPIField[];
+ availableKpis: AgencyKPI[];
  onUpdateLabel: (index: number, label: string) => void;
  onToggleRequired: (index: number) => void;
  onUpdateType: (index: number, type: 'number' | 'currency' | 'percentage') => void;
  onUpdateTarget: (index: number, target: { minimum?: number; goal?: number; excellent?: number }) => void;
+ onUpdateKpiSelection: (index: number, kpiId: string, slug: string, label: string) => void;
  onAddField: () => void;
  onRemoveField: (index: number) => void;
}

// Added KPI Selection Dropdown:
+               <div className="space-y-2">
+                 <Label className="text-sm font-medium">Select KPI</Label>
+                 <Select 
+                   value={kpi.selectedKpiId || ''} 
+                   onValueChange={(kpiId) => {
+                     const selectedKpi = availableKpis.find(k => k.kpi_id === kpiId);
+                     if (selectedKpi) {
+                       onUpdateKpiSelection(index, kpiId, selectedKpi.slug, selectedKpi.label);
+                     }
+                   }}
+                 >
+                   <SelectTrigger>
+                     <SelectValue placeholder="Choose a KPI" />
+                   </SelectTrigger>
+                   <SelectContent>
+                     {availableKpis.map(availKpi => (
+                       <SelectItem key={availKpi.kpi_id} value={availKpi.kpi_id}>
+                         {availKpi.label} ({availKpi.slug})
+                       </SelectItem>
+                     ))}
+                   </SelectContent>
+                 </Select>
+               </div>

-                 <Badge variant="secondary">{kpi.key}</Badge>
+                 <Badge variant="secondary">{kpi.selectedKpiSlug || kpi.key}</Badge>
```

### 2. ScorecardFormBuilder.tsx
```diff
- import { useKpis } from "@/hooks/useKpis";
+ import { useAgencyKpis } from "@/hooks/useKpis";

- // Load KPIs dynamically based on role - temporarily disabled to prevent 404s
- const kpiData = null;
- const kpisLoading = false;
- const kpisError = null;
- const refetch = () => {};
+ // Load KPIs and scorecard rules
+ const { data: agencyKpis = [], isLoading: kpisLoading, error: kpisError, refetch } = useAgencyKpis(agencyId);
+ 
+ // Load scorecard rules for preselected KPIs
+ const [scorecardRules, setScorecardRules] = useState<{ selected_metrics?: string[] } | null>(null);
+ 
+ useEffect(() => {
+   const loadScorecardRules = async () => {
+     if (!agencyId) return;
+     
+     const { data } = await supabase
+       .from('scorecard_rules')
+       .select('selected_metrics, selected_metric_slugs')
+       .eq('agency_id', agencyId)
+       .eq('role', formSchema.role)
+       .single();
+       
+     setScorecardRules(data);
+   };
+   
+   loadScorecardRules();
+ }, [agencyId, formSchema.role]);

+ const updateKpiSelection = (index: number, kpiId: string, slug: string, label: string) => {
+   const updatedKPIs = [...formSchema.kpis];
+   updatedKPIs[index] = { 
+     ...updatedKPIs[index], 
+     selectedKpiId: kpiId,
+     selectedKpiSlug: slug,
+     label: label // Update label to match selected KPI
+   };
+   setFormSchema(prev => ({ ...prev, kpis: updatedKPIs }));
+ };

                <KPIFieldManager 
                  kpis={formSchema.kpis}
+                 availableKpis={agencyKpis}
                  onUpdateLabel={updateKPILabel}
                  onToggleRequired={toggleKPIRequired}
                  onUpdateType={updateKPIType}
                  onUpdateTarget={updateKPITarget}
+                 onUpdateKpiSelection={updateKpiSelection}
                  onAddField={addKPIField}
                  onRemoveField={removeKPIField}
                />
```

## Form Schema Changes

The form schema now stores KPI selections:

```json
{
  "title": "Sales Scorecard",
  "role": "Sales",
  "kpis": [
    {
      "key": "kpi_1725925800000_outbound_calls",
      "label": "Outbound Calls",
      "required": true,
      "type": "number",
      "selectedKpiId": "848cee27-f56f-4f87-ba4e-75bc9e063d33",
      "selectedKpiSlug": "outbound_calls",
      "target": { "minimum": 0, "goal": 100, "excellent": 150 }
    },
    {
      "key": "kpi_1725925800001_sold_items", 
      "label": "Policies Sold",
      "required": true,
      "type": "number",
      "selectedKpiId": "9d656270-fe03-4860-97f8-a95a72801ba6",
      "selectedKpiSlug": "sold_items",
      "target": { "minimum": 0, "goal": 2, "excellent": 5 }
    }
  ]
}
```

## Submission Mapping

When a form is submitted, the payload will map values to metric keys using `selectedKpiSlug`:

```json
{
  "kpiValues": {
    "outbound_calls": 150,
    "sold_items": 3
  },
  "work_date": "2025-09-09"
}
```