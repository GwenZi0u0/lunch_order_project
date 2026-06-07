'use client';

import { useEffect, useState } from 'react';

export default function BackToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 360);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      title="回到頂端"
      aria-label="回到頂端"
      className={`fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-[#EAE8E4] bg-white text-[#EA5B3C] shadow-lg shadow-black/5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#EA5B3C] hover:bg-[#EA5B3C] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#EA5B3C]/30 ${
        isVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <i className="ti ti-arrow-up text-xl"></i>
    </button>
  );
}
