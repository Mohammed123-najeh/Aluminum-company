import React from 'react';

type Props = {
  size?: 'sm' | 'md';
  showText?: boolean;
  panelLabel?: string;
};

export const BrandLogo: React.FC<Props> = ({ size = 'md', showText = true, panelLabel }) => {
  const box = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className={`${box} relative shrink-0 overflow-hidden rounded-xl bg-white shadow-lg shadow-blue-500/20 ring-1 ring-white/20`}>
        <svg viewBox="0 0 120 120" className="h-full w-full">
          <defs>
            <radialGradient id="brand-sun" cx="35%" cy="30%" r="65%">
              <stop offset="0%" stopColor="#fffde8" />
              <stop offset="36%" stopColor="#ffd133" />
              <stop offset="72%" stopColor="#d98200" />
              <stop offset="100%" stopColor="#8d4c00" />
            </radialGradient>
            <linearGradient id="brand-wave" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="48%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
            <filter id="brand-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect width="120" height="120" fill="#f8fafc" />
          <circle cx="60" cy="34" r="25" fill="url(#brand-sun)" filter="url(#brand-glow)" />
          <path d="M12 66 C34 46 73 59 108 45 C88 70 46 64 12 76 Z" fill="url(#brand-wave)" opacity="0.95" />
          <path d="M19 86 C43 72 78 84 111 64 C88 91 48 88 19 98 Z" fill="url(#brand-wave)" opacity="0.88" />
          <path d="M34 75 C54 69 82 75 105 57" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.75" />
          <path d="M26 92 C52 83 75 94 103 76" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
        </svg>
      </div>
      {showText && (
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">Aluminum Factory</p>
          {panelLabel && <p className="truncate text-sm font-semibold leading-tight text-white">{panelLabel}</p>}
        </div>
      )}
    </div>
  );
};

type FullLogoProps = {
  compact?: boolean;
  className?: string;
};

export const BrandFullLogo: React.FC<FullLogoProps> = ({ compact = false, className = '' }) => {
  const id = React.useId().replace(/:/g, '');
  const sunId = `brand-full-sun-${id}`;
  const waveId = `brand-full-wave-${id}`;
  const waveDarkId = `brand-full-wave-dark-${id}`;
  const shineId = `brand-full-shine-${id}`;

  return (
    <div className={`mx-auto flex w-full flex-col items-center text-center ${compact ? 'max-w-[230px]' : 'max-w-[330px]'} ${className}`}>
      <svg viewBox="0 0 360 230" className={`w-full ${compact ? 'h-[138px]' : 'h-[205px]'}`} role="img" aria-label="Aluminum Pearl Co. logo">
        <defs>
          <radialGradient id={sunId} cx="34%" cy="28%" r="68%">
            <stop offset="0%" stopColor="#fffef4" />
            <stop offset="24%" stopColor="#fff7a3" />
            <stop offset="47%" stopColor="#ffc21b" />
            <stop offset="78%" stopColor="#c97300" />
            <stop offset="100%" stopColor="#5c3100" />
          </radialGradient>
          <linearGradient id={waveId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#0b63d8" />
            <stop offset="42%" stopColor="#0bd4ff" />
            <stop offset="72%" stopColor="#0476ff" />
            <stop offset="100%" stopColor="#0037a9" />
          </linearGradient>
          <linearGradient id={waveDarkId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#0054c8" />
            <stop offset="48%" stopColor="#009bf2" />
            <stop offset="100%" stopColor="#002c95" />
          </linearGradient>
          <linearGradient id={shineId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <filter id={`brand-full-shadow-${id}`} x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#0f172a" floodOpacity="0.18" />
          </filter>
          <filter id={`brand-full-glow-${id}`} x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g filter={`url(#brand-full-shadow-${id})`}>
          <ellipse cx="179" cy="204" rx="122" ry="10" fill="#0f172a" opacity="0.08" />
          <circle cx="180" cy="62" r="52" fill={`url(#${sunId})`} filter={`url(#brand-full-glow-${id})`} />
          <circle cx="160" cy="38" r="20" fill="#ffffff" opacity="0.72" />
          <circle cx="214" cy="70" r="4" fill="#ffffff" opacity="0.9" />
          <path d="M142 96 C164 112 204 111 225 91" fill="none" stroke="#013d8d" strokeWidth="5" strokeLinecap="round" opacity="0.42" />

          <path
            d="M35 139 C91 91 169 132 323 88 C267 145 149 138 35 164 Z"
            fill={`url(#${waveId})`}
            stroke="#0040b5"
            strokeWidth="3"
          />
          <path
            d="M103 159 C170 139 236 157 333 117 C272 174 180 183 103 171 Z"
            fill={`url(#${waveId})`}
            stroke="#0038a4"
            strokeWidth="3"
          />
          <path
            d="M18 188 C95 144 205 207 305 154 C238 221 113 213 18 209 Z"
            fill={`url(#${waveDarkId})`}
            stroke="#003498"
            strokeWidth="3"
          />

          <path d="M53 143 C117 113 194 139 298 96" fill="none" stroke={`url(#${shineId})`} strokeWidth="6" strokeLinecap="round" opacity="0.78" />
          <path d="M125 159 C194 149 241 159 314 125" fill="none" stroke={`url(#${shineId})`} strokeWidth="5" strokeLinecap="round" opacity="0.7" />
          <path d="M39 191 C118 166 198 207 286 164" fill="none" stroke={`url(#${shineId})`} strokeWidth="5" strokeLinecap="round" opacity="0.62" />
        </g>
      </svg>

      <div className={compact ? '-mt-3' : '-mt-5'}>
        <p
          className={`${compact ? 'text-[26px]' : 'text-[42px]'} font-serif font-bold leading-none tracking-normal text-blue-700`}
          style={{
            textShadow: '0 2px 0 #d9efff, 0 5px 8px rgba(15, 23, 42, 0.25)',
          }}
        >
          Aluminum Pearl Co.
        </p>
        <div className={`${compact ? 'mt-2 gap-2' : 'mt-3 gap-3'} flex items-center justify-center`}>
          <span className="h-px w-14 bg-gradient-to-r from-transparent via-amber-500 to-amber-700" />
          <span className="h-3 w-3 rounded-full border border-amber-700 bg-gradient-to-br from-yellow-200 to-amber-600 shadow-sm" />
          <span className="h-px w-14 bg-gradient-to-l from-transparent via-amber-500 to-amber-700" />
        </div>
        <p
          className={`${compact ? 'mt-1 text-[20px]' : 'mt-2 text-[34px]'} font-bold leading-tight text-blue-700`}
          dir="rtl"
          style={{
            textShadow: '0 2px 0 #d9efff, 0 5px 8px rgba(15, 23, 42, 0.22)',
          }}
        >
          شركة اللؤلؤة للألمنيوم
        </p>
      </div>
    </div>
  );
};
