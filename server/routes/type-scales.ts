import {
  insertTypeScaleSchema,
  type TypeScale,
  type TypeStyle,
} from "@shared/schema";
import type { Express } from "express";
import { storage } from "../storage";

export function registerTypeScalesRoutes(app: Express) {
  // Get all type scales for a client
  app.get("/api/clients/:clientId/type-scales", async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);

      if (isNaN(clientId)) {
        return res.status(400).json({ error: "Invalid client ID" });
      }

      const typeScales = await storage.getClientTypeScales(clientId);

      // Migrate type scales to new hierarchy if they don't have the new structure
      const migratedTypeScales = typeScales.map((typeScale: TypeScale) => {
        const currentTypeStyles = (typeScale.typeStyles as TypeStyle[]) || [];
        const hasNewStructure = currentTypeStyles.some((style) =>
          ["body-large", "body-small", "caption", "quote", "code"].includes(
            style.level
          )
        );

        if (!hasNewStructure) {
          console.log(`Migrating type scale ${typeScale.id} to new hierarchy`);
          // Assuming migrateTypeScaleToNewHierarchy is defined elsewhere and accessible
          // return migrateTypeScaleToNewHierarchy(typeScale);
          return {
            ...typeScale,
            individualHeaderStyles: typeScale.individualHeaderStyles || {},
            individualBodyStyles: typeScale.individualBodyStyles || {},
          }; // Placeholder, replace with actual migration logic
        }

        return {
          ...typeScale,
          individualHeaderStyles: typeScale.individualHeaderStyles || {},
          individualBodyStyles: typeScale.individualBodyStyles || {},
        };
      });

      res.json(migratedTypeScales);
    } catch (error: unknown) {
      console.error(
        "Error fetching type scales:",
        error instanceof Error ? error.message : "Unknown error"
      );
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
    } catch (error: unknown) {
      console.error(
        "Error fetching type scale:",
        error instanceof Error ? error.message : "Unknown error"
      );
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
        clientId,
      });

      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid type scale data",
          details: validationResult.error.errors,
        });
      }

      const typeScale = await storage.createTypeScale(validationResult.data);
      res.status(201).json(typeScale);
    } catch (error: unknown) {
      console.error(
        "Error creating type scale:",
        error instanceof Error ? error.message : "Unknown error"
      );
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

      // Validate the update data - allow individual styles to pass through
      const updateData = { ...req.body };
      delete updateData.clientId; // Remove clientId from updates
      delete updateData.id; // Remove id from updates
      delete updateData.createdAt; // Remove createdAt from updates

      // Ensure any timestamp strings are converted to Date objects
      if (updateData.updatedAt && typeof updateData.updatedAt === "string") {
        updateData.updatedAt = new Date(updateData.updatedAt);
      }
      if (updateData.createdAt && typeof updateData.createdAt === "string") {
        delete updateData.createdAt; // Don't update createdAt
      }

      console.log(
        "Updating type scale with data:",
        JSON.stringify(updateData, null, 2)
      );

      const updatedTypeScale = await storage.updateTypeScale(id, updateData);
      res.json(updatedTypeScale);
    } catch (error: unknown) {
      console.error(
        "Error updating type scale:",
        error instanceof Error ? error.message : "Unknown error"
      );
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
    } catch (error: unknown) {
      console.error(
        "Error deleting type scale:",
        error instanceof Error ? error.message : "Unknown error"
      );
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
        fileName: `${typeScale.name.toLowerCase().replace(/\s+/g, "-")}-type-scale.css`,
        exportedAt: new Date().toISOString(),
      };

      const updatedExports = [...(typeScale.exports || []), newExport];
      await storage.updateTypeScale(id, { exports: updatedExports });

      res.json({
        content: css,
        fileName: newExport.fileName,
        mimeType: "text/css",
      });
    } catch (error: unknown) {
      console.error(
        "Error generating CSS export:",
        error instanceof Error ? error.message : "Unknown error"
      );
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
        fileName: `${typeScale.name.toLowerCase().replace(/\s+/g, "-")}-type-scale.scss`,
        exportedAt: new Date().toISOString(),
      };

      const updatedExports = [...(typeScale.exports || []), newExport];
      await storage.updateTypeScale(id, { exports: updatedExports });

      res.json({
        content: scss,
        fileName: newExport.fileName,
        mimeType: "text/scss",
      });
    } catch (error: unknown) {
      console.error(
        "Error generating SCSS export:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ error: "Failed to generate SCSS export" });
    }
  });
}

