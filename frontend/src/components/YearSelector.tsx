import React, { useState } from 'react';

interface YearSelectorProps {
  selectedYear: number | null;
  onYearSelect: (year: number) => void;
  className?: string;
}

const YearSelector: React.FC<YearSelectorProps> = ({
  selectedYear,
  onYearSelect,
  className = ''
}) => {
  // 状态控制是否展开显示全部年份
  const [showAllYears, setShowAllYears] = useState(false);
  
  // 从2012年到当前年份
  const currentYear = new Date().getFullYear();
  const startYear = 2012;
  const years = Array.from(
    { length: currentYear - startYear + 1 }, 
    (_, i) => currentYear - i
  );
  
  // 默认只显示前7个年份
  const visibleYears = showAllYears ? years : years.slice(0, 7); 
  const hasMoreYears = years.length > 7;

  return (
    <div className={`t-year-select-list ${className}`}>
      {visibleYears.map(year => (
        <div 
          key={year} 
          className={`t-year-option ${selectedYear === year ? 'active' : ''}`}
          onClick={() => onYearSelect(year)}
        >
          {year}
        </div>
      ))}
      
      {/* 显示"更多"按钮 */}
      {hasMoreYears && (
        <div 
          className="t-year-option t-more-years-btn"
          onClick={() => setShowAllYears(!showAllYears)}
        >
          更多 {showAllYears ? '▲' : '▼'}
        </div>
      )}
    </div>
  );
};

export default YearSelector; 