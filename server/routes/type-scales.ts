import type { Express } from "express";
import { storage } from "../storage";
import { insertTypeScaleSchema, type InsertTypeScale } from "@shared/schema";
import { z } from "zod";

export function registerTypeScalesRoutes(app: Express) {
  // Get all type scales for a client
  app.get("/api/clients/:clientId/type-scales", async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      
      if (isNaN(clientId)) {
        return res.status(400).json({ error: "Invalid client ID" });
      }

      const typeScales = await storage.getClientTypeScales(clientId);
      res.json(typeScales);
    } catch (error) {
      console.error("Error fetching type scales:", error);
      res.status(500).json({ error: "Failed to fetch type scales" });
    }
  });

  // Get a specific type scale
  app.get("/api/type-scales/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid type scale ID" });
      }

      const typeScale = await storage.getTypeScale(id);
      
      if (!typeScale) {
        return res.status(404).json({ error: "Type scale not found" });
      }

      res.json(typeScale);
    } catch (error) {
      console.error("Error fetching type scale:", error);
      res.status(500).json({ error: "Failed to fetch type scale" });
    }
  });

  // Create a new type scale
  app.post("/api/clients/:clientId/type-scales", async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      
      if (isNaN(clientId)) {
        return res.status(400).json({ error: "Invalid client ID" });
      }

      // Validate the request body
      const validationResult = insertTypeScaleSchema.safeParse({
        ...req.body,
        clientId
      });

      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid type scale data",
          details: validationResult.error.errors
        });
      }

      const typeScale = await storage.createTypeScale(validationResult.data);
      res.status(201).json(typeScale);
    } catch (error) {
      console.error("Error creating type scale:", error);
      res.status(500).json({ error: "Failed to create type scale" });
    }
  });

  // Update a type scale
  app.patch("/api/type-scales/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid type scale ID" });
      }

      // Check if type scale exists
      const existingTypeScale = await storage.getTypeScale(id);
      if (!existingTypeScale) {
        return res.status(404).json({ error: "Type scale not found" });
      }

      // Validate the update data
      const updateSchema = insertTypeScaleSchema.partial().omit({ clientId: true });
      const validationResult = updateSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid update data",
          details: validationResult.error.errors
        });
      }

      const updatedTypeScale = await storage.updateTypeScale(id, validationResult.data);
      res.json(updatedTypeScale);
    } catch (error) {
      console.error("Error updating type scale:", error);
      res.status(500).json({ error: "Failed to update type scale" });
    }
  });

  // Delete a type scale
  app.delete("/api/type-scales/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid type scale ID" });
      }

      // Check if type scale exists
      const existingTypeScale = await storage.getTypeScale(id);
      if (!existingTypeScale) {
        return res.status(404).json({ error: "Type scale not found" });
      }

      await storage.deleteTypeScale(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting type scale:", error);
      res.status(500).json({ error: "Failed to delete type scale" });
    }
  });

  // Generate CSS export for a type scale
  app.post("/api/type-scales/:id/export/css", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid type scale ID" });
      }

      const typeScale = await storage.getTypeScale(id);
      if (!typeScale) {
        return res.status(404).json({ error: "Type scale not found" });
      }

      // Generate CSS from type scale
      const css = generateCSS(typeScale);
      
      // Update exports array
      const newExport = {
        format: "css" as const,
        content: css,
        fileName: `${typeScale.name.toLowerCase().replace(/\s+/g, '-')}-type-scale.css`,
        exportedAt: new Date().toISOString()
      };

      const updatedExports = [...(typeScale.exports || []), newExport];
      await storage.updateTypeScale(id, { exports: updatedExports });

      res.json({
        content: css,
        fileName: newExport.fileName,
        mimeType: "text/css"
      });
    } catch (error) {
      console.error("Error generating CSS export:", error);
      res.status(500).json({ error: "Failed to generate CSS export" });
    }
  });

  // Generate SCSS export for a type scale
  app.post("/api/type-scales/:id/export/scss", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid type scale ID" });
      }

      const typeScale = await storage.getTypeScale(id);
      if (!typeScale) {
        return res.status(404).json({ error: "Type scale not found" });
      }

      // Generate SCSS from type scale
      const scss = generateSCSS(typeScale);
      
      // Update exports array
      const newExport = {
        format: "scss" as const,
        content: scss,
        fileName: `${typeScale.name.toLowerCase().replace(/\s+/g, '-')}-type-scale.scss`,
        exportedAt: new Date().toISOString()
      };

      const updatedExports = [...(typeScale.exports || []), newExport];
      await storage.updateTypeScale(id, { exports: updatedExports });

      res.json({
        content: scss,
        fileName: newExport.fileName,
        mimeType: "text/scss"
      });
    } catch (error) {
      console.error("Error generating SCSS export:", error);
      res.status(500).json({ error: "Failed to generate SCSS export" });
    }
  });
}

