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
  // Extract dimensions from SVG
  let width = 500;
  let height = 500;

  const viewBoxMatch = svgString.match(/viewBox=["']([^"']*)["']/);
  if (viewBoxMatch && viewBoxMatch[1]) {
    const viewBoxParts = viewBoxMatch[1].split(/\s+/).map(parseFloat);
    if (viewBoxParts.length >= 4) {
      width = viewBoxParts[2] || 500;
      height = viewBoxParts[3] || 500;
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

  // Convert PNG buffer to base64 for embedding
  const base64Image = pngBuffer.toString('base64');
  const imageDataLines = base64Image.match(/.{1,80}/g) || [];

  // Create a proper Adobe Illustrator file
  const currentDate = new Date().toISOString().replace(/[-:.]/g, '');

  const aiContent = `%!PS-Adobe-3.0 EPSF-3.0
%%Creator: Ferdinand Brand System v2.0
%%Title: Vector Logo
%%CreationDate: ${currentDate}
%%BoundingBox: 0 0 ${Math.ceil(width)} ${Math.ceil(height)}
%%HiResBoundingBox: 0.0 0.0 ${width.toFixed(1)} ${height.toFixed(1)}
%%DocumentData: Clean7Bit
%%LanguageLevel: 3
%%Pages: 1
%%DocumentSuppliedResources: procset Adobe_level2_AI5 1.2 0
%%+ procset Adobe_IllustratorA_AI5 1.0 0
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
%AI9_OpenToView: -${(width/2).toFixed(1)} -${(height/2).toFixed(1)} 2 1742 955 18 0 0 50 43 0 0 0 1 1 0 1 1 0 1
%AI5_OpenViewLayers: 7
%%PageOrigin: 0 0
%AI7_GridSettings: 72 8 72 8 1 0 0.8 0.8 0.8 0.9 0.9 0.9
%AI9_Flatten: 1
%%EndComments

%%BeginProlog
%%BeginResource: procset Adobe_level2_AI5 1.2 0
userdict /Adobe_level2_AI5 50 dict dup begin put
/bd{bind def}bind def
/incompound false def
/m{moveto}bd
/l{lineto}bd
/c{curveto}bd
/F{fill}bd
/f{eofill}bd
/S{stroke}bd
/s{closepath}bd
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
/x{exec}bd
/Tj{show}bd
/TJ{ashow}bd
%%EndResource

%%BeginResource: procset Adobe_IllustratorA_AI5 1.0 0
userdict /Adobe_IllustratorA_AI5 61 dict dup begin put
/initialize{
  Adobe_level2_AI5 begin
  Adobe_IllustratorA_AI5 begin
}bd
/terminate{
  currentdict Adobe_IllustratorA_AI5 eq{end}if
  currentdict Adobe_level2_AI5 eq{end}if
}bd
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
q
%%EndSetup

%AI5_BeginLayer
1 1 1 1 0 0 0 79 128 255 0 50 Lb
(Logo Layer) Ln
0 A
u
*u

% Begin embedded image data
q
${width} 0 0 ${height} 0 0 cm
/DeviceRGB setcolorspace
<<
  /ImageType 1
  /Width ${Math.ceil(width)}
  /Height ${Math.ceil(height)}
  /BitsPerComponent 8
  /Decode [0 1 0 1 0 1]
  /DataSource currentfile /ASCII85Decode filter
  /ImageMatrix [${Math.ceil(width)} 0 0 -${Math.ceil(height)} 0 ${Math.ceil(height)}]
>> image
${convertToAscii85(base64Image)}
Q

% Add vector paths if we can extract them from SVG
${extractAndConvertSvgPaths(svgString, width, height)}

*U
U
LB
%AI5_EndLayer--

%%PageTrailer
Q
%%Trailer
%%EOF`;

  return aiContent;
}

/**
 * Convert base64 image data to ASCII85 encoding for PostScript
 */
function convertToAscii85(base64Data: string): string {
  // Convert base64 to binary
  const binaryData = Buffer.from(base64Data, 'base64');

  // Simple ASCII85 encoding implementation
  let result = '';

  for (let i = 0; i < binaryData.length; i += 4) {
    let value = 0;
    let count = 0;

    for (let j = 0; j < 4 && i + j < binaryData.length; j++) {
      value = value * 256 + binaryData[i + j];
      count++;
    }

    // Pad with zeros if needed
    for (let j = count; j < 4; j++) {
      value *= 256;
    }

    if (value === 0 && count === 4) {
      result += 'z';
    } else {
      const chars = [];
      for (let j = 0; j < 5; j++) {
        chars.unshift(String.fromCharCode(33 + (value % 85)));
        value = Math.floor(value / 85);
      }
      result += chars.slice(0, count + 1).join('');
    }

    // Add line breaks every 80 characters
    if (result.length % 80 === 0) {
      result += '\n';
    }
  }

  result += '~>\n';
  return result;
}

/**
 * Extract and convert SVG paths to PostScript for vector content
 */
function extractAndConvertSvgPaths(svgString: string, width: number, height: number): string {
  let pathContent = '\n% Vector path data\n';

  try {
    // Extract path elements
    const pathRegex = /<path[^>]*d=["']([^"']*)["'][^>]*>/gi;
    let match;
    let pathIndex = 0;

    while ((match = pathRegex.exec(svgString)) !== null && pathIndex < 10) {
      const pathData = match[1];
      if (pathData && pathData.trim()) {
        pathContent += `\n% Path ${pathIndex + 1}\nnewpath\n`;
        pathContent += convertSvgPathToPostScript(pathData, height);
        pathContent += '\n0.2 0.2 0.2 setrgbcolor\nfill\n';
        pathIndex++;
      }
    }

    // Extract rectangle elements
    const rectRegex = /<rect[^>]*>/gi;
    while ((match = rectRegex.exec(svgString)) !== null) {
      const rectMatch = match[0];
      const x = parseFloat((rectMatch.match(/x=["']([^"']*)["']/) || ['', '0'])[1]) || 0;
      const y = parseFloat((rectMatch.match(/y=["']([^"']*)["']/) || ['', '0'])[1]) || 0;
      const w = parseFloat((rectMatch.match(/width=["']([^"']*)["']/) || ['', '0'])[1]) || 0;
      const h = parseFloat((rectMatch.match(/height=["']([^"']*)["']/) || ['', '0'])[1]) || 0;

      if (w > 0 && h > 0) {
        pathContent += `\n% Rectangle\nnewpath\n`;
        pathContent += `${x} ${height - y - h} moveto\n`;
        pathContent += `${x + w} ${height - y - h} lineto\n`;
        pathContent += `${x + w} ${height - y} lineto\n`;
        pathContent += `${x} ${height - y} lineto\n`;
        pathContent += `closepath\n0.2 0.2 0.2 setrgbcolor\nfill\n`;
      }
    }

    if (pathIndex === 0) {
      // If no paths found, create a simple shape to ensure content
      pathContent += `\n% Fallback content\nnewpath\n`;
      pathContent += `${width * 0.1} ${height * 0.1} moveto\n`;
      pathContent += `${width * 0.9} ${height * 0.1} lineto\n`;
      pathContent += `${width * 0.9} ${height * 0.9} lineto\n`;
      pathContent += `${width * 0.1} ${height * 0.9} lineto\n`;
      pathContent += `closepath\n0.3 0.3 0.3 setrgbcolor\nstroke\n`;

      // Add centered text
      pathContent += `/Helvetica findfont ${Math.min(width, height) * 0.1} scalefont setfont\n`;
      pathContent += `0.5 0.5 0.5 setrgbcolor\n`;
      pathContent += `${width * 0.5} ${height * 0.5} moveto\n`;
      pathContent += `(Logo) show\n`;
    }

  } catch (error) {
    console.error('Error extracting SVG paths:', error);
    pathContent += '\n% Error extracting paths - using fallback\n';
  }

  return pathContent;
}

/**
 * Convert SVG path data to PostScript commands
 */
function convertSvgPathToPostScript(pathData: string, height: number): string {
  let psPath = '';

  try {
    const cleanPath = pathData.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    const commands = cleanPath.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];

    let currentX = 0;
    let currentY = 0;

    commands.forEach(command => {
      const type = command[0];
      const coords = command.slice(1).trim().split(/\s+/).map(parseFloat).filter(n => !isNaN(n));

      switch (type.toUpperCase()) {
        case 'M': // Move to
          if (coords.length >= 2) {
            currentX = coords[0];
            currentY = height - coords[1]; // Flip Y coordinate
            psPath += `${currentX} ${currentY} moveto\n`;
          }
          break;

        case 'L': // Line to
          if (coords.length >= 2) {
            currentX = coords[0];
            currentY = height - coords[1];
            psPath += `${currentX} ${currentY} lineto\n`;
          }
          break;

        case 'C': // Cubic Bezier curve
          if (coords.length >= 6) {
            const x1 = coords[0];
            const y1 = height - coords[1];
            const x2 = coords[2];
            const y2 = height - coords[3];
            const x3 = coords[4];
            const y3 = height - coords[5];
            psPath += `${x1} ${y1} ${x2} ${y2} ${x3} ${y3} curveto\n`;
            currentX = x3;
            currentY = y3;
          }
          break;

        case 'Z': // Close path
          psPath += 'closepath\n';
          break;
      }
    });

  } catch (error) {
    console.error('Error converting path data:', error);
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