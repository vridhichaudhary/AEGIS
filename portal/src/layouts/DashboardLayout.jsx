import React from 'react';

/**
 * AEGIS Clean Production Layout
 * Pure 2x2 Grid for maximum clarity
 */
const DashboardLayout = ({ 
  topBar, 
  topLeft, 
  topRight, 
  bottomLeft, 
  bottomRight,
  extra,
  mciActive = false 
}) => {
  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden bg-aegis-bg-base text-aegis-text-primary font-sans`}>
      {/* TOP BAR (56px for more breathing room) */}
      <header className={`h-[56px] w-full flex-shrink-0 z-50 border-b border-aegis-border bg-white shadow-sm flex items-center transition-all duration-500 ${mciActive ? 'border-b-red-500 bg-red-50' : ''}`}>
        {topBar}
      </header>

      <div className="flex-1 p-6 overflow-hidden">
        <div className="grid grid-cols-2 grid-rows-2 gap-6 h-full">
          {/* TOP LEFT */}
          <div className="card-flush relative min-h-0">
            {topLeft}
          </div>

          {/* TOP RIGHT */}
          <div className="card-flush relative min-h-0">
            {topRight}
          </div>

          {/* BOTTOM LEFT */}
          <div className="card-flush relative min-h-0">
            {bottomLeft}
          </div>

          {/* BOTTOM RIGHT */}
          <div className="card-flush relative min-h-0">
            {bottomRight}
          </div>
        </div>
      </div>

      {/* OVERLAYS / EXTRA */}
      {extra}
    </div>
  );
};

export default DashboardLayout;
