import { useEffect, useState } from 'react';

function initialsFor(fullName) {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

// Avatars are stored as data: URLs in localStorage (see avatarStore.js) —
// a broken image here means corrupt/unsupported data rather than a dead
// link, so it falls back to initials instead of the browser's broken-image
// icon, same as BookCoverThumb does for book covers.
export default function Avatar({ src, fullName, className = 'h-9 w-9 text-sm' }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const showImage = Boolean(src) && !failed;

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-500 font-semibold text-white ${className}`}
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initialsFor(fullName)
      )}
    </div>
  );
}
