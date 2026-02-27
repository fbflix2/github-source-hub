

## Root Cause

`useAdminAuth` uses a `useRef(false)` guard (`checkedRef`) to ensure `checkAdmin` runs only once. However, in React 18 strict mode (dev), React mounts → unmounts → remounts. On remount, `checkedRef.current` is still `true` from the first mount (refs persist across strict mode cycles), so `checkAdmin` never executes on the second mount, and `loading` stays `true` permanently.

## Fix

**File: `src/hooks/useAdminAuth.ts`**

Reset `checkedRef.current = false` in the cleanup function so it can run again on remount:

```typescript
return () => {
  cancelled = true;
  checkedRef.current = false;  // <-- add this line
  subscription.unsubscribe();
};
```

This single line fix ensures the auth check runs correctly after React strict mode remount while still preventing duplicate concurrent checks.

