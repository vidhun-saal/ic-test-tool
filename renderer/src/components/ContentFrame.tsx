import { useEffect, useRef } from 'react';

interface Props {
  src: string | null;
  reloadKey: number;
}

export function ContentFrame({ src, reloadKey }: Props) {
  const ref = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (ref.current && src) {
      ref.current.src = src;
    }
  }, [src, reloadKey]);

  if (!src) {
    return (
      <div className="content-frame">
        <div className="placeholder">
          Course will appear here once a package is launched.
        </div>
      </div>
    );
  }

  return (
    <div className="content-frame">
      <iframe
        ref={ref}
        title="LMS content"
        src={src}
        allow="autoplay; fullscreen; microphone; camera"
      />
    </div>
  );
}
