interface PatternProps {
  className?: string;
  width?: number | string;
  height?: number | string;
}

export const BackgroundPattern = ({ className, width = "2876", height = "2876" }: PatternProps) => {
  return (
    <svg 
      className={className}
      width={width} 
      height={height} 
      viewBox="0 0 2876 2876" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <g opacity="0.3">
        <circle cx="1438" cy="1438" r="200" fill="currentColor" />
        <circle cx="800" cy="800" r="150" fill="currentColor" />
        <circle cx="2000" cy="2000" r="180" fill="currentColor" />
        <circle cx="600" cy="1800" r="120" fill="currentColor" />
        <circle cx="2200" cy="600" r="160" fill="currentColor" />
      </g>
    </svg>
  );
};