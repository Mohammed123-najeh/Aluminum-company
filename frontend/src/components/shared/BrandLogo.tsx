import React from 'react';
// Real brand assets. Vite fingerprints + compresses these and only bundles them
// where imported, so referencing the same import in many places stays cheap.
import brandLogoFull from '../../assets/brand-logo-full.jpeg';
import brandLogoMark from '../../assets/brand-logo-mark.jpeg';

type Props = {
  size?: 'sm' | 'md';
  showText?: boolean;
  panelLabel?: string;
};

export const BrandLogo: React.FC<Props> = ({ size = 'md', showText = true, panelLabel }) => {
  const box = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className={`${box} shrink-0 overflow-hidden rounded-xl bg-white shadow-lg shadow-blue-500/20 ring-1 ring-white/20`}>
        <img
          src={brandLogoMark}
          alt="Aluminum Pearl Co."
          className="h-full w-full object-contain"
          loading="lazy"
          decoding="async"
          draggable={false}
        />
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
  // Full brand logo (gold pearl + waves + EN/AR wordmark) rendered exactly as
  // supplied — no recolouring or filters. object-contain keeps the artwork's
  // aspect ratio intact within the responsive height.
  return (
    <div className={`mx-auto flex w-full flex-col items-center text-center ${compact ? 'max-w-[230px]' : 'max-w-[330px]'} ${className}`}>
      <img
        src={brandLogoFull}
        alt="Aluminum Pearl Co. — شركة اللؤلؤة للألمنيوم"
        className={`w-full object-contain ${compact ? 'max-h-[180px]' : 'max-h-[260px]'}`}
        decoding="async"
        draggable={false}
      />
    </div>
  );
};
