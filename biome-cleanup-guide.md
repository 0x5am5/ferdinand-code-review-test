# Biome Cleanup Strategy

## Current Status
- **640 errors** and **278 warnings** detected across 137 files
- Issues include: unused imports, explicit `any` types, import organization, and accessibility violations

## Available Commands

### Linting & Formatting
```bash
npm run lint           # Check for linting issues
npm run lint:fix       # Auto-fix linting issues where possible
npm run format         # Format code style
npm run check:biome    # Run all Biome checks (lint + format)
npm run check:biome:fix # Auto-fix all fixable issues
```

### TypeScript
```bash
npm run check          # TypeScript type checking
```

## Gradual Cleanup Strategy

### Phase 1: Auto-fixable Issues (Start Here)
Run these commands to automatically fix the easiest issues:

```bash
# Fix all auto-fixable issues at once
npm run check:biome:fix

# Or step by step:
npm run format         # Fix formatting issues
npm run lint:fix       # Fix linting issues
```

### Phase 2: File-by-File Cleanup
For remaining issues that require manual fixes, work on files in priority order:

#### High Priority (Core Files)
1. `shared/schema.ts` - Core types and validation
2. `server/index.ts` - Main server entry
3. `client/src/App.tsx` - Main app component

#### Medium Priority (Pages)
4. Authentication: `client/src/pages/login.tsx`
5. Dashboard: `client/src/pages/dashboard.tsx`
6. Users: `client/src/pages/users.tsx`
7. Clients: `client/src/pages/clients.tsx`

#### Lower Priority (Components)
8. UI Components: `client/src/components/ui/*`
9. Layout Components: `client/src/components/layout/*`
10. Feature Components: `client/src/components/brand/*`

### Phase 3: Specific Issue Types

#### Fix `any` Types
Search for explicit `any` usage and replace with proper types:
```bash
# Find all any usage
npm run lint 2>&1 | grep "noExplicitAny"
```

#### Fix Unused Imports/Variables
```bash
# Auto-fix most unused imports
npm run lint:fix
```

#### Fix Accessibility Issues
Manual fixes needed for:
- Missing alt text on images
- Missing keyboard event handlers
- Interactive elements without proper roles

## Working on Specific Files

To check a specific file:
```bash
npx biome check path/to/file.tsx
```

To fix a specific file:
```bash
npx biome check --write path/to/file.tsx
```

## Best Practices

1. **Start with auto-fixes**: Always run `npm run check:biome:fix` first
2. **One file at a time**: Focus on completely fixing one file before moving to the next
3. **Check types**: Run `npm run check` after each file to ensure TypeScript compliance
4. **Test changes**: Ensure the app still works after each batch of fixes
5. **Commit frequently**: Make small commits for each completed file or logical group

## Progress Tracking

Create a checklist and mark files as completed:
- [ ] shared/schema.ts
- [ ] server/index.ts  
- [ ] client/src/App.tsx
- [ ] client/src/pages/login.tsx
- [ ] client/src/pages/dashboard.tsx
- [ ] (continue with other files...)

## Quick Wins

Some issues can be batch-fixed across multiple files:
- Import organization: `npm run check:biome:fix`
- Unused imports: `npm run lint:fix`  
- Code formatting: `npm run format`

This approach lets you make steady progress without overwhelming changes.