// Helper function to calculate font size based on scale ratio and step
function calculateFontSize(baseSize: number, ratio: number, step: number, unit: string): string {
  const actualRatio = ratio / 1000; // Convert from stored integer format
  const size = Math.round(baseSize * Math.pow(actualRatio, step) * 100) / 100;
  return `${size}${unit}`;
}

// Helper function to generate CSS from type scale
function generateCSS(typeScale: any): string {
  const { baseSize, scaleRatio, unit, typeStyles } = typeScale;
  const actualRatio = scaleRatio / 1000;
  
  let css = `/* ${typeScale.name} Type Scale */\n\n`;
  css += `:root {\n`;
  css += `  --type-scale-base: ${baseSize}${unit};\n`;
  css += `  --type-scale-ratio: ${actualRatio};\n\n`;
  
  // Generate CSS custom properties for each type style
  typeStyles.forEach((style: any) => {
    const size = calculateFontSize(baseSize, scaleRatio, style.size, unit);
    css += `  --font-size-${style.level}: ${size};\n`;
  });
  
  css += `}\n\n`;
  
  // Generate utility classes
  typeStyles.forEach((style: any) => {
    const size = calculateFontSize(baseSize, scaleRatio, style.size, unit);
    css += `.text-${style.level} {\n`;
    css += `  font-size: var(--font-size-${style.level});\n`;
    css += `  font-weight: ${style.fontWeight};\n`;
    css += `  line-height: ${style.lineHeight};\n`;
    css += `  letter-spacing: ${style.letterSpacing}${unit === 'px' ? 'px' : 'em'};\n`;
    css += `  color: ${style.color};\n`;
    if (style.backgroundColor) {
      css += `  background-color: ${style.backgroundColor};\n`;
    }
    if (style.textDecoration) {
      css += `  text-decoration: ${style.textDecoration};\n`;
    }
    if (style.fontStyle) {
      css += `  font-style: ${style.fontStyle};\n`;
    }
    css += `}\n\n`;
  });
  
  return css;
}

// Helper function to generate SCSS from type scale
function generateSCSS(typeScale: any): string {
  const { baseSize, scaleRatio, unit, typeStyles } = typeScale;
  const actualRatio = scaleRatio / 1000;
  
  let scss = `// ${typeScale.name} Type Scale\n\n`;
  scss += `$type-scale-base: ${baseSize}${unit};\n`;
  scss += `$type-scale-ratio: ${actualRatio};\n\n`;
  
  // Generate SCSS variables for each type style
  typeStyles.forEach((style: any) => {
    const size = calculateFontSize(baseSize, scaleRatio, style.size, unit);
    scss += `$font-size-${style.level}: ${size};\n`;
  });
  
  scss += `\n// Type scale map\n`;
  scss += `$type-scale: (\n`;
  typeStyles.forEach((style: any, index: number) => {
    const size = calculateFontSize(baseSize, scaleRatio, style.size, unit);
    scss += `  "${style.level}": ${size}`;
    if (index < typeStyles.length - 1) scss += ',';
    scss += `\n`;
  });
  scss += `);\n\n`;
  
  // Generate mixins
  scss += `// Type scale mixin\n`;
  scss += `@mixin type-scale($level) {\n`;
  scss += `  font-size: map-get($type-scale, $level);\n`;
  scss += `}\n\n`;
  
  // Generate utility classes
  typeStyles.forEach((style: any) => {
    scss += `.text-${style.level} {\n`;
    scss += `  @include type-scale("${style.level}");\n`;
    scss += `  font-weight: ${style.fontWeight};\n`;
    scss += `  line-height: ${style.lineHeight};\n`;
    scss += `  letter-spacing: ${style.letterSpacing}${unit === 'px' ? 'px' : 'em'};\n`;
    scss += `  color: ${style.color};\n`;
    if (style.backgroundColor) {
      scss += `  background-color: ${style.backgroundColor};\n`;
    }
    if (style.textDecoration) {
      scss += `  text-decoration: ${style.textDecoration};\n`;
    }
    if (style.fontStyle) {
      scss += `  font-style: ${style.fontStyle};\n`;
    }
    scss += `}\n\n`;
  });
  
  return scss;
}