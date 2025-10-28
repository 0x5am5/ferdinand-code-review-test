# Master Admin Google Drive Import — Plan and Implementation Notes

Goal
- Allow a master admin (super_admin) who links their Google Drive globally (from the dashboard) to import assets via the Brand Assets page into whichever client/brand they are currently viewing. No code changes will be made now — this document captures the plan, required checks, and implementation steps.

Summary of current behavior
- The brand asset manager component [`client/src/components/brand/asset-manager.tsx:52`] currently imports Google Drive files by calling the import API with the `clientId` passed to the component.
- Google Drive connection endpoints and import logic live in [`server/routes/google-drive.ts`].
- Server-side permission checks are enforced in code paths such as [`server/routes/google-drive.ts`] and helper utilities in [`server/services/asset-permissions.ts`].

Key findings from code inspection
- The import endpoint (`POST /api/google-drive/import`) requires `clientId` in the request body and verifies the requesting user has an entry in `userClients` for that client (server/routes/google-drive.ts:224-244). This prevents non-associated users from importing into clients.
- The role-based permissions allow SUPER_ADMIN to perform write operations (server/services/asset-permissions.ts:13-19 and 66-75).
- Because the import route checks `userClients` membership, a super_admin will currently be blocked unless they also have a `userClients` record for the target client.
- The brand asset UI already passes the current clientId on import (client/src/components/brand/asset-manager.tsx:203-205).
- OAuth/token flow for Google Drive exists and returns user-scoped connections (`/api/google-drive/status`, `/api/google-drive/token` — server/routes/google-drive.ts). The frontend uses `useGoogleDriveConnectionQuery` and `useGoogleDriveTokenQuery`.

Decision / Desired UX (confirmed)
- A master admin's Drive link is global across all clients.
- When a master admin is viewing a specific client's Brand Assets page, the import should land in that viewed client (import target = current clientId).
- No per-client association is required at link time.

Implementation plan (high level)
1. Server permission update (required)
   - Modify the import route to allow super_admins to bypass the `userClients` membership check for the target client.
   - Safely: after fetching the user role, only perform the `userClients` check if user.role !== SUPER_ADMIN.
   - Keep the current behavior for non-super_admin users unchanged.

2. Ensure Google Drive connection visibility
   - Confirm current queries (`client/src/lib/queries/google-drive.ts`) return the master admin's connection when requested from different pages (dashboard and brand asset pages). They already query by session userId, so a linked account should be available globally for that user.
   - If necessary, ensure token refresh and status refetch are triggered after OAuth redirect regardless of which page initiated the link.

3. Frontend UX changes (small)
   - Dashboard: Provide a clear control for master admins to link their Google Drive globally (reuse `client/src/components/assets/google-drive-connect.tsx`). This component should launch the existing OAuth flow (`/api/auth/google/url`) and persist connection server-side.
   - Brand Asset Manager:
     - Keep import logic as-is (it passes current clientId).
     - Add a UI indicator for master admins when a Google Drive connection exists, showing the connected account (email) and a note: "Files will import into [current client name]".
     - Ensure OAuth callback handling triggers token refetch; consider centralizing callback handling into a shared hook or top-level layout so linking from dashboard gets reflected without needing to open a client's asset page.

4. Tests and QA
   - Add/adjust tests:
     - Backend unit/integration test for `/api/google-drive/import` verifying super_admin can import into arbitrary client without `userClients` row.
     - Test that non-super_admins without `userClients` entry get 403.
     - Frontend tests for the import flow: linking, token retrieval, opening picker, posting imports (mock SSE).
   - Manual QA checklist:
     1. As super_admin, link Google Drive from Dashboard.
     2. Navigate to Client A's Brand Assets page; open Drive Picker; import assets — confirm assets saved under Client A.
     3. Navigate to Client B; import — confirm assets saved under Client B.
     4. As admin (not super_admin) without membership for Client C, verify import into Client C is blocked.
     5. Verify audit fields show the uploader userId as the master admin.

5. Documentation
   - Update `docs/drive-file-permissions.md` to describe master admin global linking behavior and where imports will land.
   - Add a short note in the Dashboard UI copy explaining "Linking here will allow you to import assets into any client when viewing its Brand Assets page."

Files to inspect or modify (priority)
- server/routes/google-drive.ts (import handler)
- server/services/asset-permissions.ts (verify or fix logic related to user-client checks elsewhere)
- client/src/pages/dashboard.tsx (add Drive-link UI, reuse existing connect component)
- client/src/components/brand/asset-manager.tsx (add UI indicator showing connected account + import target client name)
- client/src/lib/queries/google-drive.ts (confirm queries)
- tests/ (add/modify tests around drive import)
- docs/drive-file-permissions.md (update docs)

Exact backend code change (conceptual patch)
- In `server/routes/google-drive.ts` inside POST `/api/google-drive/import`:
  - After fetching `user` (lines ~212–221), wrap the user-client check with a role guard:

  ```
  if (user.role !== UserRole.SUPER_ADMIN) {
    const [userClient] = await db.select()...
    if (!userClient) {
      return res.status(403).json({ message: "Not authorized for this client" });
    }
  }
  ```

  - No changes to import processing logic otherwise.

Security considerations
- Allowing super_admin bypass is appropriate for a master admin role, but ensure audit logs record who performed imports.
- Keep existing validations on uploaded files (size, type) and rate limits in place.
- Ensure SSE responses and import errors do not leak sensitive data.

UX copy suggestions
- On Dashboard linking control: "Link your Google Drive — allows importing files into any client from its Brand Assets page."
- On Brand Asset Manager header for linked super_admin: "Connected Drive: [email@example.com]. Files imported here will be saved to Client: [Client Name]."

Estimated effort
- Backend change + tests: 1–2 hours
- Frontend small UX changes + tests: 1–2 hours
- Manual QA + docs: 0.5–1 hour

Next steps (if you want me to proceed later)
- I will switch to code mode and:
  - Apply the server route change (small, targeted).
  - Add the frontend UI indicator.
  - Add/modify tests.
  - Run unit tests (if CI is available) and provide results.

No code changes have been made in this step. This file documents the proposed plan and exact patch needed when you approve edits.
