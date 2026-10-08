import React from 'react';

/**
 * Yuklanayotganda kulrang "skelet" bloklar (spinner o'rniga) — sahifa tuzilishi oldindan ko'rinadi,
 * kontent kelganda joy sakramaydi. Animatsiya prefers-reduced-motion da o'chadi (CSS).
 */
export const Skeleton: React.FC<{ className?: string; rounded?: 'sm' | 'md' | 'lg' | 'full' }> = ({
  className = '',
  rounded = 'md',
}) => <span aria-hidden="true" className={`milliy-skeleton milliy-skeleton--${rounded} block ${className}`} />;

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ lines = 3, className = '' }) => (
  <span className={`flex flex-col gap-2 ${className}`} aria-hidden="true">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={`h-3.5 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} rounded="sm" />
    ))}
  </span>
);

/** Ro'yxat kartalari uchun skelet */
export const ListSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className="flex flex-col gap-3" role="status" aria-label="Yuklanmoqda">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="editorial-card flex items-center gap-4">
        <Skeleton className="w-11 h-11 shrink-0" rounded="lg" />
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <Skeleton className="h-4 w-3/5" rounded="sm" />
          <Skeleton className="h-3 w-2/5" rounded="sm" />
        </div>
        <Skeleton className="h-6 w-20 shrink-0" rounded="full" />
      </div>
    ))}
  </div>
);

/** Boshqaruv paneli / umumiy sahifa skeleti: sarlavha bloki, 4 ta ko'rsatkich, ro'yxat */
export const PageSkeleton: React.FC = () => (
  <div className="flex flex-col gap-7" role="status" aria-label="Yuklanmoqda">
    <Skeleton className="h-40 w-full" rounded="lg" />
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="editorial-card flex items-center gap-4">
          <Skeleton className="w-11 h-11 shrink-0" rounded="lg" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton className="h-6 w-16" rounded="sm" />
            <Skeleton className="h-3 w-24" rounded="sm" />
          </div>
        </div>
      ))}
    </div>
    <ListSkeleton rows={3} />
  </div>
);

export default Skeleton;
