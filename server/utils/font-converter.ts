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
    await new Promise<void>((resolve, reject) => {
      const script = `
        Open($1)
        Generate($2)
      `;

      const fontforge = spawn('fontforge', ['-c', script, inputPath, outputPath]);

      let errorOutput = '';

      fontforge.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      fontforge.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FontForge exited with code ${code}: ${errorOutput}`));
        }
      });
    });

    try {
      // Read the converted file and store it as base64
      const convertedBuffer = await fs.readFile(outputPath);
      conversions[format] = convertedBuffer.toString('base64');
    } catch (error) {
      console.error(`Error reading converted font file: ${error}`);
      throw error;
    }
  }

  // Clean up temp directory
  await fs.rm(tempDir, { recursive: true, force: true });

  return conversions;
}

/**
 * Extract font metadata using FontForge
 */
export async function extractFontMetadata(inputBuffer: Buffer, originalFormat: string): Promise<{
  family: string;
  weight: number;
  style: string;
  characters?: string;
}> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'font-metadata-'));
  const inputPath = path.join(tempDir, `input.${originalFormat}`);
  await fs.writeFile(inputPath, inputBuffer);

  const result = await new Promise<{ family: string; weight: number; style: string; characters?: string }>((resolve, reject) => {
    const script = `
      import fontforge
      font = fontforge.open("${inputPath}")
      print(font.familyname)
      print(font.weight)
      print("italic" if font.is_italic else "normal")
      # Get character set
      chars = []
      for glyph in font.glyphs():
          if glyph.unicode > 0:
              chars.append(chr(glyph.unicode))
      print("".join(sorted(chars)))
    `;

    const fontforge = spawn('fontforge', ['-c', script]);
    let output = '';
    let errorOutput = '';

    fontforge.stdout.on('data', (data) => {
      output += data.toString();
    });

    fontforge.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    fontforge.on('close', (code) => {
      if (code === 0) {
        const [family, weight, style, characters] = output.trim().split('\n');
        resolve({
          family,
          weight: parseInt(weight, 10),
          style,
          characters,
        });
      } else {
        reject(new Error(`FontForge exited with code ${code}: ${errorOutput}`));
      }
    });
  });

  // Clean up temp directory
  await fs.rm(tempDir, { recursive: true, force: true });

  return result;
}