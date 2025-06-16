
interface FontData {
  source: string;
  sourceData: any;
  name: string;
}

export class FontLoader {
  private static loadedFonts = new Set<string>();

  static loadFont(font: FontData): Promise<void> {
    return new Promise((resolve, reject) => {
      const fontKey = `${font.source}-${font.name}`;
      
      if (this.loadedFonts.has(fontKey)) {
        resolve();
        return;
      }

      try {
        let linkElement: HTMLLinkElement;

        switch (font.source) {
          case 'google':
            if (font.sourceData?.url) {
              linkElement = this.createLinkElement(font.sourceData.url);
            } else {
              // Fallback URL generation
              const fontName = font.name.replace(/\s+/g, '+');
              const url = `https://fonts.googleapis.com/css2?family=${fontName}:wght@400;700&display=swap`;
              linkElement = this.createLinkElement(url);
            }
            break;

          case 'adobe':
            if (font.sourceData?.url || font.sourceData?.projectId) {
              const url = font.sourceData.url || `https://use.typekit.net/${font.sourceData.projectId}.css`;
              linkElement = this.createLinkElement(url);
            } else {
              reject(new Error('Adobe font missing project ID or URL'));
              return;
            }
            break;

          case 'file':
            // For custom fonts, we'd need to handle file uploads differently
            // This would require the font files to be served statically
            console.warn('Custom font loading not implemented yet');
            resolve();
            return;

          default:
            reject(new Error(`Unknown font source: ${font.source}`));
            return;
        }

        linkElement.onload = () => {
          this.loadedFonts.add(fontKey);
          console.log(`Font loaded successfully: ${font.name}`);
          resolve();
        };

        linkElement.onerror = () => {
          console.error(`Failed to load font: ${font.name}`);
          reject(new Error(`Failed to load font: ${font.name}`));
        };

        document.head.appendChild(linkElement);

      } catch (error) {
        console.error(`Error loading font ${font.name}:`, error);
        reject(error);
      }
    });
  }

  private static createLinkElement(url: string): HTMLLinkElement {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.type = 'text/css';
    return link;
  }

  static async loadFonts(fonts: FontData[]): Promise<void> {
    console.log(`Loading ${fonts.length} fonts...`);
    
    const loadPromises = fonts.map(font => 
      this.loadFont(font).catch(error => {
        console.warn(`Failed to load font ${font.name}:`, error);
        return null; // Don't fail the entire batch for one font
      })
    );

    await Promise.all(loadPromises);
    console.log('Font loading completed');
  }

  static isLoaded(fontName: string, source: string): boolean {
    return this.loadedFonts.has(`${source}-${fontName}`);
  }

  static getLoadedFonts(): string[] {
    return Array.from(this.loadedFonts);
  }
}
