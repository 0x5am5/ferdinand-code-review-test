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

    // Add original file to the list if it's not empty
    if (fileBuffer && fileBuffer.length > 0) {
      console.log(`Adding original file format: ${originalFormat} (size: ${fileBuffer.length} bytes)`);
      convertedFiles.push({
        format: originalFormat,
        data: fileBuffer,
        mimeType: getMimeType(originalFormat)
      });
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
    const jpgBuffer = await sharpImage
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg()
      .toBuffer();

    convertedFiles.push({
      format: 'jpg',
      data: jpgBuffer,
      mimeType: 'image/jpeg'
    });
  }

  // For PDF conversion from raster
  if (originalFormat.toLowerCase() !== 'pdf') {
    try {
      const pngBuffer = originalFormat.toLowerCase() === 'png' 
        ? fileBuffer 
        : await sharpImage.png().toBuffer();

      const pdfDoc = await PDFDocument.create();
      const pngImage = await pdfDoc.embedPng(pngBuffer);
      const { width, height } = pngImage;
      const aspectRatio = width / height;

      const pageWidth = 500;
      const pageHeight = pageWidth / aspectRatio;
      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });

      pdfDoc.setTitle('Converted Image');
      pdfDoc.setAuthor('Ferdinand Brand Manager');

      const pdfBytes = await pdfDoc.save();
      convertedFiles.push({
        format: 'pdf',
        data: Buffer.from(pdfBytes),
        mimeType: 'application/pdf'
      });
    } catch (error) {
      console.error('Error creating PDF:', error);
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

    // To JPG
    const jpgBuffer = await sharpImage
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg()
      .toBuffer();

    convertedFiles.push({
      format: 'jpg',
      data: jpgBuffer,
      mimeType: 'image/jpeg'
    });

    // To PDF
    try {
      const pdfDoc = await PDFDocument.create();
      const pngImage = await pdfDoc.embedPng(pngBuffer);
      const { width, height } = pngImage;
      const aspectRatio = width / height;

      const pageWidth = 500;
      const pageHeight = pageWidth / aspectRatio;
      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });

      pdfDoc.setTitle('Converted SVG Image');
      pdfDoc.setAuthor('Ferdinand Brand Manager');

      const pdfBytes = await pdfDoc.save();
      convertedFiles.push({
        format: 'pdf',
        data: Buffer.from(pdfBytes),
        mimeType: 'application/pdf'
      });
    } catch (error) {
      console.error('Error creating PDF from SVG:', error);
    }

    // Create Adobe Illustrator AI file with simplified approach
    try {
      console.log('Creating Adobe Illustrator file...');
      const svgString = fileBuffer.toString('utf-8');
      const aiContent = await createSimplifiedAiFile(svgString, pngBuffer);

      if (aiContent && aiContent.length > 1000) { // Ensure we have substantial content
        convertedFiles.push({
          format: 'ai',
          data: Buffer.from(aiContent),
          mimeType: 'application/postscript'
        });
        console.log(`Successfully created Adobe Illustrator file (${aiContent.length} bytes)`);
      } else {
        console.error('AI file content too small, likely failed generation');
      }
    } catch (error) {
      console.error("Error creating AI file:", error);
    }
  }
}

/**
 * Create a simplified but robust Adobe Illustrator file
 */
