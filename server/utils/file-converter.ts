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

    // Create proper Adobe Illustrator AI file
    try {
      const svgString = fileBuffer.toString('utf-8');
      const aiContent = await createProperAiFile(svgString, pngBuffer);

      convertedFiles.push({
        format: 'ai',
        data: Buffer.from(aiContent),
        mimeType: 'application/postscript'
      });

      console.log('Successfully created Adobe Illustrator file with embedded content');
    } catch (error) {
      console.error("Error creating AI file:", error);
    }
  }
}

/**
 * Create a proper Adobe Illustrator file with embedded content
 */
async function createProperAiFile(svgString: string, pngBuffer: Buffer): Promise<string> {
  // Extract dimensions from SVG with better parsing
  let width = 500;
  let height = 500;

  try {
    // Try viewBox first (most reliable)
    const viewBoxMatch = svgString.match(/viewBox=["']([^"']*)["']/i);
    if (viewBoxMatch && viewBoxMatch[1]) {
      const viewBoxParts = viewBoxMatch[1].trim().split(/[\s,]+/).map(parseFloat);
      if (viewBoxParts.length >= 4 && !isNaN(viewBoxParts[2]) && !isNaN(viewBoxParts[3])) {
        width = Math.max(viewBoxParts[2], 100);
        height = Math.max(viewBoxParts[3], 100);
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
    width = 500;
    height = 500;
  }

  console.log(`Creating AI file with dimensions: ${width}x${height}px`);

  // Generate current timestamp for file metadata
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);

  // Extract and convert SVG content to PostScript paths
  const vectorPaths = await extractSvgVectorPaths(svgString, width, height);

  // Create Adobe Illustrator file with proper structure
  const aiContent = `%!PS-Adobe-3.0 EPSF-3.0
%%Creator: Ferdinand Brand System v2.0
%%Title: Vector Logo
%%CreationDate: ${timestamp}
%%BoundingBox: 0 0 ${Math.ceil(width)} ${Math.ceil(height)}
%%HiResBoundingBox: 0.0 0.0 ${width.toFixed(1)} ${height.toFixed(1)}
%%DocumentData: Clean7Bit
%%LanguageLevel: 3
%%Pages: 1
%%DocumentSuppliedResources: procset Adobe_level2_AI5 1.2 0
%%+ procset Adobe_IllustratorA_AI5 1.0 0
%%+ procset Adobe_ColorImage_AI6 1.1 0
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
%%BeginResource: procset Adobe_level2_AI5 1.2 0
userdict /Adobe_level2_AI5 85 dict dup begin put
/bd{bind def}bind def
/incompound false def
/m{moveto}bd
/l{lineto}bd
/c{curveto}bd
/v{currentpoint 6 2 roll curveto}bd
/y{2 copy curveto}bd
/re{4 2 roll moveto 1 index 0 rlineto 0 exch rlineto neg 0 rlineto closepath}bd
/f{eofill}bd
/F{fill}bd
/s{closepath stroke}bd
/S{stroke}bd
/W{clip}bd
/w{setlinewidth}bd
/j{setlinejoin}bd
/J{setlinecap}bd
/M{setmiterlimit}bd
/d{setdash}bd
/q{gsave}bd
/Q{grestore}bd
/h{closepath}bd
/H{setflat}bd
/i{setcolor}bd
/rg{setrgbcolor}bd
/k{setcmykcolor}bd
/g{setgray}bd
/G{setgray}bd
/sc{setcolor}bd
/SC{setcolor}bd
%%EndResource

%%BeginResource: procset Adobe_IllustratorA_AI5 1.0 0
userdict /Adobe_IllustratorA_AI5 95 dict dup begin put
/initialize{
  Adobe_level2_AI5 begin
  Adobe_IllustratorA_AI5 begin
}bd
/terminate{
  currentdict Adobe_IllustratorA_AI5 eq{end}if
  currentdict Adobe_level2_AI5 eq{end}if
}bd
/Lb{6 -2 roll 4 -2 roll exch 4 2 roll 6 2 roll}bd
/Ln{pop}bd
/XR{pop}bd
%%EndResource

%%BeginResource: procset Adobe_ColorImage_AI6 1.1 0
userdict /Adobe_ColorImage_AI6 112 dict dup begin put
/initialize{
  Adobe_ColorImage_AI6 begin
  Adobe_IllustratorA_AI5 begin
  Adobe_level2_AI5 begin
}bd
/terminate{
  currentdict Adobe_level2_AI5 eq{end}if
  currentdict Adobe_IllustratorA_AI5 eq{end}if
  currentdict Adobe_ColorImage_AI6 eq{end}if
}bd
%%EndResource
%%EndProlog

%%BeginSetup
Adobe_IllustratorA_AI5 /initialize get exec
1 XR
0 0 ${width} ${height} rectclip
%%EndSetup

%AI5_BeginLayer
1 1 1 1 0 0 0 79 128 255 0 50 Lb
(Logo Vector Layer) Ln
0 A
q

% Set up coordinate system
0 0 ${width} ${height} rectclip

% Vector content from SVG
${vectorPaths}

% Fallback raster image for complex elements
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
${convertToASCIIHex(pngBuffer)}
>
Q

Q
LB
%AI5_EndLayer--

%%PageTrailer
%%Trailer
Adobe_IllustratorA_AI5 /terminate get exec
%%EOF`;

  return aiContent;
}

/**
 * Convert PNG buffer to ASCIIHex encoding for PostScript (more reliable than ASCII85)
 */
function convertToASCIIHex(buffer: Buffer): string {
  const hexString = buffer.toString('hex').toUpperCase();
  let result = '';
  
  // Add line breaks every 80 characters for readability
  for (let i = 0; i < hexString.length; i += 80) {
    result += hexString.slice(i, i + 80) + '\n';
  }
  
  return result;
}

/**
 * Extract and convert SVG content to PostScript vector paths
 */
async function extractSvgVectorPaths(svgString: string, width: number, height: number): Promise<string> {
  let pathContent = '% Vector content extracted from SVG\n';
  let hasVectorContent = false;

  try {
    // Set default styling
    pathContent += '% Default styling\n';
    pathContent += '1 setlinewidth\n';
    pathContent += '1 setlinejoin\n';
    pathContent += '1 setlinecap\n';
    pathContent += '\n';

    // Extract and convert path elements with better regex
    const pathRegex = /<path[^>]*d=["']([^"']*?)["'][^>]*(?:fill=["']([^"']*)["'])?[^>]*(?:stroke=["']([^"']*)["'])?[^>]*>/gi;
    let pathMatch;
    let pathIndex = 0;

    while ((pathMatch = pathRegex.exec(svgString)) !== null && pathIndex < 20) {
      const pathData = pathMatch[1];
      const fillColor = pathMatch[2];
      const strokeColor = pathMatch[3];

      if (pathData && pathData.trim()) {
        pathContent += `\n% Path ${pathIndex + 1}\n`;
        pathContent += 'newpath\n';
        
        const psPath = convertSvgPathToPostScript(pathData, height);
        if (psPath.trim()) {
          pathContent += psPath;
          
          // Apply colors if specified
          if (fillColor && fillColor !== 'none') {
            const rgb = parseColor(fillColor);
            pathContent += `${rgb.r} ${rgb.g} ${rgb.b} setrgbcolor\n`;
            pathContent += 'fill\n';
          } else if (strokeColor && strokeColor !== 'none') {
            const rgb = parseColor(strokeColor);
            pathContent += `${rgb.r} ${rgb.g} ${rgb.b} setrgbcolor\n`;
            pathContent += 'stroke\n';
          } else {
            // Default black fill
            pathContent += '0 0 0 setrgbcolor\n';
            pathContent += 'fill\n';
          }
          
          hasVectorContent = true;
          pathIndex++;
        }
      }
    }

    // Extract rectangle elements
    const rectRegex = /<rect[^>]*x=["']([^"']*)["'][^>]*y=["']([^"']*)["'][^>]*width=["']([^"']*)["'][^>]*height=["']([^"']*)["'][^>]*(?:fill=["']([^"']*)["'])?[^>]*>/gi;
    let rectMatch;
    
    while ((rectMatch = rectRegex.exec(svgString)) !== null) {
      const x = parseFloat(rectMatch[1]) || 0;
      const y = parseFloat(rectMatch[2]) || 0;
      const w = parseFloat(rectMatch[3]) || 0;
      const h = parseFloat(rectMatch[4]) || 0;
      const fill = rectMatch[5];

      if (w > 0 && h > 0) {
        pathContent += `\n% Rectangle at (${x}, ${y}) size ${w}x${h}\n`;
        pathContent += 'newpath\n';
        pathContent += `${x} ${height - y - h} ${w} ${h} re\n`;
        
        if (fill && fill !== 'none') {
          const rgb = parseColor(fill);
          pathContent += `${rgb.r} ${rgb.g} ${rgb.b} setrgbcolor\n`;
        } else {
          pathContent += '0 0 0 setrgbcolor\n';
        }
        pathContent += 'fill\n';
        hasVectorContent = true;
      }
    }

    // Extract circle elements
    const circleRegex = /<circle[^>]*cx=["']([^"']*)["'][^>]*cy=["']([^"']*)["'][^>]*r=["']([^"']*)["'][^>]*(?:fill=["']([^"']*)["'])?[^>]*>/gi;
    let circleMatch;
    
    while ((circleMatch = circleRegex.exec(svgString)) !== null) {
      const cx = parseFloat(circleMatch[1]) || 0;
      const cy = parseFloat(circleMatch[2]) || 0;
      const r = parseFloat(circleMatch[3]) || 0;
      const fill = circleMatch[4];

      if (r > 0) {
        pathContent += `\n% Circle at (${cx}, ${cy}) radius ${r}\n`;
        pathContent += 'newpath\n';
        pathContent += `${cx} ${height - cy} ${r} 0 360 arc\n`;
        
        if (fill && fill !== 'none') {
          const rgb = parseColor(fill);
          pathContent += `${rgb.r} ${rgb.g} ${rgb.b} setrgbcolor\n`;
        } else {
          pathContent += '0 0 0 setrgbcolor\n';
        }
        pathContent += 'fill\n';
        hasVectorContent = true;
      }
    }

    // If no vector content found, create a placeholder
    if (!hasVectorContent) {
      pathContent += `\n% No vector content extracted - creating placeholder\n`;
      pathContent += 'newpath\n';
      pathContent += `${width * 0.1} ${height * 0.1} ${width * 0.8} ${height * 0.8} re\n`;
      pathContent += '0.8 0.8 0.8 setrgbcolor\n';
      pathContent += 'fill\n';
      pathContent += 'newpath\n';
      pathContent += `${width * 0.1} ${height * 0.1} ${width * 0.8} ${height * 0.8} re\n`;
      pathContent += '0.2 0.2 0.2 setrgbcolor\n';
      pathContent += '2 setlinewidth\n';
      pathContent += 'stroke\n';
      
      // Add text
      pathContent += '/Helvetica-Bold findfont\n';
      pathContent += `${Math.min(width, height) * 0.08} scalefont\n`;
      pathContent += 'setfont\n';
      pathContent += '0.2 0.2 0.2 setrgbcolor\n';
      pathContent += `${width * 0.5} ${height * 0.5} moveto\n`;
      pathContent += '(LOGO) dup stringwidth pop 2 div neg 0 rmoveto show\n';
    }

  } catch (error) {
    console.error('Error extracting SVG vector paths:', error);
    pathContent += '\n% Error extracting paths - using error placeholder\n';
    pathContent += 'newpath\n';
    pathContent += `0 0 ${width} ${height} re\n`;
    pathContent += '1 0.9 0.9 setrgbcolor\n';
    pathContent += 'fill\n';
  }

  return pathContent;
}

/**
 * Parse color string to RGB values (0-1 range)
 */
function parseColor(colorStr: string): { r: number; g: number; b: number } {
  if (!colorStr || colorStr === 'none') {
    return { r: 0, g: 0, b: 0 };
  }

  // Handle hex colors
  if (colorStr.startsWith('#')) {
    const hex = colorStr.slice(1);
    let r = 0, g = 0, b = 0;
    
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
    
    return {
      r: r / 255,
      g: g / 255,
      b: b / 255
    };
  }

  // Handle named colors
  const namedColors: { [key: string]: { r: number; g: number; b: number } } = {
    'black': { r: 0, g: 0, b: 0 },
    'white': { r: 1, g: 1, b: 1 },
    'red': { r: 1, g: 0, b: 0 },
    'green': { r: 0, g: 1, b: 0 },
    'blue': { r: 0, g: 0, b: 1 },
    'gray': { r: 0.5, g: 0.5, b: 0.5 },
    'grey': { r: 0.5, g: 0.5, b: 0.5 }
  };

  return namedColors[colorStr.toLowerCase()] || { r: 0, g: 0, b: 0 };
}

/**
 * Convert SVG path data to PostScript commands with improved parsing
 */
function convertSvgPathToPostScript(pathData: string, height: number): string {
  let psPath = '';
  let currentX = 0;
  let currentY = 0;
  let lastControlX = 0;
  let lastControlY = 0;

  try {
    // Clean and normalize the path data
    const cleanPath = pathData
      .replace(/,/g, ' ')
      .replace(/([MmLlHhVvCcSsQqTtAaZz])/g, ' $1 ')
      .replace(/\s+/g, ' ')
      .trim();

    // Split into commands with their parameters
    const tokens = cleanPath.split(/\s+/);
    let i = 0;

    while (i < tokens.length) {
      const command = tokens[i];
      if (!command || !/[MmLlHhVvCcSsQqTtAaZz]/.test(command)) {
        i++;
        continue;
      }

      const isRelative = command === command.toLowerCase();
      const cmdType = command.toUpperCase();
      i++;

      switch (cmdType) {
        case 'M': // Move to
          while (i + 1 < tokens.length && !/[MmLlHhVvCcSsQqTtAaZz]/.test(tokens[i])) {
            const x = parseFloat(tokens[i]);
            const y = parseFloat(tokens[i + 1]);
            
            if (!isNaN(x) && !isNaN(y)) {
              currentX = isRelative ? currentX + x : x;
              currentY = isRelative ? currentY + y : y;
              const psY = height - currentY;
              psPath += `${currentX.toFixed(2)} ${psY.toFixed(2)} moveto\n`;
            }
            i += 2;
          }
          break;

        case 'L': // Line to
          while (i + 1 < tokens.length && !/[MmLlHhVvCcSsQqTtAaZz]/.test(tokens[i])) {
            const x = parseFloat(tokens[i]);
            const y = parseFloat(tokens[i + 1]);
            
            if (!isNaN(x) && !isNaN(y)) {
              currentX = isRelative ? currentX + x : x;
              currentY = isRelative ? currentY + y : y;
              const psY = height - currentY;
              psPath += `${currentX.toFixed(2)} ${psY.toFixed(2)} lineto\n`;
            }
            i += 2;
          }
          break;

        case 'H': // Horizontal line
          while (i < tokens.length && !/[MmLlHhVvCcSsQqTtAaZz]/.test(tokens[i])) {
            const x = parseFloat(tokens[i]);
            
            if (!isNaN(x)) {
              currentX = isRelative ? currentX + x : x;
              const psY = height - currentY;
              psPath += `${currentX.toFixed(2)} ${psY.toFixed(2)} lineto\n`;
            }
            i++;
          }
          break;

        case 'V': // Vertical line
          while (i < tokens.length && !/[MmLlHhVvCcSsQqTtAaZz]/.test(tokens[i])) {
            const y = parseFloat(tokens[i]);
            
            if (!isNaN(y)) {
              currentY = isRelative ? currentY + y : y;
              const psY = height - currentY;
              psPath += `${currentX.toFixed(2)} ${psY.toFixed(2)} lineto\n`;
            }
            i++;
          }
          break;

        case 'C': // Cubic Bezier curve
          while (i + 5 < tokens.length && !/[MmLlHhVvCcSsQqTtAaZz]/.test(tokens[i])) {
            const x1 = parseFloat(tokens[i]);
            const y1 = parseFloat(tokens[i + 1]);
            const x2 = parseFloat(tokens[i + 2]);
            const y2 = parseFloat(tokens[i + 3]);
            const x3 = parseFloat(tokens[i + 4]);
            const y3 = parseFloat(tokens[i + 5]);
            
            if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2) && !isNaN(x3) && !isNaN(y3)) {
              const cp1X = isRelative ? currentX + x1 : x1;
              const cp1Y = isRelative ? currentY + y1 : y1;
              const cp2X = isRelative ? currentX + x2 : x2;
              const cp2Y = isRelative ? currentY + y2 : y2;
              const endX = isRelative ? currentX + x3 : x3;
              const endY = isRelative ? currentY + y3 : y3;

              const psCP1Y = height - cp1Y;
              const psCP2Y = height - cp2Y;
              const psEndY = height - endY;

              psPath += `${cp1X.toFixed(2)} ${psCP1Y.toFixed(2)} ${cp2X.toFixed(2)} ${psCP2Y.toFixed(2)} ${endX.toFixed(2)} ${psEndY.toFixed(2)} curveto\n`;
              
              currentX = endX;
              currentY = endY;
              lastControlX = cp2X;
              lastControlY = cp2Y;
            }
            i += 6;
          }
          break;

        case 'S': // Smooth cubic Bezier curve
          while (i + 3 < tokens.length && !/[MmLlHhVvCcSsQqTtAaZz]/.test(tokens[i])) {
            const x2 = parseFloat(tokens[i]);
            const y2 = parseFloat(tokens[i + 1]);
            const x3 = parseFloat(tokens[i + 2]);
            const y3 = parseFloat(tokens[i + 3]);
            
            if (!isNaN(x2) && !isNaN(y2) && !isNaN(x3) && !isNaN(y3)) {
              // First control point is reflection of last control point
              const cp1X = 2 * currentX - lastControlX;
              const cp1Y = 2 * currentY - lastControlY;
              
              const cp2X = isRelative ? currentX + x2 : x2;
              const cp2Y = isRelative ? currentY + y2 : y2;
              const endX = isRelative ? currentX + x3 : x3;
              const endY = isRelative ? currentY + y3 : y3;

              const psCP1Y = height - cp1Y;
              const psCP2Y = height - cp2Y;
              const psEndY = height - endY;

              psPath += `${cp1X.toFixed(2)} ${psCP1Y.toFixed(2)} ${cp2X.toFixed(2)} ${psCP2Y.toFixed(2)} ${endX.toFixed(2)} ${psEndY.toFixed(2)} curveto\n`;
              
              currentX = endX;
              currentY = endY;
              lastControlX = cp2X;
              lastControlY = cp2Y;
            }
            i += 4;
          }
          break;

        case 'Q': // Quadratic Bezier curve (convert to cubic)
          while (i + 3 < tokens.length && !/[MmLlHhVvCcSsQqTtAaZz]/.test(tokens[i])) {
            const qx = parseFloat(tokens[i]);
            const qy = parseFloat(tokens[i + 1]);
            const x3 = parseFloat(tokens[i + 2]);
            const y3 = parseFloat(tokens[i + 3]);
            
            if (!isNaN(qx) && !isNaN(qy) && !isNaN(x3) && !isNaN(y3)) {
              const quadX = isRelative ? currentX + qx : qx;
              const quadY = isRelative ? currentY + qy : qy;
              const endX = isRelative ? currentX + x3 : x3;
              const endY = isRelative ? currentY + y3 : y3;

              // Convert quadratic to cubic Bezier
              const cp1X = currentX + (2/3) * (quadX - currentX);
              const cp1Y = currentY + (2/3) * (quadY - currentY);
              const cp2X = endX + (2/3) * (quadX - endX);
              const cp2Y = endY + (2/3) * (quadY - endY);

              const psCP1Y = height - cp1Y;
              const psCP2Y = height - cp2Y;
              const psEndY = height - endY;

              psPath += `${cp1X.toFixed(2)} ${psCP1Y.toFixed(2)} ${cp2X.toFixed(2)} ${psCP2Y.toFixed(2)} ${endX.toFixed(2)} ${psEndY.toFixed(2)} curveto\n`;
              
              currentX = endX;
              currentY = endY;
              lastControlX = quadX;
              lastControlY = quadY;
            }
            i += 4;
          }
          break;

        case 'Z': // Close path
          psPath += 'closepath\n';
          break;

        default:
          // Skip unknown commands
          i++;
          break;
      }
    }

  } catch (error) {
    console.error('Error converting SVG path to PostScript:', error);
    psPath += '% Error in path conversion\n';
  }

  return psPath;
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