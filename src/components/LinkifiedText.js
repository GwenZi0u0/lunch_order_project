'use client';

export default function LinkifiedText({ value, className = '' }) {
  const text = String(value || '');
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()\[\]，。]+)/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const href = match[2] || match[3];
    const label = match[1] || href;
    parts.push(
      <a
        key={`${match.index}-${href}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-bold text-[#EA5B3C] underline decoration-[#EA5B3C]/40 underline-offset-2 transition-colors hover:text-[#333333]"
      >
        {label}
      </a>
    );
    lastIndex = linkPattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <span className={className}>{parts}</span>;
}
