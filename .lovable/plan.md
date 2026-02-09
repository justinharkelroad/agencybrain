

## Add Help Button to RingCentral Report Upload

**What**: Add the existing Help button next to the "RingCentral Report Upload" heading on the My Agency > Settings tab, using the video key `Ringcentral_automation` that you just configured.

**Where**: The RingCentral upload section header in `src/components/RingCentralReportUpload.tsx`, lines 228-237.

### Changes

**File: `src/components/RingCentralReportUpload.tsx`**

1. Import the `HelpButton` component at the top of the file.
2. In the `CardHeader`, add the `HelpButton` next to the title/description block. The layout will become a flex row with the icon+title on the left and the Help button pushed to the right using `flex-1` or `ml-auto`.

The updated header structure will look like:

```text
[Icon] [Title + Description]                    [Help Button]
```

### Technical Details

- Import: `import { HelpButton } from '@/components/HelpButton';`
- Component: `<HelpButton videoKey="Ringcentral_automation" />`
- Add `items-start` to the outer flex container and wrap the existing content + HelpButton with proper spacing
- The HelpButton auto-hides if no content is found in the `help_videos` table, so it's safe to always render

Only one file is modified. No database or backend changes needed since the help video record already exists.

