// Function to download editable design files (SVG, EPS, AI)
const downloadEditableFiles = (format) => {
  try {
    // Create an invisible container for download links
    const container = document.createElement('div');
    container.style.display = 'none';
    document.body.appendChild(container);
    
    // Add logging to help debug what's being downloaded
    console.log(`Downloading ${format} vector file for ID: ${logo.id}, Name: ${logo.name}, Client: ${logo.clientId}`);
    
    // Create direct URL to ensure we preserve vector properties
    const baseUrl = variant === 'dark' && parsedData.hasDarkVariant ? 
      `/api/assets/${logo.id}/file?variant=dark` : 
      `/api/assets/${logo.id}/file`;
    
    // Add preserveVector parameter to maintain editability
    const url = `${baseUrl}&format=${format}&preserveVector=true`;
    
    // Create download link with our improved URL
    const link = document.createElement('a');
    link.href = url;
    link.download = `${logo.name}${variant === 'dark' ? '-Dark' : ''}.${format}`;
    container.appendChild(link);
    link.click();
