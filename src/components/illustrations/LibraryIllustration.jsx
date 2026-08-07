// Hand-built flat-vector library scene for the login page's right panel —
// no external image asset, so it never has a broken-image risk and scales
// crisply at any size. Palette is deliberately confined to the site's blue
// primary scale plus a teal accent and warm wood/amber tones for the
// shelving, per the login page's "modern library" brief.
export default function LibraryIllustration({ className = '' }) {
  return (
    <svg
      viewBox="0 0 560 480"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Illustration of a modern library with bookshelves, a reading lamp, and a plant"
    >
      {/* Soft ambient glow */}
      <circle cx="300" cy="220" r="210" fill="white" opacity="0.07" />
      <circle cx="300" cy="220" r="150" fill="white" opacity="0.06" />

      {/* Arched alcove behind the shelf */}
      <path
        d="M100 400 V180 a120 120 0 0 1 240 0 V400 Z"
        fill="white"
        opacity="0.08"
      />

      {/* Floor shadow */}
      <ellipse cx="290" cy="430" rx="220" ry="18" fill="black" opacity="0.12" />

      {/* ===== Bookshelf ===== */}
      <g>
        {/* Outer frame */}
        <rect x="70" y="90" width="230" height="330" rx="10" fill="#7C4A22" />
        <rect x="82" y="102" width="206" height="306" rx="6" fill="#A05A28" />

        {/* Shelf boards */}
        {[102, 178, 254, 330].map((y) => (
          <rect key={y} x="82" y={y} width="206" height="14" fill="#7C4A22" />
        ))}

        {/* Row 1 books */}
        <g>
          <rect x="92" y="118" width="16" height="58" fill="#2563EB" />
          <rect x="110" y="122" width="14" height="54" fill="#93C5FD" />
          <rect x="126" y="116" width="18" height="60" fill="#1D4ED8" />
          <rect x="146" y="124" width="14" height="52" fill="#FBBF24" />
          <rect x="162" y="118" width="16" height="58" fill="#0D9488" />
          <rect x="180" y="120" width="14" height="56" fill="#2563EB" />
          <rect x="196" y="114" width="18" height="62" fill="#14B8A6" />
          <rect x="216" y="122" width="14" height="54" fill="#93C5FD" />
          <rect x="232" y="117" width="16" height="59" fill="#1E40AF" />
          <rect x="250" y="123" width="14" height="53" fill="#FBBF24" />
          <rect x="266" y="119" width="14" height="57" fill="#0D9488" />
        </g>

        {/* Row 2 books, a few leaning */}
        <g>
          <rect x="92" y="196" width="80" height="12" rx="2" fill="#1D4ED8" />
          <rect x="92" y="208" width="70" height="10" rx="2" fill="#93C5FD" />
          <rect x="172" y="194" width="16" height="60" fill="#0D9488" />
          <rect
            x="192"
            y="200"
            width="16"
            height="56"
            fill="#FBBF24"
            transform="rotate(12 200 228)"
          />
          <rect x="216" y="196" width="16" height="60" fill="#2563EB" />
          <rect x="234" y="198" width="14" height="58" fill="#14B8A6" />
          <rect x="250" y="194" width="18" height="62" fill="#1E40AF" />
        </g>

        {/* Row 3 books */}
        <g>
          <rect x="92" y="272" width="14" height="56" fill="#93C5FD" />
          <rect x="108" y="268" width="18" height="60" fill="#2563EB" />
          <rect x="128" y="274" width="14" height="54" fill="#0D9488" />
          <rect x="144" y="270" width="16" height="58" fill="#FBBF24" />
          <rect x="162" y="276" width="14" height="52" fill="#14B8A6" />
          <rect x="178" y="270" width="18" height="58" fill="#1D4ED8" />
          <rect x="198" y="274" width="14" height="54" fill="#93C5FD" />
          <rect x="214" y="268" width="16" height="60" fill="#1E40AF" />
          <rect x="232" y="273" width="14" height="55" fill="#0D9488" />
          <rect x="248" y="271" width="18" height="57" fill="#2563EB" />

          {/* small potted succulent on this shelf */}
          <rect x="255" y="308" width="20" height="20" rx="3" fill="#B45309" />
          <path d="M258 308 q7 -24 7 -24 q7 0 7 24 Z" fill="#0D9488" />
        </g>

        {/* Row 4: a couple of books lying flat + open book */}
        <g>
          <rect x="92" y="352" width="86" height="12" rx="2" fill="#1E40AF" />
          <rect x="92" y="364" width="70" height="10" rx="2" fill="#FBBF24" />
          <path
            d="M186 372 h34 l-4 -18 a20 20 0 0 0 -13 -5 a20 20 0 0 0 -13 5 Z"
            fill="#F8FAFC"
          />
          <path d="M186 372 h34" stroke="#93C5FD" strokeWidth="2" />
        </g>
      </g>

      {/* ===== Reading nook: chair, lamp, plant ===== */}
      <g>
        {/* Floor lamp */}
        <line x1="392" y1="150" x2="392" y2="360" stroke="#7C4A22" strokeWidth="5" strokeLinecap="round" />
        <circle cx="392" cy="150" r="4" fill="#7C4A22" />
        <path d="M362 118 h60 l-14 40 h-32 Z" fill="#FBBF24" opacity="0.9" />
        <circle cx="392" cy="150" r="55" fill="#FBBF24" opacity="0.12" />
        <ellipse cx="392" cy="362" rx="26" ry="6" fill="#7C4A22" />

        {/* Stack of books + coffee cup at the base of the lamp */}
        <rect x="345" y="340" width="60" height="12" rx="2" fill="#2563EB" />
        <rect x="349" y="328" width="52" height="12" rx="2" fill="#0D9488" />
        <rect x="353" y="316" width="44" height="12" rx="2" fill="#FBBF24" />
        <rect x="410" y="332" width="20" height="18" rx="3" fill="#F8FAFC" />
        <path d="M430 336 q10 2 8 10 q-2 6 -8 6" stroke="#F8FAFC" strokeWidth="3" fill="none" />

        {/* Potted plant */}
        <rect x="452" y="330" width="34" height="30" rx="4" fill="#B45309" />
        <path
          d="M469 330 q-22 -18 -30 -48 q26 4 34 30 q4 -30 26 -40 q6 30 -16 50 q10 -6 22 -2 q-10 16 -36 10 Z"
          fill="#0D9488"
        />
      </g>

      {/* Decorative floating accents */}
      <circle cx="120" cy="60" r="6" fill="#93C5FD" opacity="0.8" />
      <circle cx="330" cy="70" r="5" fill="#FBBF24" opacity="0.8" />
      <circle cx="500" cy="200" r="7" fill="#14B8A6" opacity="0.7" />
      <circle cx="60" cy="260" r="5" fill="#FBBF24" opacity="0.7" />
      <circle cx="520" cy="320" r="6" fill="#93C5FD" opacity="0.7" />
    </svg>
  );
}
