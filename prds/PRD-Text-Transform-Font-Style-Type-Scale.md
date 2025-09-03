
# PRD: Text Transform and Font Style Customizations for Type Scale Builder

## 1. Problem Statement & Goals

### Problem
The current Type Scale Manager allows users to customize font family, font weight, letter spacing, color, and font size for individual typography elements. However, it lacks support for two important typography properties:
- **Text Transform** (uppercase, lowercase, capitalize, none)
- **Font Style** (normal, italic, oblique) and **Text Decoration** (none, underline, overline, line-through)

This limitation prevents users from creating complete typography systems that require case transformations (like all-caps headings) or italic styles for emphasis.

### Goals
1. Add text-transform customization options to both header and body type styles
2. Expand font-style options beyond the current basic implementation
3. Add text-decoration options for comprehensive styling
4. Ensure all new customizations work seamlessly with:
   - Live preview in TypeScalePreview component
   - Save/load functionality
   - CSS/SCSS export functionality
   - Individual header and body style customizations

## 2. Technical Scope

### Components to Modify
1. **Type Scale Manager** (`client/src/components/type-scale/type-scale-manager.tsx`)
2. **Type Scale Preview** (`client/src/components/type-scale/type-scale-preview.tsx`)
3. **Shared Schema** (`shared/schema.ts`)
4. **Backend Export Functions** (`server/routes/type-scales.ts`)

### New Properties to Add

#### Text Transform Options
- `none` - No transformation
- `uppercase` - ALL CAPS
- `lowercase` - all lowercase
- `capitalize` - Title Case

#### Font Style Options (Enhanced)
- `normal` - Regular text
- `italic` - Italic text
- `oblique` - Oblique text

#### Text Decoration Options (Enhanced)
- `none` - No decoration
- `underline` - Underlined text
- `overline` - Overlined text
- `line-through` - Strikethrough text

## 3. User Interface Design

### Individual Customization Panels
For both header and body customization panels, add three new form controls:

1. **Text Transform Dropdown**
   - Label: "Text Transform"
   - Options: None, Uppercase, Lowercase, Capitalize
   - Default: Inherits from parent

2. **Font Style Dropdown** (Enhanced)
   - Label: "Font Style"
   - Options: Normal, Italic, Oblique
   - Default: Inherits from parent

3. **Text Decoration Dropdown** (Enhanced)
   - Label: "Text Decoration"
   - Options: None, Underline, Overline, Line Through
   - Default: Inherits from parent

### Reset Functionality
Each new property should have individual reset buttons that remove the custom value and revert to inherited behavior.

## 4. Technical Implementation

### Schema Updates
Update `IndividualHeaderStyle` and `IndividualBodyStyle` interfaces to include:
```typescript
interface IndividualHeaderStyle {
  fontFamily?: string;
  fontWeight?: string;
  letterSpacing?: number;
  color?: string;
  fontSize?: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  fontStyle?: 'normal' | 'italic' | 'oblique';
  textDecoration?: 'none' | 'underline' | 'overline' | 'line-through';
}
```

### Preview Integration
Update the `getStyleForLevel` function in TypeScalePreview to apply new properties:
```typescript
if (individualStyle?.textTransform) baseStyle.textTransform = individualStyle.textTransform;
if (individualStyle?.fontStyle) baseStyle.fontStyle = individualStyle.fontStyle;
if (individualStyle?.textDecoration) baseStyle.textDecoration = individualStyle.textDecoration;
```

### CSS Export Enhancement
Update CSS generation functions to include new properties in exported stylesheets.

## 5. Data Flow

### Save Process
1. User selects text transform/font style/text decoration in UI
2. `updateIndividualHeaderStyle` or `updateIndividualBodyStyle` called with new properties
3. Properties stored in component state
4. On save, properties included in mutation payload
5. Backend stores properties in database JSON fields

### Load Process
1. Type scale data loaded from database
2. Individual style properties mapped to component state
3. UI controls populated with existing values
4. Preview updated with applied styles

## 6. Acceptance Criteria

### Functional Requirements
- [ ] Users can set text-transform for any header level (h1-h6)
- [ ] Users can set text-transform for any body level (body-large, body, body-small, etc.)
- [ ] Users can set font-style for individual elements
- [ ] Users can set text-decoration for individual elements
- [ ] Preview immediately reflects text-transform, font-style, and text-decoration changes
- [ ] Reset buttons work for each new property
- [ ] Properties persist when saved and reloaded
- [ ] CSS export includes new properties
- [ ] SCSS export includes new properties

### UI/UX Requirements
- [ ] New controls follow existing design patterns
- [ ] Controls are properly labeled and accessible
- [ ] Reset functionality is intuitive
- [ ] Changes are immediately visible in preview
- [ ] Form validation prevents invalid values

### Technical Requirements
- [ ] Database schema supports new properties
- [ ] Type safety maintained throughout
- [ ] No breaking changes to existing functionality
- [ ] Performance remains acceptable
- [ ] Error handling for malformed data

## 7. Testing Strategy

### Unit Tests
- Validate schema updates
- Test save/load functionality
- Test CSS generation with new properties

### Integration Tests
- Test complete user workflow
- Test export functionality
- Test preview updates

### Manual Testing
- Test all text-transform options
- Test all font-style options
- Test all text-decoration options
- Test reset functionality
- Test persistence across sessions

## 8. Implementation Plan

### Phase 1: Schema Updates
1. Update TypeScript interfaces
2. Update database handling
3. Test data persistence

### Phase 2: UI Implementation
1. Add form controls to customization panels
2. Implement update functions
3. Add reset functionality

### Phase 3: Preview Integration
1. Update preview component
2. Test visual rendering
3. Ensure real-time updates

### Phase 4: Export Enhancement
1. Update CSS generation
2. Update SCSS generation
3. Test exported files

### Phase 5: Testing & Polish
1. Comprehensive testing
2. Bug fixes
3. Documentation updates

## 9. Risk Mitigation

### Potential Risks
- **Performance Impact**: Adding more style properties could slow preview rendering
  - *Mitigation*: Use React.memo and efficient re-rendering strategies

- **CSS Conflicts**: Text decoration and transform might conflict with existing styles
  - *Mitigation*: Proper CSS specificity and testing

- **Browser Compatibility**: Some text-transform or font-style values might not work everywhere
  - *Mitigation*: Use widely supported CSS properties

### Rollback Plan
- Feature flags to disable new functionality if issues arise
- Database migration rollback procedures
- Component-level feature toggles

## 10. Success Metrics

- Users can successfully create typography systems with case transformations
- All new properties work correctly in preview and export
- No performance degradation in type scale management
- Zero critical bugs in production
- Positive user feedback on enhanced customization options

## 11. Future Enhancements

- Global text-transform settings for headers/body
- Advanced typography properties (text-shadow, word-spacing)
- Typography animation support
- Import/export of typography presets
