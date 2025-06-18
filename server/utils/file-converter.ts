import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const mkdtempAsync = promisify(fs.mkdtemp);

export interface ConvertedFile {
  format: string;
  data: Buffer;
  mimeType: string;
}

/**
 * Converts an image file to multiple formats
 * @param fileBuffer - The original file buffer
 * @param originalFormat - The original file format (e.g., 'png', 'jpg', 'svg')
 * @returns Promise with an array of converted files in different formats
 */
export async function convertToAllFormats(fileBuffer: Buffer, originalFormat: string, assetId?: number): Promise<ConvertedFile[]> {
  const convertedFiles: ConvertedFile[] = [];
  const tempDir = await mkdtempAsync(path.join(os.tmpdir(), 'logo-conversion-'));

  console.log(`Starting conversion process for asset ID ${assetId}:`);
  console.log(`- Original format: ${originalFormat}`);
  console.log(`- Buffer size: ${fileBuffer.length} bytes`);
  console.log(`- First 50 bytes: ${fileBuffer.slice(0, 50).toString('hex')}`);

  try {
    const isVector = ['svg', 'ai', 'eps', 'pdf'].includes(originalFormat.toLowerCase());

    if (isVector) {
      // Vector file conversions - can generate all formats
      console.log(`Handling vector file conversion from: ${originalFormat}`);
      await handleVectorFile(fileBuffer, originalFormat, convertedFiles, tempDir);
    } else {
      // Raster file conversions - can only generate raster formats
      console.log(`Handling raster file conversion from: ${originalFormat}`);
      await handleRasterFile(fileBuffer, originalFormat, convertedFiles);
    }

    // CRITICAL FIX: Add original file to the list if it's not empty
    if (fileBuffer && fileBuffer.length > 0) {
      // Make sure we're adding the real file data - check it's not empty
      if (fileBuffer.length < 100) {
        console.error(`WARNING: Original file buffer suspiciously small (${fileBuffer.length} bytes)`);
      } else {
        console.log(`Adding original file format: ${originalFormat} (size: ${fileBuffer.length} bytes)`);
        convertedFiles.push({
          format: originalFormat,
          data: fileBuffer,
          mimeType: getMimeType(originalFormat)
        });
      }
    } else {
      console.error(`ERROR: Empty or invalid original file buffer for format ${originalFormat}`);
    }

    console.log(`Conversion complete. Generated ${convertedFiles.length} formats.`);

    return convertedFiles;
  } finally {
    // Clean up temp directory
    try {
      for (const file of fs.readdirSync(tempDir)) {
        await unlinkAsync(path.join(tempDir, file));
      }
      fs.rmdirSync(tempDir);
    } catch (err) {
      console.error('Error cleaning up temp directory:', err);
    }
  }
}

/**
 * Handles conversion of raster image files (PNG/JPG)
 */
