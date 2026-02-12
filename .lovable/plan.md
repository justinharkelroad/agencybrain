

## Fix Build Errors: Remove Unknown `gateReturnPath` Prop

These errors are **not** related to the 6-week challenge. They come from `gateReturnPath` being passed to two sidebar components (`SidebarNavItem` and `SidebarSubFolder`) whose TypeScript interfaces don't include that prop. The simplest fix is to remove the prop from the call sites since neither component uses it internally.

### Changes

**1. `src/components/AppSidebar.tsx`** -- Remove `gateReturnPath` from three locations:
- Line 551: Remove `gateReturnPath={gateReturnPath}` from `<SidebarSubFolder>`
- Line 590: Remove `gateReturnPath={gateReturnPath}` from nested `<SidebarNavItem>`
- Line 620: Remove `gateReturnPath={gateReturnPath}` from top-level `<SidebarNavItem>`

**2. `src/components/sales/BreakupLetterModal.tsx`** -- Line 126: Replace `.replaceAll(...)` with `.replace(/pattern/g, ...)` to fix the ES2021 compatibility error.

### Why This Is Safe

- Neither `SidebarNavItem` nor `SidebarSubFolder` reference `gateReturnPath` in their code -- the prop was being passed but ignored.
- The `.replaceAll` fix is a standard JS compatibility pattern with identical behavior.

