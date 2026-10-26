import React from "react";

interface AboutProductCardProps {
  name: string;
  description?: string | null;
}

export function AboutProductCard({ name, description }: AboutProductCardProps) {
  const content =
    description?.trim() ||
    `SPN Health Mix ${name} is crafted from carefully selected natural ingredients, processed and packaged to retain authentic heritage flavour and nutrition. A wholesome staple for your everyday healthy meals.`;

  return (
    <section
      aria-labelledby="about-product-heading"
      className="bg-white rounded-[16px] border border-[#E8DFD4] p-6 sm:p-7 lg:p-8 flex flex-col h-full shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
    >
      <h2
        id="about-product-heading"
        className="font-[family-name:var(--font-heading)] text-xl sm:text-2xl font-normal text-[#1A1614] mb-3 sm:mb-4"
      >
        About This Product
      </h2>
      <div className="font-[family-name:var(--font-body)] text-[14.5px] sm:text-[15px] text-[#635850] leading-relaxed whitespace-pre-line flex-1">
        {content}
      </div>
    </section>
  );
}