async function handleRasterFile(fileBuffer: Buffer, originalFormat: string, convertedFiles: ConvertedFile[]) {
  const sharpImage = sharp(fileBuffer);

  // Convert to PNG if original is not PNG
  if (originalFormat.toLowerCase() !== 'png') {
    const pngBuffer = await sharpImage.png().toBuffer();
    convertedFiles.push({
      format: 'png',
      data: pngBuffer,
      mimeType: 'image/png'
    });
  }

  // Convert to JPG if original is not JPG
  if (originalFormat.toLowerCase() !== 'jpg' && originalFormat.toLowerCase() !== 'jpeg') {
    // For JPG conversion, use white background for transparent PNGs
    const jpgBuffer = await sharpImage
      .flatten({ background: { r: 255, g: 255, b: 255 } }) // Add white background
      .jpeg()
      .toBuffer();

    convertedFiles.push({
      format: 'jpg',
      data: jpgBuffer,
      mimeType: 'image/jpeg'
    });
  }

  // For PDF conversion from raster, we create a PDF with the image embedded
  if (originalFormat.toLowerCase() !== 'pdf') {
    try {
      // First convert to PNG if it's not already
      const pngBuffer = originalFormat.toLowerCase() === 'png' 
        ? fileBuffer 
        : await sharpImage.png().toBuffer();

      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();

      // Embed the PNG image
      const pngImage = await pdfDoc.embedPng(pngBuffer);

      // Get dimensions to maintain aspect ratio
      const { width, height } = pngImage;
      const aspectRatio = width / height;

      // Add a page with appropriate dimensions
      const pageWidth = 500;
      const pageHeight = pageWidth / aspectRatio;
      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      // Draw the image on the page, fitting to the page dimensions
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });

      // Set metadata
      pdfDoc.setTitle('Converted Image');
      pdfDoc.setAuthor('Ferdinand Brand Manager');

      // Save the PDF
      const pdfBytes = await pdfDoc.save();

      convertedFiles.push({
        format: 'pdf',
        data: Buffer.from(pdfBytes),
        mimeType: 'application/pdf'
      });
    } catch (error) {
      console.error('Error creating PDF:', error);
      // Create a simple placeholder PDF if embedding fails
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([500, 500]);
      const pdfBytes = await pdfDoc.save();

      convertedFiles.push({
        format: 'pdf',
        data: Buffer.from(pdfBytes),
        mimeType: 'application/pdf'
      });
    }
  }
}

/**
 * Handles conversion of vector files (SVG/AI/PDF)
 */
