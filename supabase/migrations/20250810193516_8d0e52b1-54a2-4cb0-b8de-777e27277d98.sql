-- Fix seeding of global default checklist items without relying on ON CONFLICT for expression index
INSERT INTO public.checklist_template_items (agency_id, label, required, order_index, active)
SELECT NULL, 'Agency Handbook', true, 10, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.checklist_template_items WHERE agency_id IS NULL AND lower(label) = lower('Agency Handbook')
);

INSERT INTO public.checklist_template_items (agency_id, label, required, order_index, active)
SELECT NULL, 'W-4', true, 20, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.checklist_template_items WHERE agency_id IS NULL AND lower(label) = lower('W-4')
);

INSERT INTO public.checklist_template_items (agency_id, label, required, order_index, active)
SELECT NULL, 'Accountability Policy', true, 30, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.checklist_template_items WHERE agency_id IS NULL AND lower(label) = lower('Accountability Policy')
);

INSERT INTO public.checklist_template_items (agency_id, label, required, order_index, active)
SELECT NULL, 'Daily Metrics', true, 40, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.checklist_template_items WHERE agency_id IS NULL AND lower(label) = lower('Daily Metrics')
);

INSERT INTO public.checklist_template_items (agency_id, label, required, order_index, active)
SELECT NULL, 'Consequence Policy', true, 50, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.checklist_template_items WHERE agency_id IS NULL AND lower(label) = lower('Consequence Policy')
);

INSERT INTO public.checklist_template_items (agency_id, label, required, order_index, active)
SELECT NULL, 'New Hire Document', true, 60, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.checklist_template_items WHERE agency_id IS NULL AND lower(label) = lower('New Hire Document')
);