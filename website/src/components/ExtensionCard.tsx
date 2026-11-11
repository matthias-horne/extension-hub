import React from 'react';

interface ExtensionCardProps {
  title: string;
  description: string;
  category: string;
  icon: string;
  link: string;
}

export const ExtensionCard: React.FC<ExtensionCardProps> = ({ title, description, category, icon, link }) => {
  return (
    <a 
      href={link} 
      className="group flex flex-col h-full p-5 md:p-6 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl transition-all duration-250 ease-in-out hover:border-gardener-brand dark:hover:border-gardener-brand-dark hover:bg-gray-100 dark:hover:bg-gray-700 no-underline"
    >
      <div className="text-3xl mb-4 group-hover:scale-110 transition-transform duration-200">{icon}</div>
      <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-widest">
        {category}
      </div>
      <h3 className="text-base font-semibold text-gardener-brand dark:text-gardener-brand-dark mb-2 leading-6">
        {title}
      </h3>
      <p className="text-sm font-medium text-gray-600 dark:text-gray-400 leading-relaxed flex-grow">
        {description}
      </p>
    </a>
  );
};