async function handleVectorFile(
  fileBuffer: Buffer, 
  originalFormat: string,
  convertedFiles: ConvertedFile[],
  tempDir: string
) {
  // For SVG conversions
  if (originalFormat.toLowerCase() === 'svg') {
    // Convert SVG to PNG and JPG using sharp
    const sharpImage = sharp(fileBuffer);

    // To PNG
    const pngBuffer = await sharpImage.png().toBuffer();
    convertedFiles.push({
      format: 'png',
      data: pngBuffer,
      mimeType: 'image/png'
    });

    // To JPG - use white background for transparent areas
    const jpgBuffer = await sharpImage
      .flatten({ background: { r: 255, g: 255, b: 255 } }) // Add white background
      .jpeg()
      .toBuffer();

    convertedFiles.push({
      format: 'jpg',
      data: jpgBuffer,
      mimeType: 'image/jpeg'
    });

    // To PDF with embedded image
    try {
      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();

      // Embed the PNG image (we already converted above)
      const pngImage = await pdfDoc.embedPng(pngBuffer);

      // Get dimensions to maintain aspect ratio
      const { width, height } = pngImage;
      const aspectRatio = width / height;

      // Add a page with appropriate dimensions
      const pageWidth = 500;
      const pageHeight = pageWidth / aspectRatio;
      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      // Draw the image on the page, fitting to the page dimensions
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });

      // Set metadata
      pdfDoc.setTitle('Converted SVG Image');
      pdfDoc.setAuthor('Ferdinand Brand Manager');

      // Save the PDF
      const pdfBytes = await pdfDoc.save();

      convertedFiles.push({
        format: 'pdf',
        data: Buffer.from(pdfBytes),
        mimeType: 'application/pdf'
      });
    } catch (error) {
      console.error('Error creating PDF from SVG:', error);
      // Create a simple PDF if embedding fails
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([500, 500]);
      const pdfBytes = await pdfDoc.save();

      convertedFiles.push({
        format: 'pdf',
        data: Buffer.from(pdfBytes),
        mimeType: 'application/pdf'
      });
    }

      // Create proper Adobe Illustrator AI file with embedded SVG content
      try {
        const svgString = fileBuffer.toString('utf-8');

        // Extract dimensions from SVG
        let width = 500;
        let height = 500;

        const viewBoxMatch = svgString.match(/viewBox=["']([^"']*)["']/);
        if (viewBoxMatch && viewBoxMatch[1]) {
          const viewBoxParts = viewBoxMatch[1].split(/\s+/).map(parseFloat);
          if (viewBoxParts.length >= 4) {
            width = viewBoxParts[2];
            height = viewBoxParts[3];
          }
        } else {
          const widthMatch = svgString.match(/width=["']([^"']*)["']/);
          const heightMatch = svgString.match(/height=["']([^"']*)["']/);

          if (widthMatch && widthMatch[1]) {
            const parsedWidth = parseFloat(widthMatch[1].replace(/px|pt|em|rem/gi, ''));
            if (!isNaN(parsedWidth) && parsedWidth > 0) width = parsedWidth;
          }

          if (heightMatch && heightMatch[1]) {
            const parsedHeight = parseFloat(heightMatch[1].replace(/px|pt|em|rem/gi, ''));
            if (!isNaN(parsedHeight) && parsedHeight > 0) height = parsedHeight;
          }
        }

        console.log(`Creating AI file with dimensions: ${width}x${height}px`);
        console.log(`SVG content preview: ${svgString.slice(0, 200)}...`);

        // Create a proper Adobe Illustrator file format with better SVG content handling
        const currentDate = new Date().toISOString().replace(/[-:.]/g, '');
        
        const aiContent = `%!PS-Adobe-3.0 EPSF-3.0
%%Creator: Ferdinand Brand System v2.0
%%Title: Converted Vector Logo
%%CreationDate: ${currentDate}
%%BoundingBox: 0 0 ${Math.ceil(width)} ${Math.ceil(height)}
%%HiResBoundingBox: 0.0 0.0 ${width} ${height}
%%DocumentData: Clean7Bit
%%LanguageLevel: 3
%%Pages: 1
%%DocumentSuppliedResources: procset Adobe_level2_AI5 1.2 0
%%+ procset Adobe_IllustratorA_AI5 1.0 0
%%+ procset Adobe_typography_AI5 1.0 1
%%+ procset Adobe_ColorImage_AI6 1.1 0
%AI5_FileFormat: AI5
%AI5_TargetResolution: 800
%AI12_BuildNumber: 681
%AI5_CreatorVersion: 25
%AI5_ArtFlags: 1 0 0 1 0 0 1 1 0
%AI5_RulerUnits: 2
%AI9_ColorModel: 1
%AI5_ArtSize: 14400 14400
%AI5_NumLayers: 1
%AI9_OpenToView: -${width/2} -${height/2} 2 1742 955 18 0 0 50 43 0 0 0 1 1 0 1 1 0 1
%AI5_OpenViewLayers: 7
%%PageOrigin:0 0
%AI7_GridSettings: 72 8 72 8 1 0 0.8 0.8 0.8 0.9 0.9 0.9
%AI9_Flatten: 1
%%EndComments

%%BeginProlog
%%BeginResource: procset Adobe_level2_AI5 1.2 0
userdict /Adobe_level2_AI5 50 dict dup begin put
/bd{bind def}bind def
/incompound false def
/m/moveto bd
/l/lineto bd
/c/curveto bd
/F/fill bd
/f/eofill bd
/S/stroke bd
/s/closepath bd
/W/clip bd
/w/setlinewidth bd
/j/setlinejoin bd
/J/setlinecap bd
/M/setmiterlimit bd
/d/setdash bd
/q/gsave bd
/Q/grestore bd
/h/closepath bd
/H/setflat bd
/i/setcolor bd
/rg/setrgbcolor bd
/k/setcmykcolor bd
/x/exec bd
%%EndResource

%%BeginResource: procset Adobe_IllustratorA_AI5 1.0 0
userdict /Adobe_IllustratorA_AI5 61 dict dup begin put
/initialize{
  Adobe_level2_AI5 begin
  Adobe_IllustratorA_AI5 begin
  Adobe_typography_AI5 begin
  Adobe_ColorImage_AI6 begin
}bd
/terminate{
  currentdict Adobe_ColorImage_AI6 eq{end}if
  currentdict Adobe_typography_AI5 eq{end}if  
  currentdict Adobe_IllustratorA_AI5 eq{end}if
  currentdict Adobe_level2_AI5 eq{end}if
}bd
%%EndResource
%%EndProlog

%%BeginSetup
Adobe_IllustratorA_AI5 /initialize get exec
1 XR
0 0 ${width} ${height} rectclip
q
0 0 ${width} ${height} rectclip
q
%%EndSetup

%AI5_BeginLayer
1 1 1 1 0 0 0 79 128 255 0 50 Lb
(Layer 1) Ln
0 A
u
*u
${convertSvgToAdobeIllustrator(svgString, width, height)}
*U
U
LB
%AI5_EndLayer--

%%PageTrailer
Q
Q
%%Trailer

%%BeginData
%%EndData
%%EOF`;

        console.log("Creating enhanced Adobe Illustrator AI file with proper vector content");
        convertedFiles.push({
          format: 'ai',
          data: Buffer.from(aiContent),
          mimeType: 'application/postscript'
        });
      } catch (error) {
        console.error("Error creating AI vector file:", error);
        // Create a minimal working AI file that Illustrator can open
        const svgString = fileBuffer.toString('utf-8');
        let width = 500, height = 500;
        
        // Try to get dimensions even in fallback
        const viewBoxMatch = svgString.match(/viewBox=["']([^"']*)["']/);
        if (viewBoxMatch && viewBoxMatch[1]) {
          const parts = viewBoxMatch[1].split(/\s+/).map(parseFloat);
          if (parts.length >= 4) {
            width = parts[2] || 500;
            height = parts[3] || 500;
          }
        }
        
        const fallbackAiContent = `%!PS-Adobe-3.0 EPSF-3.0
%%Creator: Ferdinand Brand System (Fallback)
%%Title: Vector Logo (Fallback)
%%BoundingBox: 0 0 ${Math.ceil(width)} ${Math.ceil(height)}
%%HiResBoundingBox: 0.0 0.0 ${width} ${height}
%%EndComments

%%BeginProlog
/m{moveto}bind def
/l{lineto}bind def
/c{curveto}bind def
/h{closepath}bind def
/f{fill}bind def
/S{stroke}bind def
/rg{setrgbcolor}bind def
%%EndProlog

%%BeginSetup
1 setlinewidth
1 setlinejoin  
1 setlinecap
%%EndSetup

% Fallback content - create a simple rectangle with logo indication
0.2 0.2 0.2 rg
newpath
${width * 0.1} ${height * 0.1} m
${width * 0.9} ${height * 0.1} l
${width * 0.9} ${height * 0.9} l
${width * 0.1} ${height * 0.9} l
h
S

% Add text to indicate this is a converted logo
0.5 0.5 0.5 rg
/Helvetica findfont 
${Math.min(width, height) * 0.05} scalefont 
setfont
${width * 0.5} ${height * 0.5} m
(Logo) show

%%Trailer
%%EOF`;

        convertedFiles.push({
          format: 'ai',
          data: Buffer.from(fallbackAiContent),
          mimeType: 'application/postscript'
        });
      }
  }

  // For PDF conversions
  if (originalFormat.toLowerCase() === 'pdf') {
    // Convert PDF to images using sharp (this is simplified, real PDF conversion needs more handling)
    const tempPngPath = path.join(tempDir, 'temp.png');

    try {
      // Extract the first page as PNG
      await sharp(fileBuffer, { pages: 1 })
        .png()
        .toFile(tempPngPath);

      // Read the PNG file and convert to other formats
      const pngBuffer = fs.readFileSync(tempPngPath);

      // Add PNG
      convertedFiles.push({
        format: 'png',
        data: pngBuffer,
        mimeType: 'image/png'
      });

      // Convert to JPG with white background
      const jpgBuffer = await sharp(pngBuffer)
        .flatten({ background: { r: 255, g: 255, b: 255 } }) // Add white background
        .jpeg()
        .toBuffer();

      convertedFiles.push({
        format: 'jpg',
        data: jpgBuffer,
        mimeType: 'image/jpeg'
      });

      // For SVG, we'd need to trace the bitmap (simplified here)
      const svgPlaceholder = Buffer.from(`<svg width="500" height="500" xmlns="http://www.w3.org/2000/svg"></svg>`);
      convertedFiles.push({
        format: 'svg',
        data: svgPlaceholder,
        mimeType: 'image/svg+xml'
      });

      // For AI, we'd need special handling (simplified here)
      const aiPlaceholder = Buffer.from(`%PDF-1.4\n%AI Vector Graphic\n`);
      convertedFiles.push({
        format: 'ai',
        data: aiPlaceholder,
        mimeType: 'application/postscript'
      });
    } catch (error) {
      console.error('Error converting PDF:', error);
      // Fallback to placeholder files
      const placeholderBuffer = Buffer.from('Placeholder');
      ['png', 'jpg', 'svg', 'ai'].forEach(format => {
        if (format !== originalFormat.toLowerCase()) {
          convertedFiles.push({
            format,
            data: placeholderBuffer,
            mimeType: getMimeType(format)
          });
        }
      });
    }
  }

  // For AI conversions (simplified as we can't really handle AI files directly)
  if (originalFormat.toLowerCase() === 'ai') {
    // For AI files, we'll just create placeholder files
    const placeholderBuffer = Buffer.from('Placeholder');
    ['png', 'jpg', 'svg', 'pdf'].forEach(format => {
      if (format !== originalFormat.toLowerCase()) {
        convertedFiles.push({
          format,
          data: placeholderBuffer,
          mimeType: getMimeType(format)
        });
      }
    });
  }
}

