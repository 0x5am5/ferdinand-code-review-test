# Ferdinand Design System Builder - Figma Plugin Integration Strategy

## Executive Summary
This document outlines the strategy for integrating a bidirectional Figma plugin into Ferdinand that enables seamless design token synchronization, versioning, and rollback capabilities between Ferdinand and Figma design files.

## Current State Analysis

### Existing Ferdinand Infrastructure
- **Design Token System**: Raw and semantic token generation already implemented in `server/routes/design-system.ts`
- **Database**: PostgreSQL with Drizzle ORM, includes Figma connection tables
- **Authentication**: Firebase Auth with role-based permissions
- **Multi-tenancy**: Client-based isolation with feature toggles
- **API Architecture**: Express.js REST endpoints with TypeScript

### Gaps to Address
- No versioning system for design tokens
- Limited Figma sync capabilities (pull only, no push)
- No token mapping configuration
- No rollback functionality
- No change tracking or audit logs
- Missing Figma plugin implementation

## Implementation Phases

### Phase 1: Database & Version Control Foundation ✅ (Partially Complete)
**Status**: Schema added, storage methods implemented

#### Completed:
- ✅ Added `designSystemVersions` table for version snapshots
- ✅ Added `designSystemChanges` table for change tracking
- ✅ Added `figmaTokenMappings` table for token mapping configuration
- ✅ Updated storage.ts with versioning methods
- ✅ Created design-tokens.ts API routes

#### Remaining:
- [ ] Run database migrations
- [ ] Test version creation and retrieval
- [ ] Implement change diffing algorithm improvements

### Phase 2: Enhanced API Layer (Week 1-2)

#### 2.1 Token Management APIs
- **Enhance `/api/design-system/tokens`** endpoints:
  - Unified token retrieval with version support
  - Batch token updates with automatic versioning
  - Token comparison between versions
  - Export tokens in multiple formats (CSS, SCSS, JSON)

#### 2.2 Figma Sync Enhancement
- **New endpoints**:
  - `POST /api/figma/push-tokens` - Push tokens to Figma
  - `GET /api/figma/preview-changes` - Preview changes before sync
  - `POST /api/figma/resolve-conflicts` - Handle sync conflicts
  - `GET /api/figma/mapping-suggestions` - AI-powered mapping suggestions

#### 2.3 Version Management
- **Endpoints**:
  - `GET /api/design-system/compare/:v1/:v2` - Compare versions
  - `POST /api/design-system/merge` - Merge version changes
  - `GET /api/design-system/export/:versionId` - Export specific version

### Phase 3: Figma Plugin Development (Week 2-3)

#### 3.1 Plugin Architecture
```
figma-plugin/
├── manifest.json           # Plugin configuration
├── src/
│   ├── code.ts            # Main plugin logic (runs in sandbox)
│   ├── ui.tsx             # React UI (runs in iframe)
│   ├── api/
│   │   ├── client.ts      # Ferdinand API client
│   │   ├── auth.ts        # Authentication handling
│   │   └── sync.ts        # Sync operations
│   ├── utils/
│   │   ├── tokenMapper.ts # Token conversion utilities
│   │   ├── figmaHelpers.ts # Figma API helpers
│   │   └── validation.ts  # Data validation
│   └── components/
│       ├── TokenImport.tsx
│       ├── TokenExport.tsx
│       ├── MappingConfig.tsx
│       └── VersionHistory.tsx
├── webpack.config.js
└── package.json
```

#### 3.2 Core Features
1. **Authentication**
   - API key-based auth with Ferdinand
   - Store credentials securely in Figma client storage
   - Session management and token refresh

2. **Import Flow**
   - Select Ferdinand client/project
   - Choose token categories to import
   - Preview changes before applying
   - Map Ferdinand tokens to Figma variables/styles
   - Apply tokens with undo support

3. **Export Flow**
   - Detect Figma styles and variables
   - Map to Ferdinand token structure
   - Preview changes with diff view
   - Push with version message
   - Handle conflicts gracefully

4. **Mapping Configuration**
   - Visual token mapping interface
   - Save mapping presets per client
   - Auto-detect common patterns
   - Support for unit conversions

### Phase 4: Token Mapping System (Week 3-4)

