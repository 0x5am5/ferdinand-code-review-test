# Google Drive Import - Manual QA Checklist

This checklist provides step-by-step instructions for manually validating the end-to-end import flow and permission enforcement for the SUPER_ADMIN bypass functionality.

## Prerequisites

- [ ] **Test Environment Setup**
  - [ ] Server running on `http://localhost:3001`
  - [ ] Database with test data available
  - [ ] Test users created:
    - [ ] SUPER_ADMIN user (e.g., `superadmin@test.com`)
    - [ ] Regular ADMIN user (e.g., `admin@test.com`)
    - [ ] STANDARD user (e.g., `standard@test.com`)
  - [ ] Test clients created:
    - [ ] Client A (accessible to regular admin)
    - [ ] Client B (not accessible to regular admin)
  - [ ] Google Drive test files available in test account

## Test Scenarios

### 1. SUPER_ADMIN Global Linking and Import

#### 1.1 Link Drive as SUPER_ADMIN from Dashboard
- [ ] **Login as SUPER_ADMIN user**
  - [ ] Navigate to dashboard (`/dashboard`)
  - [ ] Verify "Link your Google Drive" control is visible
  - [ ] Verify UX copy: "Link your Google Drive — allows importing files into any client from its Brand Assets page."
  - [ ] Click "Link your Google Drive" button
  - [ ] Verify OAuth redirect to Google
  - [ ] Complete OAuth flow in Google
  - [ ] Verify redirect back to application
  - [ ] Verify success message/toast appears
  - [ ] Verify Drive connection status shows as connected

#### 1.2 Import Assets into Client A
- [ ] **Navigate to Client A Brand Assets page**
  - [ ] Verify Drive connection indicator shows: "Google Drive Connected"
  - [ ] Verify connected account email is displayed
  - [ ] Verify target client display: "Files will import into [Client A name]"
  - [ ] Click "Import from Drive" button
  - [ ] Verify Google Picker opens
  - [ ] Select test files (at least 2-3 different file types)
  - [ ] Click "Select" in picker
  - [ ] Monitor import progress via SSE/events
  - [ ] Verify progress updates show for each file
  - [ ] Verify completion message shows correct counts
  - [ ] Verify imported files appear in Client A assets list
  - [ ] Verify files are assigned to Client A (not wrong client)

#### 1.3 Import Assets into Client B
- [ ] **Navigate to Client B Brand Assets page**
  - [ ] Verify Drive connection indicator still shows: "Google Drive Connected"
  - [ ] Verify target client display: "Files will import into [Client B name]"
  - [ ] Click "Import from Drive" button
  - [ ] Verify Google Picker opens
  - [ ] Select different test files
  - [ ] Click "Select" in picker
  - [ ] Monitor import progress
  - [ ] Verify completion message
  - [ ] Verify imported files appear in Client B assets list
  - [ ] Verify files are assigned to Client B (not Client A)

### 2. Non-SUPER_ADMIN Permission Enforcement

#### 2.1 Regular Admin with Valid Client Access
- [ ] **Login as Regular ADMIN user**
  - [ ] Navigate to Client A Brand Assets page (client they have access to)
  - [ ] Verify "Link your Google Drive" control is NOT visible (should only show for SUPER_ADMIN)
  - [ ] If Drive is already connected by SUPER_ADMIN, verify connection indicator shows
  - [ ] Click "Import from Drive" button
  - [ ] Verify Google Picker opens
  - [ ] Select test files
  - [ ] Click "Select" in picker
  - [ ] Monitor import progress
  - [ ] Verify import completes successfully
  - [ ] Verify imported files appear in Client A assets list

#### 2.2 Regular Admin with Invalid Client Access
- [ ] **Attempt to import into Client B (no userClients entry)**
  - [ ] Navigate to Client B Brand Assets page
  - [ ] Click "Import from Drive" button
  - [ ] Verify Google Picker opens
  - [ ] Select test files
  - [ ] Click "Select" in picker
  - [ ] **Expected**: Import fails with "Not authorized for this client" error
  - [ ] Verify error message is clear and user-friendly
  - [ ] Verify no files are imported
  - [ ] Verify error is logged appropriately

#### 2.3 Standard User Permission Test
- [ ] **Login as STANDARD user**
  - [ ] Navigate to any client Brand Assets page
  - [ ] Verify import functionality is appropriately restricted
  - [ ] Attempt import and verify proper permission handling

### 3. Audit Logging Verification

#### 3.1 SUPER_ADMIN Import Audit
- [ ] **Check audit logs for SUPER_ADMIN imports**
  - [ ] Import files into Client A as SUPER_ADMIN
  - [ ] Check database/audit logs:
    - [ ] Verify uploader userId is SUPER_ADMIN's ID
    - [ ] Verify clientId is correctly recorded (Client A)
    - [ ] Verify timestamp is accurate
    - [ ] Verify file details are logged
  - [ ] Import files into Client B as SUPER_ADMIN
  - [ ] Check audit logs:
    - [ ] Verify uploader userId is still SUPER_ADMIN's ID
    - [ ] Verify clientId is correctly recorded (Client B)
    - [ ] Verify timestamp is accurate

#### 3.2 Regular Admin Import Audit
- [ ] **Check audit logs for Regular Admin imports**
  - [ ] Import files into Client A as Regular Admin
  - [ ] Check database/audit logs:
    - [ ] Verify uploader userId is Regular Admin's ID
    - [ ] Verify clientId is correctly recorded (Client A)
    - [ ] Verify timestamp is accurate

