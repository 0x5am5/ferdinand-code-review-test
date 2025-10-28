# Google Drive Import - Manual QA Checklist

## Test Environment Setup
- **Server URL**: http://localhost:3001 ✅
- **Frontend URL**: http://localhost:3001 (integrated dev server) ✅
- **Test Date**: 2025-10-28
- **Tester**: [To be filled]
- **Browser**: [To be filled]
- **Server Status**: Running (PID 26982) ✅
- **Database**: Local PostgreSQL ✅

## Test Accounts
- **Super Admin Account**: [Email/ID to be filled]
- **Regular Admin Account**: [Email/ID to be filled]
- **Client A**: [Name/ID to be filled]
- **Client B**: [Name/ID to be filled]

---

## Subtask 8.1: Prepare test environment and link Google Drive as super_admin

### Status: ⏳ IN PROGRESS

### Pre-requisites:
- [ ] Server is running on port 3001
- [ ] Frontend is accessible
- [ ] Super admin account is created and accessible
- [ ] Google Drive test account is available

### Test Steps:
1. [ ] Login as super_admin
2. [ ] Navigate to dashboard
3. [ ] Locate Google Drive linking option
4. [ ] Initiate OAuth flow
5. [ ] Complete Google authentication
6. [ ] Verify Drive is linked successfully

### Expected Results:
- [ ] Dashboard shows Drive as linked
- [ ] No error messages during linking
- [ ] Connection status is visible in UI

### Screenshots/Evidence:
- [ ] Login screen
- [ ] Dashboard with Drive link option
- [ ] OAuth redirect screen
- [ ] Dashboard after successful linking
- [ ] Connection status indicators

### Notes/Observations:
- [ ] Timestamp of linking: [To be filled]
- [ ] Any errors encountered: [To be filled]
- [ ] Token refresh indicators: [To be filled]

---

## Subtask 8.2: Import assets into Client A and Client B as super_admin

### Status: ⏸️ PENDING

### Test Steps for Client A:
1. [ ] Navigate to Client A's asset management
2. [ ] Initiate Google Drive import
3. [ ] Select sample files for Client A
4. [ ] Confirm Client A is selected as target
5. [ ] Complete import process
6. [ ] Verify assets appear in Client A's asset list

### Test Steps for Client B:
1. [ ] Navigate to Client B's asset management
2. [ ] Initiate Google Drive import
3. [ ] Select different sample files for Client B
4. [ ] Confirm Client B is selected as target
5. [ ] Complete import process
6. [ ] Verify assets appear in Client B's asset list

### Expected Results:
- [ ] Assets are correctly assigned to Client A
- [ ] Assets are correctly assigned to Client B
- [ ] No cross-contamination between clients
- [ ] Import progress indicators work correctly

### Verification Methods:
- [ ] UI asset list verification
- [ ] Database query verification
- [ ] API response verification

### Screenshots/Evidence:
- [ ] File picker interface
- [ ] Import progress indicators
- [ ] Client A asset list after import
- [ ] Client B asset list after import
- [ ] Database records showing correct clientId

---

## Subtask 8.3: Validate non-super_admin cannot import to unassociated clients

### Status: ⏸️ PENDING

### Test Steps:
1. [ ] Login as regular admin (no client associations)
2. [ ] Attempt to import to Client A
3. [ ] Attempt to import to Client B
4. [ ] Try direct API call to import endpoint
5. [ ] Verify all attempts are blocked

### Expected Results:
- [ ] UI shows appropriate error messages
- [ ] API returns 403 Forbidden
- [ ] No assets are created in unassociated clients
- [ ] Error messages are user-friendly

### Screenshots/Evidence:
- [ ] Error messages in UI
- [ ] API response screenshots
- [ ] Network tab showing 403 responses
- [ ] Database verification showing no new assets

---

## Subtask 8.4: Verify audit fields record correct uploader userId

### Status: ⏸️ PENDING

### Test Steps:
1. [ ] Check audit fields for super_admin imports
2. [ ] Check audit fields for blocked attempts
3. [ ] Verify userId matches authenticated user
4. [ ] Check timestamps and other audit metadata

### Expected Results:
- [ ] uploader userId matches super_admin for successful imports
- [ ] Audit logs correctly record failed attempts
- [ ] Timestamps are accurate
- [ ] No orphaned audit records

### Verification Methods:
- [ ] Database query of audit fields
- [ ] API response inspection
- [ ] Log file analysis

### Screenshots/Evidence:
- [ ] Database records showing audit fields
- [ ] API responses with audit data
- [ ] Log entries showing user actions

---

## Subtask 8.5: Produce QA report with reproduction steps, evidence, and recommended fixes

### Status: ⏸️ PENDING

### Report Contents:
- [ ] Executive summary
- [ ] Test environment details
- [ ] Detailed test results
- [ ] Screenshots and evidence
- [ ] Pass/fail status per scenario
- [ ] Identified issues with severity
- [ ] Recommended fixes
- [ ] Retest requirements

### Deliverables:
- [ ] Complete QA report (markdown/PDF)
- [ ] All screenshots organized
- [ ] Test data and logs
- [ ] Bug tickets for any issues found

---

## Overall Test Summary

### Pass/Fail Status:
- Subtask 8.1: ⏳ IN PROGRESS
- Subtask 8.2: ⏸️ PENDING
- Subtask 8.3: ⏸️ PENDING
- Subtask 8.4: ⏸️ PENDING
- Subtask 8.5: ⏸️ PENDING

### Critical Issues Found:
- [ ] None identified yet

### Recommendations:
- [ ] Complete testing in order of dependencies
- [ ] Document all findings thoroughly
- [ ] Create bug tickets for any issues

### Sign-off:
- **QA Tester**: [Signature/Date]
- **Review Date**: [To be filled]