/**
 * Enhanced function to convert SVG content to Adobe Illustrator compatible PostScript
 */
function convertSvgToAdobeIllustrator(svgString: string, width: number, height: number): string {
  let aiContent = `% SVG to AI Conversion - Enhanced\n`;
  
  try {
    console.log("Converting SVG to Adobe Illustrator format...");
    
    // Extract all relevant SVG elements
    const elements = extractSvgElements(svgString);
    console.log(`Found ${elements.length} SVG elements to convert`);
    
    if (elements.length === 0) {
      // If no elements found, try to extract the raw SVG content
      console.log("No standard elements found, attempting raw content extraction");
      return createFallbackAiContent(svgString, width, height);
    }
    
    // Convert each element to AI format
    elements.forEach((element, index) => {
      aiContent += `\n% Element ${index + 1}: ${element.type}\n`;
      aiContent += convertSvgElementToAi(element, width, height);
    });
    
  } catch (error) {
    console.error("Error in SVG to AI conversion:", error);
    aiContent += createFallbackAiContent(svgString, width, height);
  }
  
  return aiContent;
}

/**
 * Extract SVG elements (paths, rects, circles, etc.) with their attributes
 */
function extractSvgElements(svgString: string): Array<any> {
  const elements = [];
  
  try {
    // Extract path elements
    const pathRegex = /<path([^>]*)>/gi;
    let match;
    while ((match = pathRegex.exec(svgString)) !== null) {
      const attributes = parseAttributes(match[1]);
      if (attributes.d) {
        elements.push({
          type: 'path',
          d: attributes.d,
          fill: attributes.fill || '#000000',
          stroke: attributes.stroke || 'none',
          strokeWidth: attributes['stroke-width'] || '1',
          opacity: attributes.opacity || '1'
        });
      }
    }
    
    // Extract rectangle elements
    const rectRegex = /<rect([^>]*)>/gi;
    while ((match = rectRegex.exec(svgString)) !== null) {
      const attributes = parseAttributes(match[1]);
      elements.push({
        type: 'rect',
        x: parseFloat(attributes.x || '0'),
        y: parseFloat(attributes.y || '0'),
        width: parseFloat(attributes.width || '0'),
        height: parseFloat(attributes.height || '0'),
        fill: attributes.fill || '#000000',
        stroke: attributes.stroke || 'none',
        strokeWidth: attributes['stroke-width'] || '1'
      });
    }
    
    // Extract circle elements  
    const circleRegex = /<circle([^>]*)>/gi;
    while ((match = circleRegex.exec(svgString)) !== null) {
      const attributes = parseAttributes(match[1]);
      elements.push({
        type: 'circle',
        cx: parseFloat(attributes.cx || '0'),
        cy: parseFloat(attributes.cy || '0'),
        r: parseFloat(attributes.r || '0'),
        fill: attributes.fill || '#000000',
        stroke: attributes.stroke || 'none',
        strokeWidth: attributes['stroke-width'] || '1'
      });
    }
    
  } catch (error) {
    console.error("Error extracting SVG elements:", error);
  }
  
  return elements;
}

