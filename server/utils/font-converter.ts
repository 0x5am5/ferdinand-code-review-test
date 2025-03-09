import { spawn } from 'child_process';
import { FontFormat } from '@shared/schema';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

/**
 * Converts a font file to different formats using FontForge
 */
export async function convertFont(inputBuffer: Buffer, originalFormat: string): Promise<Record<string, string>> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'font-conversion-'));
  const inputPath = path.join(tempDir, `input.${originalFormat}`);
  await fs.writeFile(inputPath, inputBuffer);

  const conversions: Record<string, string> = {};
  const formats = Object.values(FontFormat);

  for (const format of formats) {
    const outputPath = path.join(tempDir, `output.${format}`);
    await new Promise((resolve, reject) => {
      const script = `
        Open($1)
        Generate($2)
      `;
      
      const fontforge = spawn('fontforge', ['-c', script, inputPath, outputPath]);
      
      fontforge.on('close', (code) => {
        if (code === 0) {
          resolve(null);
        } else {
          reject(new Error(`FontForge exited with code ${code}`));
        }
      });
    });

    // Read the converted file and store it as base64
    const convertedBuffer = await fs.readFile(outputPath);
    conversions[format] = convertedBuffer.toString('base64');
  }

  // Clean up temp directory
  await fs.rm(tempDir, { recursive: true });

  return conversions;
}

/**
 * Extract font metadata using FontForge
 */
export async function extractFontMetadata(inputBuffer: Buffer, originalFormat: string): Promise<{
  family: string;
  weight: number;
  style: string;
}> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'font-metadata-'));
  const inputPath = path.join(tempDir, `input.${originalFormat}`);
  await fs.writeFile(inputPath, inputBuffer);

  const result = await new Promise<{ family: string; weight: number; style: string }>((resolve, reject) => {
    const script = `
      import fontforge
      font = fontforge.open($1)
      print(font.familyname)
      print(font.weight)
      print("italic" if font.is_italic else "normal")
    `;
    
    const fontforge = spawn('fontforge', ['-c', script, inputPath]);
    let output = '';
    
    fontforge.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    fontforge.on('close', (code) => {
      if (code === 0) {
        const [family, weight, style] = output.trim().split('\n');
        resolve({
          family,
          weight: parseInt(weight, 10),
          style,
        });
      } else {
        reject(new Error(`FontForge exited with code ${code}`));
      }
    });
  });

  // Clean up temp directory
  await fs.rm(tempDir, { recursive: true });

  return result;
}
