# Google Scholar Authentication Enforcement - Implementation Attempt

**Date:** December 22, 2025
**Status:** ❌ Discontinued - Post-Login Redirect Failed
**Author:** Claude Code (AI Assistant)

---

## Overview

This document records an attempted implementation of user authentication enforcement before allowing Google Scholar external searches in the filter-assist-panel component. The implementation successfully redirected unauthenticated users to the Primo login page, but the post-login restoration workflow failed.

---

## Objective

To enforce user authentication before performing Google Scholar external searches, with the following workflow:

1. **Interception**: When user clicks "Google Scholar" button, intercept the click
2. **Auth Check**: Check if user is authenticated in Primo
3. **Scenario A (Authenticated)**: Immediately open Google Scholar in new tab
4. **Scenario B (Not Authenticated)**:
   - Persist search intent in sessionStorage
   - Redirect to Primo login page
5. **Post-Login Restoration**: After successful login, show "Continue to Google Scholar" button

---

## Technical Implementation

### Architecture

**Authentication Check:** NGRX Store selectors reading Primo's `user.isLoggedIn` state
**Session Persistence:** sessionStorage with 5-minute TTL
**Login Redirect:** Standard Primo login URL: `/discovery/login?vid=972TAU_INST:NDE`
**Anti-Popup Blocker:** User-initiated button click (not automatic window.open)

### Files Created

#### 1. `/src/app/custom1-module/filter-assist-panel/state/user-auth.selectors.ts`

NGRX selectors for accessing Primo's user authentication state:

```typescript
import { createFeatureSelector, createSelector } from '@ngrx/store';

export interface UserState {
  isLoggedIn: boolean;
}

export const selectUserFeature = createFeatureSelector<UserState>('user');
export const selectIsLoggedIn = createSelector(
  selectUserFeature,
  (state: UserState) => state.isLoggedIn
);
```

**Purpose:** Type-safe access to Primo's centralized user auth state via NGRX store

#### 2. `/src/app/custom1-module/filter-assist-panel/services/pending-search.service.ts`

Service to manage pending searches across login redirect:

**Key Features:**
- Save/retrieve pending searches in sessionStorage
- Auto-expire after 5 minutes
- Storage key: `tau_pending_scholar_search`
- Error handling for private browsing mode

**Methods:**
- `savePendingSearch(url: string, language: 'en' | 'he'): void`
- `getPendingSearch(): PendingScholarSearch | null`
- `clearPendingSearch(): void`
- `hasPendingSearch(): boolean`

### Files Modified

#### 3. `/src/app/custom1-module/filter-assist-panel/filter-assist-panel.component.ts`

**Added Imports:**
```typescript
import { Store } from '@ngrx/store';
import { selectIsLoggedIn } from './state/user-auth.selectors';
import { PendingSearchService } from './services/pending-search.service';
```

**Added Properties:**
```typescript
isLoggedIn = this.store.selectSignal(selectIsLoggedIn);
pendingScholarSearch: { url: string; language: 'en' | 'he' } | null = null;
```

**Updated Constructor:**
```typescript
constructor(
  private searchQueryService: SearchQueryService,
  private registry: FilterAssistPanelRegistryService,
  private store: Store,
  private pendingSearchService: PendingSearchService
) {}
```

**Updated ngOnInit:** Added pending search restoration logic

**New Methods Added:**
1. `isGoogleScholar(source: SearchTarget): boolean`
2. `onExternalSearchClick(event: MouseEvent, source: SearchTarget): void`
3. `completePendingSearch(): void`
4. `dismissPendingSearch(): void`
5. `get continueToScholarText(): string`
6. `get dismissText(): string`

#### 4. `/src/app/custom1-module/filter-assist-panel/filter-assist-panel.component.html`

**Added:** Pending search notification UI with "Continue" and "Dismiss" buttons
**Modified:** Added click handler `(click)="onExternalSearchClick($event, source)"` to anchor tags

#### 5. `/src/app/custom1-module/filter-assist-panel/filter-assist-panel.component.scss`

**Added:** ~150 lines of CSS for:
- Pending search notification styling
- Primary and secondary button styles
- RTL support
- Dark mode compatibility
- Mobile responsive design

---

## Implementation Results

### ✅ What Worked

1. **Authentication Check:** Successfully accessed Primo's NGRX store to read user login status
2. **Click Interception:** Successfully intercepted Google Scholar link clicks
3. **Login Redirect:** Successfully redirected unauthenticated users to Primo login page
4. **Session Storage:** Successfully persisted search intent in sessionStorage
5. **Build Success:** Code compiled without TypeScript errors

### ❌ What Failed

**Post-Login Restoration Did Not Work:**

After successful Primo login, the following issues occurred:

1. **Pending search not restored:** The component's `ngOnInit()` logic did not detect the pending search from sessionStorage
2. **"Continue to Google Scholar" button did not appear:** The UI notification was never displayed
3. **sessionStorage data may not have persisted:** Possible issue with Primo's post-login redirect flow clearing session data

**Possible Root Causes:**