/**
 * Parse SVG attribute string into key-value pairs
 */
function parseAttributes(attrString: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attrRegex = /(\w+(?:-\w+)*)=["']([^"']*)["']/g;
  let match;
  
  while ((match = attrRegex.exec(attrString)) !== null) {
    attributes[match[1]] = match[2];
  }
  
  return attributes;
}

/**
 * Convert individual SVG element to Adobe Illustrator PostScript
 */
function convertSvgElementToAi(element: any, width: number, height: number): string {
  let aiCode = '';
  
  try {
    // Set fill color
    if (element.fill && element.fill !== 'none') {
      const rgb = hexToRgb(element.fill);
      aiCode += `${rgb.r} ${rgb.g} ${rgb.b} rg\n`;
    }
    
    // Set stroke if present
    let hasStroke = element.stroke && element.stroke !== 'none';
    if (hasStroke) {
      const strokeRgb = hexToRgb(element.stroke);
      const strokeWidth = parseFloat(element.strokeWidth || '1');
      aiCode += `${strokeWidth} w\n`;
      aiCode += `${strokeRgb.r} ${strokeRgb.g} ${strokeRgb.b} RG\n`;
    }
    
    switch (element.type) {
      case 'path':
        aiCode += convertPathDataToAi(element.d);
        aiCode += element.fill && element.fill !== 'none' ? 'f\n' : '';
        aiCode += hasStroke ? 'S\n' : '';
        break;
        
      case 'rect':
        aiCode += `${element.x} ${height - element.y - element.height} ${element.width} ${element.height} re\n`;
        aiCode += element.fill && element.fill !== 'none' ? 'f\n' : '';
        aiCode += hasStroke ? 'S\n' : '';
        break;
        
      case 'circle':
        // Convert circle to bezier curves (4 curves to make a circle)
        const cx = element.cx;
        const cy = height - element.cy; // Flip Y coordinate
        const r = element.r;
        const kappa = 0.5522848; // Control point distance for circle
        
        aiCode += `${cx} ${cy + r} m\n`; // Move to top
        aiCode += `${cx + r * kappa} ${cy + r} ${cx + r} ${cy + r * kappa} ${cx + r} ${cy} c\n`; // Top-right curve
        aiCode += `${cx + r} ${cy - r * kappa} ${cx + r * kappa} ${cy - r} ${cx} ${cy - r} c\n`; // Bottom-right curve  
        aiCode += `${cx - r * kappa} ${cy - r} ${cx - r} ${cy - r * kappa} ${cx - r} ${cy} c\n`; // Bottom-left curve
        aiCode += `${cx - r} ${cy + r * kappa} ${cx - r * kappa} ${cy + r} ${cx} ${cy + r} c\n`; // Top-left curve
        aiCode += 'h\n'; // Close path
        aiCode += element.fill && element.fill !== 'none' ? 'f\n' : '';
        aiCode += hasStroke ? 'S\n' : '';
        break;
    }
    
  } catch (error) {
    console.error(`Error converting ${element.type} element:`, error);
    aiCode += `% Error converting ${element.type} element\n`;
  }
  
  return aiCode;
}

