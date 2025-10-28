# Google Drive File Permissions in Ferdinand

This document describes how Ferdinand's role-based access control system applies to imported Google Drive files.

## Overview

When users import files from Google Drive into Ferdinand, the files become assets within Ferdinand's asset management system. These assets are subject to Ferdinand's role-based permission model, which defines what each user role can do with the imported files.

## Permission Model

### Ferdinand Ownership

When a Drive file is imported:

1. **The importing user becomes the owner** (`uploadedBy` field) in Ferdinand
2. The file's original Drive owner is stored as metadata for reference
3. Ferdinand ownership determines edit/delete permissions for Standard users

### Role-Based Access Control

Ferdinand has five user roles with different permission levels:

| Role         | View | Edit | Delete | Share | Import |
|--------------|------|------|--------|-------|--------|
| Guest        | ✓*   | ✗    | ✗      | ✗     | ✗      |
| Standard     | ✓    | ✓**  | ✗      | ✗     | ✓      |
| Editor       | ✓    | ✓    | ✗      | ✓     | ✓      |
| Admin        | ✓    | ✓    | ✓      | ✓     | ✓      |
| Super Admin  | ✓    | ✓    | ✓      | ✓     | ✓      |

\* Guests can only view files marked as "shared"
\** Standard users can only edit files they imported

## Detailed Role Permissions

### Guest Role

**Philosophy**: Read-only access to shared content

- **View**: Can view files ONLY if the file's visibility is set to "shared" in Ferdinand
- **Import**: Cannot import Drive files
- **Edit**: Cannot edit any files
- **Delete**: Cannot delete any files
- **Share**: Cannot create public sharing links

**Use Case**: External stakeholders, clients, or temporary collaborators who need to view but not modify content.

### Standard Role

**Philosophy**: Self-service content creator with limited scope

- **View**: Can view ALL files in their assigned client(s)
- **Import**: Can import Drive files (becomes Ferdinand owner)
- **Edit**: Can ONLY edit files they imported themselves (`uploadedBy` matches their user ID)
- **Delete**: Cannot delete any files
- **Share**: Cannot create public sharing links

**Use Case**: Content creators, team members who contribute assets but should not modify others' work.

**Important**: A Standard user who imports a file owns it in Ferdinand, even if they weren't the owner in Google Drive.

### Editor Role

**Philosophy**: Content manager with broad editing rights

- **View**: Can view ALL files in their assigned client(s)
- **Import**: Can import Drive files
- **Edit**: Can edit ALL files in their client(s), regardless of who imported them
- **Delete**: Cannot delete files (requires Admin)
- **Share**: Can create public sharing links for files

**Use Case**: Content managers, senior team members who need to organize and curate all content.

### Admin Role

**Philosophy**: Full control over client content

- **View**: Can view ALL files
- **Import**: Can import Drive files
- **Edit**: Can edit ALL files
- **Delete**: Can delete ANY file (soft delete)
- **Share**: Can create and manage public sharing links

**Use Case**: Client administrators who manage all aspects of the client's content.

### Super Admin Role

**Philosophy**: System-wide administrator

- **View**: Can view ALL files across ALL clients
- **Import**: Can import Drive files
- **Edit**: Can edit ALL files across ALL clients
- **Delete**: Can delete ANY file
- **Share**: Can create and manage public sharing links

**Use Case**: System administrators, agency owners who have global access.

## Drive Sharing Metadata

Ferdinand stores Google Drive sharing metadata with each imported file for reference and potential future synchronization:

### Stored Metadata

```typescript
{
  isShared: boolean;              // Whether the file was shared in Drive
  isOwnedByImporter: boolean;     // Whether importing user owned it in Drive
  driveOwner: string;             // Email/name of Drive file owner
  hasPublicLink: boolean;         // Whether Drive file has public link
  importerDriveRole: string;      // Drive permission level (owner/writer/reader)
  importedAt: string;             // ISO timestamp of import
}
```

### Initial Visibility