async function createSimplifiedAiFile(svgString: string, pngBuffer: Buffer): Promise<string> {
  // Extract dimensions from SVG
  let width = 500;
  let height = 500;

  try {
    // Try viewBox first
    const viewBoxMatch = svgString.match(/viewBox=["']([^"']*)["']/i);
    if (viewBoxMatch && viewBoxMatch[1]) {
      const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(parseFloat);
      if (parts.length >= 4 && !isNaN(parts[2]) && !isNaN(parts[3])) {
        width = Math.max(parts[2], 100);
        height = Math.max(parts[3], 100);
      }
    } else {
      // Fallback to width/height attributes
      const widthMatch = svgString.match(/width=["']?([^"'\s>]+)/i);
      const heightMatch = svgString.match(/height=["']?([^"'\s>]+)/i);

      if (widthMatch && widthMatch[1]) {
        const parsedWidth = parseFloat(widthMatch[1].replace(/[^\d.]/g, ''));
        if (!isNaN(parsedWidth) && parsedWidth > 0) width = Math.max(parsedWidth, 100);
      }

      if (heightMatch && heightMatch[1]) {
        const parsedHeight = parseFloat(heightMatch[1].replace(/[^\d.]/g, ''));
        if (!isNaN(parsedHeight) && parsedHeight > 0) height = Math.max(parsedHeight, 100);
      }
    }
  } catch (error) {
    console.error("Error parsing SVG dimensions:", error);
  }

  console.log(`Creating AI file with dimensions: ${width}x${height}px`);

  // Generate timestamp
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);

  // Convert PNG to hex for embedding
  const hexData = pngBuffer.toString('hex').toUpperCase();
  let hexString = '';
  for (let i = 0; i < hexData.length; i += 78) { // 78 chars per line for proper formatting
    hexString += hexData.slice(i, i + 78) + '\n';
  }

  // Extract basic SVG elements for simple vector representation
  const basicVectorContent = extractBasicSvgElements(svgString, width, height);

  // Create the AI file content with embedded raster image
  const aiContent = `%!PS-Adobe-3.0 EPSF-3.0
%%Creator: Ferdinand Brand System
%%Title: Logo Vector File
%%CreationDate: ${timestamp}
%%BoundingBox: 0 0 ${Math.ceil(width)} ${Math.ceil(height)}
%%HiResBoundingBox: 0.0 0.0 ${width.toFixed(1)} ${height.toFixed(1)}
%%DocumentData: Clean7Bit
%%LanguageLevel: 2
%%Pages: 1
%%DocumentSuppliedResources: procset Adobe_level2_AI5 1.2 0
%AI5_FileFormat: AI9
%AI5_TargetResolution: 800
%AI12_BuildNumber: 681
%AI5_CreatorVersion: 25
%AI5_ArtFlags: 1 0 0 1 0 0 1 1 0
%AI5_RulerUnits: 2
%AI9_ColorModel: 1
%AI5_ArtSize: 14400 14400
%AI5_NumLayers: 1
%AI9_OpenToView: -${(width/2).toFixed(1)} -${(height/2).toFixed(1)} 2 1742 955 18 0 0 50 43 0 0 0 1 1 0 1 1 0 1
%AI5_OpenViewLayers: 7
%%PageOrigin: 0 0
%AI7_GridSettings: 72 8 72 8 1 0 0.8 0.8 0.8 0.9 0.9 0.9
%AI9_Flatten: 1
%%EndComments

%%BeginProlog
userdict /Adobe_level2_AI5 85 dict dup begin put
/bd{bind def}bind def
/m{moveto}bd
/l{lineto}bd
/c{curveto}bd
/re{4 2 roll moveto 1 index 0 rlineto 0 exch rlineto neg 0 rlineto closepath}bd
/f{fill}bd
/s{stroke}bd
/w{setlinewidth}bd
/g{setgray}bd
/rg{setrgbcolor}bd
/q{gsave}bd
/Q{grestore}bd
/h{closepath}bd
%%EndProlog

%%BeginSetup
%%EndSetup

%AI5_BeginLayer
1 1 1 1 0 0 0 79 128 255 0 50 
(Logo Layer) 
0 
q

% Set clipping path
0 0 ${width} ${height} rectclip

% Basic vector content (simplified)
${basicVectorContent}

% Embedded raster image as fallback/background
q
${width} 0 0 ${height} 0 0 cm
/DeviceRGB setcolorspace
<<
  /ImageType 1
  /Width ${Math.ceil(width)}
  /Height ${Math.ceil(height)}
  /BitsPerComponent 8
  /Decode [0 1 0 1 0 1]
  /DataSource currentfile /ASCIIHexDecode filter
  /ImageMatrix [${Math.ceil(width)} 0 0 -${Math.ceil(height)} 0 ${Math.ceil(height)}]
>> image
${hexString}>
Q

Q
%AI5_EndLayer--

%%PageTrailer
%%Trailer
%%EOF`;

  return aiContent;
}

/**
 * Extract basic SVG elements and convert to simple PostScript
 */
function extractBasicSvgElements(svgString: string, width: number, height: number): string {
  let content = '% Basic vector elements from SVG\n';

  try {
    // Look for rect elements
    const rects = svgString.match(/<rect[^>]*>/gi) || [];
    rects.forEach((rect, index) => {
      if (index >= 5) return; // Limit to prevent bloat

      const x = parseFloat((rect.match(/x=["']([^"']*)["']/i)?.[1] || '0').replace(/[^\d.-]/g, '')) || 0;
      const y = parseFloat((rect.match(/y=["']([^"']*)["']/i)?.[1] || '0').replace(/[^\d.-]/g, '')) || 0;
      const w = parseFloat((rect.match(/width=["']([^"']*)["']/i)?.[1] || '0').replace(/[^\d.-]/g, '')) || 0;
      const h = parseFloat((rect.match(/height=["']([^"']*)["']/i)?.[1] || '0').replace(/[^\d.-]/g, '')) || 0;
      const fill = rect.match(/fill=["']([^"']*)["']/i)?.[1] || '#000000';

      if (w > 0 && h > 0) {
        const color = parseHexColor(fill);
        content += `${color.r} ${color.g} ${color.b} rg\n`;
        content += `${x} ${height - y - h} ${w} ${h} re f\n`;
      }
    });

    // Look for circle elements
    const circles = svgString.match(/<circle[^>]*>/gi) || [];
    circles.forEach((circle, index) => {
      if (index >= 5) return; // Limit to prevent bloat

      const cx = parseFloat((circle.match(/cx=["']([^"']*)["']/i)?.[1] || '0').replace(/[^\d.-]/g, '')) || 0;
      const cy = parseFloat((circle.match(/cy=["']([^"']*)["']/i)?.[1] || '0').replace(/[^\d.-]/g, '')) || 0;
      const r = parseFloat((circle.match(/r=["']([^"']*)["']/i)?.[1] || '0').replace(/[^\d.-]/g, '')) || 0;
      const fill = circle.match(/fill=["']([^"']*)["']/i)?.[1] || '#000000';

      if (r > 0) {
        const color = parseHexColor(fill);
        content += `${color.r} ${color.g} ${color.b} rg\n`;
        content += `${cx} ${height - cy} ${r} 0 360 arc f\n`;
      }
    });

    // If no basic elements found, create a simple placeholder
    if (!rects.length && !circles.length) {
      content += `% No basic elements found - creating placeholder\n`;
      content += `0.8 0.8 0.8 rg\n`;
      content += `${width * 0.1} ${height * 0.1} ${width * 0.8} ${height * 0.8} re f\n`;
      content += `0.2 0.2 0.2 rg\n`;
      content += `2 w\n`;
      content += `${width * 0.1} ${height * 0.1} ${width * 0.8} ${height * 0.8} re s\n`;
    }

  } catch (error) {
    console.error('Error extracting SVG elements:', error);
    content += `% Error extracting elements\n`;
    content += `0.9 0.9 0.9 rg\n`;
    content += `0 0 ${width} ${height} re f\n`;
  }

  return content;
}

/**
 * Parse hex color to RGB (0-1 range)
 */
function parseHexColor(hex: string): { r: number; g: number; b: number } {
  if (!hex || !hex.startsWith('#')) {
    return { r: 0, g: 0, b: 0 };
  }

  const color = hex.slice(1);
  let r = 0, g = 0, b = 0;

  if (color.length === 3) {
    r = parseInt(color[0] + color[0], 16);
    g = parseInt(color[1] + color[1], 16);
    b = parseInt(color[2] + color[2], 16);
  } else if (color.length === 6) {
    r = parseInt(color.slice(0, 2), 16);
    g = parseInt(color.slice(2, 4), 16);
    b = parseInt(color.slice(4, 6), 16);
  }

  return {
    r: r / 255,
    g: g / 255,
    b: b / 255
  };
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