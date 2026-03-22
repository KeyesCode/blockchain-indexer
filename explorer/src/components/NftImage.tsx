'use client';

import { useState } from 'react';

export default function NftImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <img
      src={src}
      alt={alt}
      className="max-h-64 rounded-lg"
      onError={() => setFailed(true)}
    />
  );
}
