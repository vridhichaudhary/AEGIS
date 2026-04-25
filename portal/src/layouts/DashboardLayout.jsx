import React from 'react';

/**
 * Redesigned AEGIS Dashboard Layout
 * TOP BAR: 48px
 * LEFT SIDEBAR: 280px
 * MAIN AREA: Flex column with 60/40 split
 */
const DashboardLayout = ({ 
  topBar, 
  sidebar, 
  mainLeft, 
  mainRight,
  mciActive = false 
}) => {
  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden bg-aegis-bg-base text-aegis-text-primary font-sans`}>
      {/* TOP BAR (48px) */}
      <header className={`h-[48px] w-full flex-shrink-0 z-50 border-b border-aegis-border transition-all duration-500 ${mciActive ? 'bg-red-950/90' : 'bg-aegis-bg-base'}`}>
        {topBar}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR (280px) */}
        <aside className={`w-[280px] h-full flex-shrink-0 bg-aegis-bg-surface border-r transition-all duration-500 overflow-hidden flex flex-col ${mciActive ? 'border-r-red-600/50' : 'border-r-aegis-border'}`}>
          {sidebar}
        </aside>

        {/* MAIN AREA */}
        <main className="flex-1 flex overflow-hidden">
          {/* LEFT COLUMN (60%) */}
          <div className="w-[60%] h-full border-r border-aegis-border overflow-hidden">
            {mainLeft}
          </div>
          
          {/* RIGHT COLUMN (40%) */}
          <div className="w-[40%] h-full overflow-y-auto custom-scrollbar flex flex-col gap-4 p-4">
            {mainRight}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