// Helper function to calculate font size based on scale ratio and step
function calculateFontSize(
  baseSize: number,
  ratio: number,
  step: number,
  unit: string
): string {
  const actualRatio = ratio / 1000; // Convert from stored integer format
  const size = Math.round(baseSize * actualRatio ** step * 100) / 100;
  return `${size}${unit}`;
}

// Helper function to generate CSS from type scale
function generateCSS(typeScale: TypeScale): string {
  const { baseSize, scaleRatio, unit, typeStyles } = typeScale;
  const actualRatio = scaleRatio / 1000;

  let css = `/* ${typeScale.name} Type Scale */\n\n`;
  css += `:root {\n`;
  css += `  --type-scale-base: ${baseSize}${unit};\n`;
  css += `  --type-scale-ratio: ${actualRatio};\n\n`;

  // Generate CSS custom properties for each type style
  (typeStyles as TypeStyle[]).forEach((style: TypeStyle) => {
    const size = calculateFontSize(baseSize, scaleRatio, style.size, unit);
    const varName = style.level.replace("-", "_");
    css += `  --font-size-${varName}: ${size};\n`;
    css += `  --font-weight-${varName}: ${style.fontWeight};\n`;
    css += `  --line-height-${varName}: ${style.lineHeight};\n`;
    css += `  --letter-spacing-${varName}: ${style.letterSpacing}${unit === "px" ? "px" : "em"};\n`;
    css += `  --color-${varName}: ${style.color};\n`;
  });

  css += `}\n\n`;

  // Add global body styles
  css += `body, .body {\n`;
  css += `  font-family: ${typeScale.bodyFontFamily || "inherit"};\n`;
  css += `  font-weight: ${typeScale.bodyFontWeight || "400"};\n`;
  css += `  letter-spacing: ${typeScale.bodyLetterSpacing || 0}${unit === "px" ? "px" : "em"};\n`;
  css += `  color: ${typeScale.bodyColor || "#000000"};\n`;
  if (typeScale.bodyTextTransform) {
    css += `  text-transform: ${typeScale.bodyTextTransform};\n`;
  }
  if (typeScale.bodyFontStyle) {
    css += `  font-style: ${typeScale.bodyFontStyle};\n`;
  }
  if (typeScale.bodyTextDecoration) {
    css += `  text-decoration: ${typeScale.bodyTextDecoration};\n`;
  }
  css += `}\n\n`;

  // Add global header styles
  css += `h1, h2, h3, h4, h5, h6, .header {\n`;
  css += `  font-family: ${typeScale.headerFontFamily || "inherit"};\n`;
  css += `  font-weight: ${typeScale.headerFontWeight || "700"};\n`;
  css += `  letter-spacing: ${typeScale.headerLetterSpacing || 0}${unit === "px" ? "px" : "em"};\n`;
  css += `  color: ${typeScale.headerColor || "#000000"};\n`;
  if (typeScale.headerTextTransform) {
    css += `  text-transform: ${typeScale.headerTextTransform};\n`;
  }
  if (typeScale.headerFontStyle) {
    css += `  font-style: ${typeScale.headerFontStyle};\n`;
  }
  if (typeScale.headerTextDecoration) {
    css += `  text-decoration: ${typeScale.headerTextDecoration};\n`;
  }
  css += `}\n\n`;

  // Generate utility classes
  (typeStyles as TypeStyle[]).forEach((style: TypeStyle) => {
    const size = calculateFontSize(baseSize, scaleRatio, style.size, unit);
    const className = style.level;
    css += `.${className} {\n`;
    css += `  font-size: ${size};\n`;
    css += `  font-weight: ${style.fontWeight};\n`;
    css += `  line-height: ${style.lineHeight};\n`;
    css += `  letter-spacing: ${style.letterSpacing}${unit === "px" ? "px" : "em"};\n`;
    css += `  color: ${style.color};\n`;

    // Add special styling for specific elements
    if (style.level === "code") {
      css += `  font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;\n`;
      css += `  background-color: rgba(0, 0, 0, 0.05);\n`;
      css += `  padding: 0.25rem 0.5rem;\n`;
      css += `  border-radius: 0.25rem;\n`;
      css += `  border: 1px solid rgba(0, 0, 0, 0.1);\n`;
    }

    if (style.level === "quote") {
      css += `  font-style: italic;\n`;
      css += `  border-left: 4px solid rgba(0, 0, 0, 0.1);\n`;
      css += `  padding-left: 1rem;\n`;
      css += `  margin: 1rem 0;\n`;
    }

    if (style.level === "caption") {
      css += `  color: #666666;\n`;
    }

    css += `}\n\n`;
  });

  return css;
}

