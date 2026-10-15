# Tasks — Mobile-friendly layouts (Android + iOS)

Ordered. Each task is independently verifiable. Do not start until `spec.md` is approved.

## [x] T1 — Native appearance parity (P0)
- File: `app.json`
- Change: `expo.userInterfaceStyle` → `"automatic"`.
- Why: without it the dark theme can never apply on iOS/Android.
- Verify: `npx tsc --noEmit` unaffected; app still launches light.

## [x] T2 — Modal safe-area + keyboard (P0)
- Files: `components/ui/ModalSheet.tsx`, `components/ui/Picker.tsx`
- `ModalSheet`: `useSafeAreaInsets()`; header `paddingTop: insets.top + 16`;
  footer `paddingBottom: Math.max(insets.bottom, 16)`; wrap the `ScrollView` in
  `KeyboardAvoidingView` with `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`;
  `keyboardDismissMode="on-drag"` + `automaticallyAdjustKeyboardInsets` on iOS.
- `Picker`: same top inset on the modal chrome (`pt-4` → `insets.top`) and
  `insets.bottom + 24` under the option list; default trigger label becomes
  `flex-1` with `numberOfLines={1}`.
- Fixes callers: `more/sites.tsx` SiteEditor, `more/shop/index.tsx`
  (ProductDetail / Basket / Orders / Checkout sheets), `reports/new.tsx`
  (Category), `more/team-access.tsx` (Role/Site), `more/contracts.tsx` (Site).
- Verify: tsc; on web no visual change (insets 0); type into the site editor on a
  device later — footer stays above the keyboard.

## [x] T3 — More menu status-bar inset (P0)
- File: `app/(tabs)/more/index.tsx`
- `useSafeAreaInsets()`; ScrollView `contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 48) }}`.
- Verify: heading no longer under the status bar; web unchanged.

## [x] T4 — Assignments scrolls as one list (P0)
- File: `app/(tabs)/assignments.tsx`
- Replace the header `ScrollView` + sibling `FlatList` with a single `FlatList`;
  move heading + stat cards + `SearchField` + `FilterTabs` into `ListHeaderComponent`;
  FlatList `contentContainerClassName="grow px-5 pb-6 pt-4"`.
- Preserve: the `RefreshControl`, the `ListEmptyComponent` states, the role-scoped
  filtering, and `ReportCard` rendering exactly as today.
- Verify: tsc; web — with several assignments the last row is reachable by scrolling,
  pull-to-refresh still works.

## [x] T5 — Keyboard avoidance on form screens (P1)
- Files: `app/(tabs)/more/team-access.tsx`, `app/(tabs)/more/contracts.tsx`
- Wrap the existing `ScrollView` in `KeyboardAvoidingView`
  (`behavior={Platform.OS === 'ios' ? 'padding' : undefined}`,
  `className="flex-1"`), keep `keyboardShouldPersistTaps="handled"`, add
  `keyboardDismissMode="on-drag"` and iOS `automaticallyAdjustKeyboardInsets`.
- Verify: tsc; web unchanged; the submit CTA is reachable with the keyboard up on iOS.

## [x] T6 — Auth shell bottom inset (P1)
- File: `components/auth/AuthShell.tsx`
- `contentContainerStyle` sets `paddingBottom: Math.max(insets.bottom, 24)` and
  the footer drops its own `pb-6` so the bottom gap is padded once.
- Verify: tsc; footer clears the home indicator; web unchanged (inset 0 → 24, same as before).

## [x] T7 — Final check
- `npx tsc --noEmit -p tsconfig.json` from `Frontend/Mobile` passes (ran twice: before and after adding `className="flex-1"` to the Assignments FlatList).
- Web smoke: `/`, `/assignments` and `/more` all render their expected content with **zero console errors** and no red/blank screens.
- Scrolling could not be confirmed in the harness: the browser tool's viewport resolves to a 46px-high root with a 0px-tall scroll container, so wheel scrolling failed on the *unchanged* Home screen too. This is an environment artifact, not a regression from these edits.
- Native verification limitation: no iOS/Android device or simulator is available, so the inset/keyboard behaviour is established by code reasoning only (`useSafeAreaInsets` resolves inside `<Modal>` subtrees; every inset is 0 where edge-to-edge is off). Needs a device spot-check by the user.