When a file is imported, its initial Ferdinand visibility is determined as:

- **"shared"**: Default for all imports (can be changed by users with appropriate permissions)
- This allows imported files to be visible to the team by default

Users with write permissions can later change the visibility to "private" if needed.

## Permission Enforcement

### API Endpoint Protection

All file asset API endpoints enforce permissions at multiple levels:

1. **Authentication**: User must be authenticated (session-based)
2. **Client Access**: User must be associated with the client
3. **Role Check**: User's role must allow the requested action
4. **Ownership Check**: For Standard users, verify ownership for write/delete
5. **Visibility Check**: For Guests, verify file is shared

### Import Restrictions

The `/api/google-drive/import` endpoints include role checks:

```typescript
// Guests cannot import files
if (user.role === UserRole.GUEST) {
  return res.status(403).json({
    message: "Guests cannot import files"
  });
}
```

### Upload Restrictions

Similar restrictions apply to direct file uploads - Guests cannot upload files.

## Permission Check Examples

### Example 1: Guest Viewing a File

```typescript
User Role: GUEST
Action: READ
File Visibility: shared
Result: ALLOWED ✓

User Role: GUEST
Action: READ
File Visibility: private
Result: DENIED ✗ (Guests can only view shared files)
```

### Example 2: Standard User Editing a File

```typescript
User Role: STANDARD
Action: WRITE
File Owner: User ID 123
Current User: User ID 123
Result: ALLOWED ✓ (Owns the file)

User Role: STANDARD
Action: WRITE
File Owner: User ID 456
Current User: User ID 123
Result: DENIED ✗ (Can only edit own files)
```

### Example 3: Editor Editing Any File

```typescript
User Role: EDITOR
Action: WRITE
File Owner: User ID 456
Current User: User ID 123
Result: ALLOWED ✓ (Editors can edit all files)
```

### Example 4: Admin Deleting a File

```typescript
User Role: ADMIN
Action: DELETE
File Owner: Any user
Current User: Admin user
Result: ALLOWED ✓ (Admins can delete any file)

User Role: EDITOR
Action: DELETE
Result: DENIED ✗ (Editors cannot delete)
```

## Implementation Details

### Permission Checking Service

The `drive-file-permissions.ts` service provides functions for checking permissions:

```typescript
import { checkDriveFilePermission } from './drive-file-permissions';

const check = checkDriveFilePermission(
  userId,
  userRole,
  'write',
  {
    uploadedBy: assetOwnerId,
    visibility: 'shared',
    isGoogleDrive: true,
  }
);

if (!check.allowed) {
  return res.status(403).json({ message: check.reason });
}
```

### Integration with Existing Asset Permissions

The Drive file permission model is built on top of the existing `asset-permissions.ts` service, which already handles:

- Role-based permission matrix
- Ownership checking
- Visibility filtering

The Drive-specific logic adds:

- Import permission checking
- Drive metadata consideration
- Initial permission assignment on import

## Security Considerations

1. **Backend Enforcement**: All permission checks happen on the backend
2. **Multiple Layers**: Authentication → Client access → Role → Ownership → Visibility
3. **Drive Metadata**: Stored for reference only, not used for enforcing permissions
4. **Ownership Precedence**: Ferdinand ownership (uploadedBy) takes precedence over Drive ownership
5. **Soft Deletes**: Deleted files are soft-deleted, not permanently removed

## Future Enhancements

Potential future improvements to the permission system:

1. **Permission Sync**: Synchronize Ferdinand permissions when Drive sharing changes
2. **Custom Roles**: Allow clients to define custom roles with specific permissions
3. **Per-File Permissions**: Override role permissions for specific files
4. **Share Groups**: Create groups of users with shared access to file collections
5. **Audit Logging**: Track who accesses, edits, or deletes Drive files

## Testing

Permission enforcement should be tested for:

1. **Each role**: Verify each role's permissions work as specified
2. **Edge cases**: Files with no owner, deleted users, etc.
3. **Role transitions**: User role changes mid-session
4. **Import scenarios**: Various Drive sharing states during import
5. **Visibility changes**: Changing file visibility and access impact

## SUPER_ADMIN Global Linking and Import

### Overview

SUPER_ADMIN users have special privileges for Google Drive integration that allow them to:

1. **Link Google Drive globally** from the dashboard without being tied to a specific client
2. **Import files into any client** without requiring a userClients association
3. **Bypass client access restrictions** while maintaining security for other user roles

### SUPER_ADMIN Privileges

#### Global Drive Connection
- SUPER_ADMIN can link Google Drive from dashboard using `/api/auth/google/url`
- Connection is stored globally and not tied to any specific client
- Connection status is available across all clients and pages
- OAuth callback handling triggers token refresh and status refetch globally

#### Import Bypass Mechanism
- SUPER_ADMIN can import into any client without userClients entry
- Backend checks `user.role !== UserRole.SUPER_ADMIN` before enforcing client access
- Audit logs still record the correct uploader userId (SUPER_ADMIN's ID)
- Import target is always the current client being viewed

#### UI Indicators
- Dashboard shows "Link your Google Drive" control for SUPER_ADMIN only
- Brand Asset Manager shows connection status and target client for SUPER_ADMIN
- Connected account email is displayed: "Google Drive Connected (user@example.com)"
- Target client display: "Files will import into [Current Client Name]"

### Implementation Details

#### Backend Changes
```typescript
// In server/routes/google-drive.ts - POST /api/google-drive/import
if (user.role !== UserRole.SUPER_ADMIN) {
  const [userClient] = await db.select()...;
  if (!userClient) {
    return res.status(403).json({ message: "Not authorized for this client" });
  }
}
```

#### Frontend Changes
```typescript
// Dashboard shows Drive connect control for SUPER_ADMIN
{user.role === 'super_admin' && (
  <GoogleDriveConnect variant="dashboard" />
)}

// Asset Manager shows connection status for SUPER_ADMIN
{user.role === 'super_admin' && driveConnection && (
  <div>
    Google Drive Connected ({driveConnection.email})
    Files will import into {currentClient.name}
  </div>
)}
```

### Security Considerations

#### Audit Logging
- All imports record uploader's userId accurately
- clientId is always the target client, not the SUPER_ADMIN's default client
- Import timestamps and file details are preserved
- No audit trail is lost due to SUPER_ADMIN bypass

#### Permission Isolation
- Non-super_admin users still require userClients association
- Regular admin permissions are unchanged
- No security bypasses are introduced for other roles
- SUPER_ADMIN privileges are role-based, not user-based

#### Error Handling
- Token refresh works globally for SUPER_ADMIN
- Connection errors are handled gracefully
- Import failures don't expose sensitive information
- Rate limiting still applies to SUPER_ADMIN

### Usage Examples

#### SUPER_ADMIN Workflow
1. Login as SUPER_ADMIN
2. Navigate to dashboard
3. Click "Link your Google Drive"
4. Complete OAuth flow
5. Navigate to any client's Brand Assets page
6. See "Google Drive Connected" indicator
7. Click "Import from Drive"
8. Select files from Google Picker
9. Files import into current client

#### Regular Admin Workflow (Unchanged)
1. Login as Regular Admin
2. Navigate to client's Brand Assets page
3. No "Link your Google Drive" control on dashboard
4. If Drive is connected by SUPER_ADMIN, can import
5. If not connected, cannot link (no permission)
6. Import requires userClients association

## References

- `server/services/drive-file-permissions.ts` - Permission logic implementation
- `server/services/asset-permissions.ts` - Base asset permission service
- `server/routes/google-drive.ts` - Drive import endpoints with SUPER_ADMIN bypass
- `server/routes/file-assets.ts` - Asset CRUD endpoints
- `shared/schema.ts` - User roles and asset schema definitions
- `docs/google-drive-import-qa-checklist.md` - QA testing procedures
