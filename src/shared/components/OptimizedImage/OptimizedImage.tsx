import { useState } from 'react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  width: number;
  height: number;
  fallback?: string;
}

/**
 * Optimized image component with WebP fallback, lazy loading,
 * async decoding, and error fallback support.
 *
 * Use for avatars, logos, and any user-provided images.
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  fallback,
  className,
  ...props
}: OptimizedImageProps) {
  const [error, setError] = useState(false);
  const webpSrc = src.replace(/\.(png|jpg|jpeg)$/i, '.webp');

  return (
    <picture>
      <source srcSet={webpSrc} type="image/webp" />
      <img
        src={error && fallback ? fallback : src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        className={className}
        onError={() => setError(true)}
        {...props}
      />
    </picture>
  );
}
