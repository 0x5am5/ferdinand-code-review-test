// Test the simplified conversion approach with actual path elements
const testSvg = `<path d="M377.45,84.62,360.29,97.88c-6-9"/>
<path d="M520.06,135.39c0,33-22.51"/>
<path class="some-class" d="M684.66,61.41V185.74"/>
<path fill="blue" d="M851,61.41V185.74"/>
<path fill="white" d="Already white"/>`;

console.log("Original:");
console.log(testSvg);

let whiteSvgContent = testSvg;

// Apply the simple conversion logic
const shapeElements = ['path'];

shapeElements.forEach(elementType => {
  const elementRegex = new RegExp(`<${elementType}([^>]*)>`, 'gi');
  whiteSvgContent = whiteSvgContent.replace(elementRegex, (match, attributes) => {
    if (attributes.includes('fill="white"')) {
      return match;
    }
    return `<${elementType}${attributes} fill="white">`;
  });
});

console.log("\nConverted:");
console.log(whiteSvgContent);