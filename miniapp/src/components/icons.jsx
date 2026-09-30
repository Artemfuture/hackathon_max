const Svg = ({ size = 20, children, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    {children}
  </svg>
);

export const WalkIcon = (p) => (
  <Svg {...p}>
    <circle cx="13" cy="4.5" r="1.8" />
    <path d="M10 21l2-6 3 3v3M8 12l2-4 4 1 2 4 2 1M12 15l-1-5" />
  </Svg>
);

export const CarIcon = (p) => (
  <Svg {...p}>
    <path d="M5 11l2-5h10l2 5v6h-2a1.5 1.5 0 0 1-3 0h-4a1.5 1.5 0 0 1-3 0H5z" />
    <path d="M5 11h14" />
  </Svg>
);

export const MetroIcon = (p) => (
  <Svg {...p}>
    <path d="M4 18V10a8 8 0 0 1 16 0v8" />
    <path d="M7.5 18l2.5-8 2 4 2-4 2.5 8" />
  </Svg>
);

export const PinIcon = (p) => (
  <Svg {...p}>
    <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.3" />
  </Svg>
);

export const ClockIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const WalletIcon = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="6" width="17" height="13" rx="3" />
    <path d="M16 12.5h2M3.5 9.5h17M6 6l9-2.5 1 2.5" />
  </Svg>
);

export const ExternalIcon = (p) => (
  <Svg size={12} strokeWidth="2" {...p}>
    <path d="M14 5h5v5M19 5l-9 9M10 5H5v14h14v-5" />
  </Svg>
);

export const CloseIcon = (p) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const PlusIcon = (p) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const CheckIcon = (p) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);

export const AlertIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5v5.5M12 16.5v.01" />
  </Svg>
);

export const LocateIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <circle cx="12" cy="12" r="7.5" />
    <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22" />
  </Svg>
);

export const MapIcon = (p) => (
  <Svg {...p}>
    <path d="M9 4.5l-5 2v13l5-2 6 2 5-2v-13l-5 2z" />
    <path d="M9 4.5v13M15 6.5v13" />
  </Svg>
);

export const ChatIcon = (p) => (
  <Svg {...p}>
    <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5h-8l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z" />
  </Svg>
);

export const HomeIcon = (p) => (
  <Svg {...p}>
    <path d="M4 11l8-6.5 8 6.5v8a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-5v6h-4A1.5 1.5 0 0 1 4 19z" />
  </Svg>
);

export const CompassIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M15.5 8.5l-2 5-5 2 2-5z" />
  </Svg>
);

export const SparkleIcon = (p) => (
  <Svg {...p}>
    <path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z" />
    <path d="M18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
  </Svg>
);

export const CalendarIcon = (p) => (
  <Svg {...p}>
    <rect x="4" y="5.5" width="16" height="14.5" rx="3" />
    <path d="M8 3.5v4M16 3.5v4M4 10.5h16" />
  </Svg>
);

export const RouteIcon = (p) => (
  <Svg {...p}>
    <circle cx="6" cy="18" r="2.3" />
    <circle cx="18" cy="6" r="2.3" />
    <path d="M8.3 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.7" />
  </Svg>
);

export const RefreshIcon = (p) => (
  <Svg {...p}>
    <path d="M19 12a7 7 0 1 1-2.1-5M19 4.5V9h-4.5" />
  </Svg>
);

export const TicketIcon = (p) => (
  <Svg {...p}>
    <path d="M4 8a2 2 0 0 0 0 4v4.5A1.5 1.5 0 0 0 5.5 18h13a1.5 1.5 0 0 0 1.5-1.5V12a2 2 0 0 1 0-4V6.5A1.5 1.5 0 0 0 18.5 5h-13A1.5 1.5 0 0 0 4 6.5z" />
    <path d="M14 5v13" strokeDasharray="2 2.2" />
  </Svg>
);

export const PlusCircleIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 8v8M8 12h8" />
  </Svg>
);

export const SearchIcon = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </Svg>
);

export const SlidersIcon = (p) => (
  <Svg {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Svg>
);

export const ChevronDownIcon = (p) => (
  <Svg {...p}>
    <path d="M7 10l5 5 5-5" />
  </Svg>
);

export const ChevronUpIcon = (p) => (
  <Svg {...p}>
    <path d="M7 14l5-5 5 5" />
  </Svg>
);

export const ArrowRightIcon = (p) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const ListIcon = (p) => (
  <Svg {...p}>
    <path d="M9 6.5h11M9 12h11M9 17.5h11" />
    <circle cx="4.8" cy="6.5" r="1" />
    <circle cx="4.8" cy="12" r="1" />
    <circle cx="4.8" cy="17.5" r="1" />
  </Svg>
);

export const NavigateIcon = (p) => (
  <Svg {...p}>
    <path d="M20 4L4 11l7 2 2 7z" />
  </Svg>
);

export const ChevronLeftIcon = (p) => (
  <Svg {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
);

export const ChevronRightIcon = (p) => (
  <Svg {...p}>
    <path d="M9 5l7 7-7 7" />
  </Svg>
);

export const MinusIcon = (p) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);

export const legIcon = (mode, props) => {
  if (mode === 'taxi') return <CarIcon {...props} />;
  if (mode === 'transit') return <MetroIcon {...props} />;
  return <WalkIcon {...props} />;
};
