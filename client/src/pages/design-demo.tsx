import React, { useContext } from 'react';
import { ThemeContext } from '@/contexts/ThemeContext';
import { StyledButton } from '@/components/ui/styled-button';
import { Button } from '@/components/ui/button';
import { VariablesExporter } from '@/components/design-system/variables-exporter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { hexToHSL } from '@/utils/design-system-mapper';

/**
 * Design Demo Page
 * 
 * This page demonstrates how to use the SCSS modules and design system.
 */
const DesignDemo: React.FC = () => {
  const { 
    designSystem, 
    draftDesignSystem, 
    updateDraftDesignSystem, 
    resetDraftDesignSystem,
    applyDraftChanges,
    isDarkMode,
    toggleDarkMode
  } = useContext(ThemeContext);
  
  // Use the active design system (draft if available, otherwise current)
  const activeSystem = draftDesignSystem || designSystem;
  
  // Handle color change
  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateDraftDesignSystem({
      colors: {
        ...activeSystem.colors,
        primary: e.target.value,
      },
      theme: {
        ...activeSystem.theme,
        primary: e.target.value,
      }
    });
  };
  
  // Handle font change
  const handleFontChange = (field: keyof typeof activeSystem.typography) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    updateDraftDesignSystem({
      typography: {
        ...activeSystem.typography,
        [field]: e.target.value,
      },
    });
  };
  
  // Handle border radius change
  const handleRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateDraftDesignSystem({
      theme: {
        ...activeSystem.theme,
        radius: parseInt(e.target.value, 10),
      },
    });
  };
  
  // Handle theme variant change
  const handleVariantChange = (variant: 'professional' | 'tint' | 'vibrant') => {
    updateDraftDesignSystem({
      theme: {
        ...activeSystem.theme,
        variant,
      },
    });
  };
  
  // Apply changes
  const handleApplyChanges = async () => {
    await applyDraftChanges();
    alert('Design system changes applied!');
  };
  
  // Reset changes
  const handleResetChanges = () => {
    resetDraftDesignSystem();
  };
  
  // Convert hex to HSL for display
  const primaryHSL = hexToHSL(activeSystem.colors.primary);
  
  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-heading-1">Design System Demo</h1>
        <Button variant="outline" onClick={toggleDarkMode}>
          {isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Settings */}
        <div>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Design System Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="primary-color">Primary Color</Label>
                <div className="flex gap-2 mt-1">
                  <Input 
                    id="primary-color"
                    type="color" 
                    value={activeSystem.colors.primary} 
                    onChange={handleColorChange}
                    className="w-16"
                  />
                  <Input 
                    type="text" 
                    value={activeSystem.colors.primary}
                    onChange={handleColorChange}
                  />
                </div>
                <p className="text-caption mt-1">
                  HSL: {primaryHSL.h}°, {primaryHSL.s}%, {primaryHSL.l}%
                </p>
              </div>
              
              <div>
                <Label htmlFor="radius">Border Radius</Label>
                <div className="flex gap-2 items-center mt-1">
                  <Input 
                    id="radius"
                    type="range" 
                    min="0" 
                    max="24" 
                    value={activeSystem.theme.radius} 
                    onChange={handleRadiusChange}
                    className="flex-1"
                  />
                  <span className="text-sm w-8 text-right">{activeSystem.theme.radius}px</span>
                </div>
              </div>
              
              <div>
                <Label htmlFor="primary-font">Primary Font</Label>
                <Input 
                  id="primary-font"
                  type="text" 
                  value={activeSystem.typography.primary} 
                  onChange={handleFontChange('primary')}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="heading-font">Heading Font</Label>
                <Input 
                  id="heading-font"
                  type="text" 
                  value={activeSystem.typography.heading} 
                  onChange={handleFontChange('heading')}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label>Theme Variant</Label>
                <div className="flex gap-2 mt-1">
                  <Button 
                    size="sm" 
                    variant={activeSystem.theme.variant === 'professional' ? 'default' : 'outline'}
                    onClick={() => handleVariantChange('professional')}
                  >
                    Professional
                  </Button>
                  <Button 
                    size="sm" 
                    variant={activeSystem.theme.variant === 'tint' ? 'default' : 'outline'}
                    onClick={() => handleVariantChange('tint')}
                  >
                    Tint
                  </Button>
                  <Button 
                    size="sm" 
                    variant={activeSystem.theme.variant === 'vibrant' ? 'default' : 'outline'}
                    onClick={() => handleVariantChange('vibrant')}
                  >
                    Vibrant
                  </Button>
                </div>
              </div>
              
              <div className="pt-2 flex gap-2">
                <Button onClick={handleApplyChanges}>Apply Changes</Button>
                <Button variant="outline" onClick={handleResetChanges}>Reset</Button>
              </div>
            </CardContent>
          </Card>
          
          <VariablesExporter />
        </div>
        
        {/* Middle Column: Component Preview */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Button Components</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="text-heading-4 mb-2">Utility Class Buttons</h4>
                <div className="space-y-2">
                  <Button>Primary Button</Button>
                  <div className="flex gap-2">
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="destructive">Destructive</Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="link">Link Button</Button>
                    <Button disabled>Disabled</Button>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-heading-4 mb-2">SCSS Module Buttons</h4>
                <div className="space-y-2">
                  <StyledButton>Primary Button</StyledButton>
                  <div className="flex gap-2">
                    <StyledButton variant="secondary">Secondary</StyledButton>
                    <StyledButton variant="destructive">Destructive</StyledButton>
                  </div>
                  <div className="flex gap-2">
                    <StyledButton variant="ghost">Ghost Button</StyledButton>
                    <StyledButton disabled>Disabled</StyledButton>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Right Column: Typography Preview */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Typography Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h1 className="text-heading-1">Heading 1</h1>
                <p className="text-caption">Font: {activeSystem.typography.heading}</p>
              </div>
              
              <div>
                <h2 className="text-heading-2">Heading 2</h2>
                <p className="text-caption">Font: {activeSystem.typography.heading}</p>
              </div>
              
              <div>
                <h3 className="text-heading-3">Heading 3</h3>
                <p className="text-caption">Font: {activeSystem.typography.heading}</p>
              </div>
              
              <div>
                <h4 className="text-heading-4">Heading 4</h4>
                <p className="text-caption">Font: {activeSystem.typography.heading}</p>
              </div>
              
              <div>
                <p className="text-body-lg">Large Body Text</p>
                <p className="text-caption">Font: {activeSystem.typography.primary}</p>
              </div>
              
              <div>
                <p className="text-body-md">Medium Body Text</p>
                <p className="text-caption">Font: {activeSystem.typography.primary}</p>
              </div>
              
              <div>
                <p className="text-body-sm">Small Body Text</p>
                <p className="text-caption">Font: {activeSystem.typography.primary}</p>
              </div>
              
              <div>
                <p className="text-label">Label Text</p>
                <p className="text-caption">Font: {activeSystem.typography.primary}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DesignDemo;