1. **Page Navigation During Login:** Primo's SSO login flow may involve full page navigation that clears sessionStorage
2. **Origin Mismatch:** sessionStorage is origin-scoped; if login redirects through different domain, data is lost
3. **Component Lifecycle Issue:** The component may not re-initialize properly after login redirect
4. **NGRX Store Timing:** The `isLoggedIn` state may not be available immediately when component initializes
5. **View Refresh:** Primo may perform a full application reload that clears custom module state

---

## Technical Insights Gained

### NGRX Store Integration
- ✅ Primo's NGRX store structure: `{ user: { isLoggedIn: boolean } }`
- ✅ Using Angular 18 signals: `this.store.selectSignal(selectIsLoggedIn)` works correctly
- ✅ Store is accessible in custom components via dependency injection

### Primo Login Flow
- ✅ Login URL pattern: `https://tau.primo.exlibrisgroup.com/discovery/login?vid=972TAU_INST:NDE`
- ❌ Post-login redirect behavior incompatible with sessionStorage persistence
- ❓ Unknown: Whether Primo provides a post-login callback or event hook

### sessionStorage Limitations
- ✅ Works for short-term state within same browsing session
- ❌ May not survive full page reloads during SSO authentication
- ❌ Not reliable for cross-navigation state persistence in Primo

---

## Alternative Approaches (Not Implemented)

### 1. URL Parameter Persistence
Instead of sessionStorage, append pending search data to URL as query parameter:
```
/discovery/login?vid=972TAU_INST:NDE&returnUrl=/nde/search&pendingScholar=true
```

**Pros:** Survives page reloads
**Cons:** Sensitive to URL length limits, requires URL parsing

### 2. Backend Cookie Storage
Store pending search in server-side cookie during login flow:

**Pros:** Survives page navigation
**Cons:** Requires backend integration, cookie management

### 3. Primo Event Hooks
Listen for Primo's post-login event (if available):

**Pros:** Proper integration point
**Cons:** Requires Primo SDK documentation on available hooks

### 4. LocalStorage Instead of SessionStorage
Store pending search in localStorage (persists longer):

**Pros:** Survives page reloads
**Cons:** Persists too long, potential privacy issue

### 5. Remove Authentication Requirement
Simply open Google Scholar without checking authentication:

**Pros:** Works reliably, no complex state management
**Cons:** Doesn't meet original requirement of enforcing authentication

---

## Lessons Learned

1. **sessionStorage Unreliable for SSO Flows:** Full page navigation during SSO authentication may clear sessionStorage
2. **Component Lifecycle in Micro Frontends:** Custom module components may not reinitialize predictably after external redirects
3. **Limited Control Over Host Application:** Custom modules have limited visibility into Primo's internal navigation and state management
4. **Need for Primo SDK Documentation:** Official documentation on post-login hooks or state restoration patterns would help

---

## Recommendation

**This approach is not viable** for the following reasons:

1. Post-login state restoration unreliable in Primo's micro-frontend architecture
2. No documented hooks or callbacks for post-authentication workflows
3. sessionStorage insufficient for cross-navigation persistence
4. Alternative approaches (URL params, cookies) would require backend changes

**Suggested Alternative:**

**Option A:** Remove authentication requirement entirely - allow all users to access Google Scholar
- Simplest solution
- No state management issues
- Works reliably

**Option B:** Investigate Primo's Add-On API for post-login hooks
- May provide proper integration points
- Requires access to full Primo SDK documentation

**Option C:** Server-side implementation
- Backend service to manage pending searches
- Requires infrastructure changes

---

## Code Removal Checklist

To restore the previous state, the following must be removed:

- [x] `/src/app/custom1-module/filter-assist-panel/state/user-auth.selectors.ts` (delete file)
- [x] `/src/app/custom1-module/filter-assist-panel/services/pending-search.service.ts` (delete file)
- [x] `/src/app/custom1-module/filter-assist-panel/state/` directory (delete)
- [x] Revert `filter-assist-panel.component.ts` to git HEAD
- [x] Revert `filter-assist-panel.component.html` to git HEAD
- [x] Revert `filter-assist-panel.component.scss` to git HEAD

---

## References

**Research Sources:**
- [ExLibris customModule Repository](https://github.com/ExLibrisGroup/customModule)
- [Primo VE Authentication Config](https://knowledge.exlibrisgroup.com/Primo/Product_Documentation/020Primo_VE/Primo_VE_(English)/070Authentication_Configuration/010Configuring_User_Authentication_for_Primo_VE)
- Web search: Primo VE NDE authentication patterns

**Implementation Plan:**
- `/home/hagaybar/.claude/plans/delegated-imagining-penguin.md`

**Date Implemented:** December 22, 2025
**Date Removed:** December 22, 2025
**Duration:** Same day implementation and removal

---

## Conclusion

This implementation successfully demonstrated:
- ✅ Ability to access Primo's NGRX store from custom components
- ✅ Ability to intercept link clicks and redirect to login
- ✅ TypeScript type-safe patterns for state management

However, it failed to achieve the core objective due to:
- ❌ Incompatibility between sessionStorage and Primo's login flow
- ❌ Lack of reliable post-login state restoration mechanism
- ❌ Limited integration points in custom module architecture

**Final Status:** Feature discontinued and code reverted to previous state.
