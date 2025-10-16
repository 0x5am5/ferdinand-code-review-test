interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export const FerdinandLogo = ({
  className,
  width = 159,
  height = 33,
}: LogoProps) => {
  return (
    <img
      src="/ferdinand-logo.svg"
      className={className}
      width={width}
      height={height}
      alt="Ferdinand Logo"
    />
  );
};

export const BullLogo = ({
  className,
  width = 100,
  height = 60,
}: LogoProps) => {
  return (
    <img
      src="/bull-logo.svg"
      className={className}
      width={width}
      height={height}
      alt="Bull Logo"
    />
  );
};