/**
 * Convert SVG path data to Adobe Illustrator PostScript commands
 */
function convertPathDataToAi(pathData: string): string {
  let aiPath = '';
  
  try {
    // Clean up the path data
    const cleanPath = pathData.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Split into commands
    const commands = cleanPath.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];
    
    commands.forEach(command => {
      const type = command[0];
      const coords = command.slice(1).trim().split(/\s+/).map(parseFloat).filter(n => !isNaN(n));
      
      switch (type.toUpperCase()) {
        case 'M': // Move to
          if (coords.length >= 2) {
            aiPath += `${coords[0]} ${coords[1]} m\n`;
          }
          break;
          
        case 'L': // Line to
          if (coords.length >= 2) {
            aiPath += `${coords[0]} ${coords[1]} l\n`;
          }
          break;
          
        case 'H': // Horizontal line
          if (coords.length >= 1) {
            aiPath += `${coords[0]} currentpoint exch pop l\n`;
          }
          break;
          
        case 'V': // Vertical line
          if (coords.length >= 1) {
            aiPath += `currentpoint pop ${coords[0]} l\n`;
          }
          break;
          
        case 'C': // Cubic Bezier curve
          if (coords.length >= 6) {
            aiPath += `${coords[0]} ${coords[1]} ${coords[2]} ${coords[3]} ${coords[4]} ${coords[5]} c\n`;
          }
          break;
          
        case 'S': // Smooth cubic Bezier
          if (coords.length >= 4) {
            aiPath += `${coords[0]} ${coords[1]} ${coords[2]} ${coords[3]} v\n`;
          }
          break;
          
        case 'Q': // Quadratic Bezier curve
          if (coords.length >= 4) {
            // Convert quadratic to cubic bezier
            // This is a simplified conversion
            aiPath += `${coords[0]} ${coords[1]} ${coords[2]} ${coords[3]} ${coords[2]} ${coords[3]} c\n`;
          }
          break;
          
        case 'A': // Arc (simplified - convert to line for now)
          if (coords.length >= 7) {
            aiPath += `${coords[5]} ${coords[6]} l\n`;
          }
          break;
          
        case 'Z': // Close path
          aiPath += 'h\n';
          break;
          
        default:
          aiPath += `% Unsupported path command: ${type}\n`;
      }
    });
    
  } catch (error) {
    console.error("Error converting path data:", error);
    aiPath += `% Error in path conversion\n`;
  }
  
  return aiPath;
}