#### 4.1 Automatic Mapping Rules
```typescript
interface TokenMappingRule {
  source: 'ferdinand' | 'figma';
  sourcePattern: string; // e.g., "colors.brand*"
  targetPattern: string; // e.g., "Brand/{name}"
  transformation?: {
    type: 'unit' | 'format' | 'scale';
    config: Record<string, any>;
  };
}
```

#### 4.2 Transformation Engine
- **Unit conversions**: rem ↔ px, HSL ↔ HEX
- **Scale mappings**: Type scale ratios to fixed sizes
- **Naming conventions**: camelCase ↔ kebab-case
- **Structure flattening/nesting**: Nested tokens ↔ flat structure

#### 4.3 Conflict Resolution
- **Strategies**:
  - Ferdinand wins (default for push)
  - Figma wins (default for pull)
  - Manual resolution with side-by-side comparison
  - Merge changes (non-conflicting only)

### Phase 5: UI Integration in Ferdinand (Week 4-5)

#### 5.1 Version History Page
```typescript
// client/src/pages/design-system/versions.tsx
- Version timeline with visual indicators
- Change summary cards
- Rollback buttons with confirmation
- Export version functionality
- Compare versions side-by-side
```

#### 5.2 Figma Connection Manager
```typescript
// client/src/pages/integrations/figma.tsx
- Connect/disconnect Figma files
- View sync status and history
- Configure mapping rules
- Trigger manual syncs
- View sync logs and errors
```

#### 5.3 Design Token Editor Enhancement
- Add version indicator
- Show last sync status
- Quick rollback to previous version
- Preview changes before saving
- Collaboration indicators

### Phase 6: Testing & Security (Week 5-6)

#### 6.1 Test Coverage
```typescript
// Tests to implement
- Unit tests for token conversion logic
- Integration tests for API endpoints
- E2E tests for sync workflows
- Plugin UI tests with Figma API mocks
- Performance tests for large token sets
```

#### 6.2 Security Measures
- API rate limiting (100 requests/minute)
- Token encryption in database
- Audit logging for all changes
- Permission checks at API level
- Input validation and sanitization
- CORS configuration for plugin

### Phase 7: Advanced Features (Week 6-7)

#### 7.1 Slack Integration
- Webhook endpoints for notifications
- Configurable notification rules
- Change summary formatting
- @mention support for reviewers

#### 7.2 Collaboration Features
- Change proposals with approval workflow
- Comments on token changes
- Team notifications
- Branching for experiments

#### 7.3 Analytics & Insights
- Token usage tracking
- Most changed tokens report
- Sync frequency metrics
- Error rate monitoring

## Technical Specifications

### API Authentication
```typescript
// Header-based authentication
headers: {
  'X-API-Key': 'ferdinand_api_key',
  'X-Client-ID': 'client_id'
}
```

### Token Format
```typescript
interface DesignToken {
  id: string;
  path: string; // e.g., "colors.brand.primary"
  value: any;
  type: 'color' | 'typography' | 'spacing' | 'shadow' | 'border';
  metadata?: {
    description?: string;
    deprecated?: boolean;
    figmaId?: string;
  };
}
```

### Sync Protocol
```typescript
interface SyncRequest {
  direction: 'push' | 'pull' | 'bidirectional';
  tokens: DesignToken[];
  mapping: TokenMappingRule[];
  conflictResolution: 'ferdinand_wins' | 'figma_wins' | 'manual';
  versionInfo: {
    name?: string;
    description?: string;
    isSnapshot?: boolean;
  };
}
```

## Migration Strategy

### Step 1: Preserve Existing Functionality
- Keep current design-system.ts endpoints operational
- Run new system in parallel initially
- Gradual migration of clients to new system

### Step 2: Data Migration
```sql
-- Migrate existing tokens to versioned system
INSERT INTO design_system_versions (client_id, raw_tokens, semantic_tokens, ...)
SELECT client_id, raw_tokens, semantic_tokens, ...
FROM existing_theme_data;
```

### Step 3: Feature Flag Rollout
```typescript
if (client.featureToggles.figmaIntegration) {
  // Use new versioned system
} else {
  // Use legacy system
}
```

## Risk Mitigation

