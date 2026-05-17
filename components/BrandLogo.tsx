interface BrandLogoIconProps {
  className?: string;
}

export function BrandLogoIcon({ className = 'h-6 w-6' }: BrandLogoIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Shield outline */}
      <path
        d="M12 2L3.5 6.5V12c0 4.9 3.8 9.3 8.5 10.5C16.7 21.3 20.5 16.9 20.5 12V6.5L12 2z"
        fill="currentColor"
        fillOpacity="0.15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Data bars — decreasing width = data being filtered/controlled */}
      <path d="M8 9.5h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 12.5h5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 15.5h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
