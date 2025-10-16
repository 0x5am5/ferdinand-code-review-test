interface PatternProps {
  className?: string;
  width?: number | string;
  height?: number | string;
}

export const BackgroundPattern = ({
  className,
  width = "2876",
  height = "2876",
}: PatternProps) => {
  return (
    <img
      src="/brand-pattern.svg"
      className={className}
      width={width}
      height={height}
      alt=""
      aria-hidden="true"
    />
  );
};