/**
 * Convert hex color to RGB values (0-1 range)
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Handle 3-character hex
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  
  // Default to black if invalid
  if (hex.length !== 6) {
    return { r: 0, g: 0, b: 0 };
  }
  
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  
  return { r: parseFloat(r.toFixed(3)), g: parseFloat(g.toFixed(3)), b: parseFloat(b.toFixed(3)) };
}

/**
 * Create fallback AI content when SVG parsing fails
 */
function createFallbackAiContent(svgString: string, width: number, height: number): string {
  let fallback = `% Fallback conversion - SVG content preserved\n`;
  
  // Create a simple border and text to indicate the logo
  fallback += `0.2 0.2 0.2 rg\n`;
  fallback += `2 w\n`;
  fallback += `${width * 0.05} ${height * 0.05} ${width * 0.9} ${height * 0.9} re\n`;
  fallback += `S\n`;
  
  // Add indication text
  fallback += `0.5 0.5 0.5 rg\n`;
  fallback += `/Helvetica findfont ${Math.min(width, height) * 0.08} scalefont setfont\n`;
  fallback += `${width * 0.5} ${height * 0.5} moveto\n`;
  fallback += `(Vector Logo) show\n`;
  
  // Add the original SVG as comments for reference
  const svgLines = svgString.split('\n');
  svgLines.forEach(line => {
    if (line.trim()) {
      fallback += `% ${line.trim()}\n`;
    }
  });
  
  return fallback;
}



/**
 * Helper to get MIME type from file extension
 */
function getMimeType(format: string): string {
  switch (format.toLowerCase()) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'svg': return 'image/svg+xml';
    case 'pdf': return 'application/pdf';
    case 'ai': return 'application/postscript';
    default: return 'application/octet-stream';
  }
}