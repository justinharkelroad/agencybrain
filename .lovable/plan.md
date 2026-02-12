

## Add Category Cover Images to Standard Playbook

### What You'll See
Each training category card will get a rectangular image area at the top, inside a bordered card. The card will have a visible outline so each category feels distinct. You'll be able to upload images from the admin side, and they'll display for both admin users and staff/member views.

### Recommended Image Size
**1200 x 400 pixels** (3:1 ratio rectangle). This gives a wide banner-style image that looks great above the card content without being too tall. Any standard image editor or Canva template can produce this size.

### What Changes

**1. Database: Add `image_url` column to `sp_categories`**
- A new nullable text column to store the URL of the uploaded image.

**2. Storage: Use existing `training-assets` bucket**
- Images will be uploaded to the already-existing public `training-assets` Supabase storage bucket under a `category-images/` folder. No new bucket needed.

**3. Admin: Image upload on category create/edit form**
- On the admin category form (create new / edit existing), add a file upload field for the cover image.
- Show a preview of the current image if one exists, with the ability to replace it.
- On upload, the image goes to `training-assets/category-images/{categoryId}.{ext}` and the public URL is saved to `image_url`.

**4. User-facing cards: Display cover image**
- Both `TrainingHub.tsx` (member view) and `StaffSPTrainingHub.tsx` (staff view) will be updated.
- Each category card gets a bordered outline and the image displayed as a rectangle at the top of the card, with the existing content (icon, name, description, progress bar) below it.
- If no image is uploaded, the card still looks fine -- it just won't have the image area.

### Technical Details

**Migration SQL:**
```sql
ALTER TABLE sp_categories ADD COLUMN image_url text;
```

**Files to modify:**
- `src/pages/admin/AdminStandardPlaybook.tsx` -- update SPCategory interface, display image in admin list
- Admin category create/edit form (wherever that lives) -- add image upload input
- `src/pages/training/TrainingHub.tsx` -- add `image_url` to interface and query, render image in card
- `src/pages/staff/StaffSPTrainingHub.tsx` -- same changes for staff view

**Card layout (both views):**
```text
+----------------------------------+
|  [  rectangular cover image    ] |
|  (1200x400, rounded top corners) |
|----------------------------------|
|  icon  Title            chevron  |
|        Description               |
|        [====progress====] 0/25   |
+----------------------------------+
```

The card gets `border border-border` for a visible outline. Image uses `aspect-[3/1] object-cover rounded-t-lg` so it scales cleanly regardless of the exact upload dimensions.