### Technical Risks
| Risk | Mitigation |
|------|------------|
| Data loss during sync | Automatic backups before each sync |
| API rate limits | Implement caching and batch operations |
| Plugin compatibility | Support Figma API v1 with graceful degradation |
| Large token sets | Pagination and lazy loading |

### Business Risks
| Risk | Mitigation |
|------|------------|
| User adoption | Comprehensive documentation and tutorials |
| Breaking changes | Semantic versioning and deprecation notices |
| Sync conflicts | Clear UI for conflict resolution |

## Success Metrics

### Technical KPIs
- Sync success rate > 99%
- API response time < 500ms (p95)
- Zero data loss incidents
- Plugin crash rate < 0.1%

### Business KPIs
- 80% of design teams using bidirectional sync within 3 months
- 50% reduction in design-dev handoff time
- 90% user satisfaction score
- 30% reduction in design inconsistencies

## Timeline

### Week 1-2: Foundation
- Complete API enhancements
- Implement version diffing
- Set up plugin development environment

### Week 3-4: Core Plugin
- Build Figma plugin UI
- Implement token import/export
- Create mapping configuration

### Week 5-6: Integration
- Connect plugin to Ferdinand API
- Implement conflict resolution
- Add version history UI

### Week 7-8: Polish & Launch
- Comprehensive testing
- Documentation
- Beta testing with select clients
- Production deployment

## Dependencies

### External
- Figma Plugin API (v1)
- Figma REST API
- Firebase Auth
- PostgreSQL
- Slack API (Phase 2)

### Internal
- Design system team buy-in
- API infrastructure scaling
- Database migration approval
- Security review completion

## Open Questions

1. **Token Naming Convention**: Should we enforce a specific naming pattern?
2. **Version Retention**: How many versions to keep? Implement archiving?
3. **Permissions**: Should viewers be able to trigger syncs?
4. **Branching**: Support multiple design system branches?
5. **External Tools**: Support for other design tools beyond Figma?

## Next Steps

1. **Immediate** (This Week):
   - [ ] Finalize plugin UI mockups
   - [ ] Complete API endpoint testing
   - [ ] Set up Figma plugin development environment
   - [ ] Create plugin prototype

2. **Short Term** (Next 2 Weeks):
   - [ ] Implement core plugin functionality
   - [ ] Build token mapping UI
   - [ ] Create comprehensive test suite
   - [ ] Begin documentation

3. **Medium Term** (Next Month):
   - [ ] Beta testing with internal team
   - [ ] Gather feedback and iterate
   - [ ] Performance optimization
   - [ ] Security audit

## Appendix

### A. File Structure Changes
```
ferdinand/
├── figma-plugin/          # New plugin directory
├── server/
│   ├── routes/
│   │   ├── design-tokens.ts    # New unified token API
│   │   └── figma-sync.ts       # Enhanced sync endpoints
│   └── services/
│       └── token-mapper.ts     # Token conversion service
├── client/src/
│   ├── pages/
│   │   ├── design-system/
│   │   │   └── versions.tsx    # Version history UI
│   │   └── integrations/
│   │       └── figma.tsx        # Figma connection manager
│   └── components/
│       └── design-system/
│           └── version-timeline.tsx
└── shared/
    └── types/
        └── design-tokens.ts     # Shared token types
```

### B. Database Schema Summary
- `design_system_versions` - Store complete token snapshots
- `design_system_changes` - Track individual changes
- `figma_token_mappings` - Configure token mappings
- Enhanced `figma_connections` - Additional sync metadata
- Enhanced `figma_sync_logs` - Detailed sync history

### C. API Endpoint Summary
```
POST   /api/design-system/tokens
GET    /api/design-system/tokens/:clientId
GET    /api/design-system/versions/:clientId
POST   /api/design-system/rollback/:versionId
POST   /api/design-system/snapshot
GET    /api/design-system/compare/:v1/:v2

POST   /api/figma/push-tokens
POST   /api/figma/pull-tokens
GET    /api/figma/preview-changes
POST   /api/figma/resolve-conflicts
GET    /api/figma/token-mappings
POST   /api/figma/token-mappings
```

---

*This strategy document will be updated as implementation progresses and new requirements emerge.*