### 4. Security and Error Handling

#### 4.1 Token Expiry Handling
- [ ] **Test token refresh scenarios**
  - [ ] Wait for token to expire (or manually expire in database)
  - [ ] Attempt import as SUPER_ADMIN
  - [ ] Verify automatic token refresh occurs
  - [ ] Verify import succeeds after refresh
  - [ ] Verify user sees appropriate loading/refresh indicators

#### 4.2 Connection Error Handling
- [ ] **Test connection failure scenarios**
  - [ ] Disconnect Google Drive
  - [ ] Attempt import
  - [ ] Verify "Google Drive authentication required" error
  - [ ] Verify error handling is graceful
  - [ ] Verify user can re-connect

#### 4.3 Network Error Handling
- [ ] **Test network interruption scenarios**
  - [ ] Start import and disconnect network
  - [ ] Verify appropriate error handling
  - [ ] Verify partial imports are handled correctly
  - [ ] Verify user can retry import

### 5. File Type and Size Validation

#### 5.1 Supported File Types
- [ ] **Test various file types**
  - [ ] Import PDF files - verify success
  - [ ] Import image files (PNG, JPG) - verify success
  - [ ] Import document files (DOC, DOCX) - verify success
  - [ ] Import unsupported file types - verify appropriate rejection

#### 5.2 File Size Limits
- [ ] **Test file size validation**
  - [ ] Import small files (< 1MB) - verify success
  - [ ] Import large files (approaching limit) - verify success
  - [ ] Import oversized files - verify appropriate rejection
  - [ ] Verify error messages are clear

### 6. Performance and Scalability

#### 6.1 Large Batch Imports
- [ ] **Test importing multiple files**
  - [ ] Import 10+ files simultaneously
  - [ ] Monitor memory usage and performance
  - [ ] Verify all files are processed
  - [ ] Verify progress updates are responsive
  - [ ] Verify completion time is reasonable

#### 6.2 Concurrent User Operations
- [ ] **Test multiple users importing simultaneously**
  - [ ] Have SUPER_ADMIN import to Client A
  - [ ] Have Regular Admin import to Client A (if they have access)
  - [ ] Verify operations don't interfere with each other
  - [ ] Verify audit logs correctly track each user

## Expected Results Documentation

### Success Criteria
- [ ] **SUPER_ADMIN can import into any client**
  - [ ] No userClients entry required
  - [ ] Import succeeds for any client
  - [ ] Correct clientId is used for asset assignment

- [ ] **Non-SUPER_ADMIN permissions enforced**
  - [ ] Regular users blocked without userClients entry
  - [ ] Clear error messages provided
  - [ ] No security bypasses possible

- [ ] **Audit logging accurate**
  - [ ] Uploader userId always recorded correctly
  - [ ] ClientId always recorded correctly
  - [ ] Timestamps are accurate
  - [ ] File details are preserved

### Error Handling
- [ ] **Graceful failure handling**
  - [ ] Network errors don't crash system
  - [ ] Authentication errors are clear
  - [ ] Permission errors are user-friendly
  - [ ] Recovery mechanisms work correctly

## Test Results Template

```
Test Environment:
- Server URL: http://localhost:3001
- Test Date: [DATE]
- Tester: [NAME]
- Browser: [BROWSER/VERSION]

Test Results:
✅ SUPER_ADMIN Global Linking: [PASS/FAIL] - [Notes]
✅ SUPER_ADMIN Import to Client A: [PASS/FAIL] - [Notes]
✅ SUPER_ADMIN Import to Client B: [PASS/FAIL] - [Notes]
✅ Regular Admin Valid Client: [PASS/FAIL] - [Notes]
✅ Regular Admin Invalid Client: [PASS/FAIL] - [Notes]
✅ Audit Logging: [PASS/FAIL] - [Notes]
✅ Error Handling: [PASS/FAIL] - [Notes]
✅ Performance: [PASS/FAIL] - [Notes]

Issues Found:
1. [Description of issue]
   - Severity: [HIGH/MEDIUM/LOW]
   - Steps to reproduce: [Steps]
   - Expected behavior: [Description]
   - Actual behavior: [Description]
   - Suggested fix: [Description]

Screenshots:
- [Attach relevant screenshots for each test scenario]
```

## Additional Notes

### Browser Compatibility
- [ ] Test in Chrome (latest)
- [ ] Test in Firefox (latest)
- [ ] Test in Safari (latest)
- [ ] Test in Edge (latest)

### Mobile Responsiveness
- [ ] Test dashboard linking on mobile
- [ ] Test import flow on mobile
- [ ] Verify picker works on mobile devices

### Accessibility
- [ ] Verify keyboard navigation works
- [ ] Verify screen reader compatibility
- [ ] Verify color contrast ratios
- [ ] Verify focus management

## Completion Criteria

- [ ] All test scenarios executed
- [ ] All results documented
- [ ] Screenshots captured for failures
- [ ] Performance metrics recorded
- [ ] Accessibility verified
- [ ] Browser compatibility confirmed
- [ ] Issues documented with severity levels
- [ ] Ready for production deployment

---

**Instructions for QA Team:**

1. Complete each test scenario in order
2. Take screenshots of each step
3. Document any deviations from expected behavior
4. Note performance issues or UI glitches
5. Verify audit logs after each import test
6. Test error scenarios thoroughly
7. Report security concerns immediately

**Contact:** [QA Lead contact information]
**Escalation:** [Escalation path for critical issues]