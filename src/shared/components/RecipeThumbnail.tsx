import { useState } from 'react';
import { Utensils } from 'lucide-react';
import { cn } from '../utils/cn';

export function RecipeThumbnail({
  src,
  alt,
  className,
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg bg-[var(--bg-surface-muted)] text-[var(--text-muted)] border border-[var(--border-subtle)]',
          className
        )}
        aria-label={alt}
      >
        <Utensils className="h-5 w-5 opacity-60" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn('rounded-lg object-cover border border-[var(--border-subtle)]', className)}
    />
  );
}