// Helper function to generate SCSS from type scale
function generateSCSS(typeScale: TypeScale): string {
  const { baseSize, scaleRatio, unit, typeStyles } = typeScale;
  const actualRatio = scaleRatio / 1000;

  let scss = `// ${typeScale.name} Type Scale\n\n`;
  scss += `$type-scale-base: ${baseSize}${unit};\n`;
  scss += `$type-scale-ratio: ${actualRatio};\n\n`;

  // Generate SCSS variables for each type style
  (typeStyles as TypeStyle[]).forEach((style: TypeStyle) => {
    const size = calculateFontSize(baseSize, scaleRatio, style.size, unit);
    scss += `$font-size-${style.level}: ${size};\n`;
  });

  scss += `\n// Type scale map\n`;
  scss += `$type-scale: (\n`;
  (typeStyles as TypeStyle[]).forEach((style: TypeStyle, index: number) => {
    const size = calculateFontSize(baseSize, scaleRatio, style.size, unit);
    scss += `  "${style.level}": ${size}`;
    if (index < (typeStyles as TypeStyle[]).length - 1) scss += ",";
    scss += `\n`;
  });
  scss += `);\n\n`;

  // Add global body styles
  scss += `body, .body {\n`;
  scss += `  font-family: ${typeScale.bodyFontFamily || "inherit"};\n`;
  scss += `  font-weight: ${typeScale.bodyFontWeight || "400"};\n`;
  scss += `  letter-spacing: ${typeScale.bodyLetterSpacing || 0}${unit === "px" ? "px" : "em"};\n`;
  scss += `  color: ${typeScale.bodyColor || "#000000"};\n`;
  if (typeScale.bodyTextTransform) {
    scss += `  text-transform: ${typeScale.bodyTextTransform};\n`;
  }
  if (typeScale.bodyFontStyle) {
    scss += `  font-style: ${typeScale.bodyFontStyle};\n`;
  }
  if (typeScale.bodyTextDecoration) {
    scss += `  text-decoration: ${typeScale.bodyTextDecoration};\n`;
  }
  scss += `}\n\n`;

  // Add global header styles
  scss += `h1, h2, h3, h4, h5, h6, .header {\n`;
  scss += `  font-family: ${typeScale.headerFontFamily || "inherit"};\n`;
  scss += `  font-weight: ${typeScale.headerFontWeight || "700"};\n`;
  scss += `  letter-spacing: ${typeScale.headerLetterSpacing || 0}${unit === "px" ? "px" : "em"};\n`;
  scss += `  color: ${typeScale.headerColor || "#000000"};\n`;
  if (typeScale.headerTextTransform) {
    scss += `  text-transform: ${typeScale.headerTextTransform};\n`;
  }
  if (typeScale.headerFontStyle) {
    scss += `  font-style: ${typeScale.headerFontStyle};\n`;
  }
  if (typeScale.headerTextDecoration) {
    scss += `  text-decoration: ${typeScale.headerTextDecoration};\n`;
  }
  scss += `}\n\n`;

  // Generate mixins
  scss += `// Type scale mixin\n`;
  scss += `@mixin type-scale($level) {\n`;
  scss += `  font-size: map-get($type-scale, $level);\n`;
  scss += `}\n\n`;

  // Generate utility classes
  (typeStyles as TypeStyle[]).forEach((style: TypeStyle) => {
    scss += `.text-${style.level} {\n`;
    scss += `  @include type-scale("${style.level}");\n`;
    scss += `  font-weight: ${style.fontWeight};\n`;
    scss += `  line-height: ${style.lineHeight};\n`;
    scss += `  letter-spacing: ${style.letterSpacing}${unit === "px" ? "px" : "em"};\n`;
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
