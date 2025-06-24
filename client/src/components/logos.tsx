interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export const FerdinandLogo = ({ className, width = 159, height = 33 }: LogoProps) => {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 159 33"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0.76 2.88H19.8L20.28 8.88H20.04C18 4.32 16.68 3.52 12.36 3.52H7.16V17.32H11.64C15.24 17.32 16.04 16.36 16.72 13.4H16.96V22.16H16.72C16.04 19.32 15.24 17.96 11.64 17.96H7.16V27C7.16 29.96 7.32 31.76 10.04 31.76V32H0.76V31.76C3.48 31.76 3.64 29.96 3.64 27V7.88C3.64 4.92 3.48 3.12 0.76 3.12V2.88Z"
        fill="currentColor"
      />
    </svg>
  );
};