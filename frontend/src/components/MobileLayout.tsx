import React, { ReactNode, useState, useEffect } from 'react';
import { useSwipeable } from 'react-swipeable';
import '../styles/MobileLayout.css';

interface MobileLayoutProps {
  children: ReactNode;
  activeTab: 'home' | 'history' | 'stats';
  onTabChange: (tab: 'home' | 'history' | 'stats') => void;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({ 
  children, 
  activeTab, 
  onTabChange 
}) => {
  // 用于跟踪页面切换动画
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // 定义标签顺序，用于确定滑动方向
  const tabOrder = ['home', 'history', 'stats'];
  
  // 处理滑动手势
  const handlers = useSwipeable({
    onSwipedLeft: () => {
      const currentIndex = tabOrder.indexOf(activeTab);
      if (currentIndex < tabOrder.length - 1) {
        setSwipeDirection('left');
        setIsAnimating(true);
        const nextTab = tabOrder[currentIndex + 1] as 'home' | 'history' | 'stats';
        setTimeout(() => onTabChange(nextTab), 50);
      }
    },
    onSwipedRight: () => {
      const currentIndex = tabOrder.indexOf(activeTab);
      if (currentIndex > 0) {
        setSwipeDirection('right');
        setIsAnimating(true);
        const prevTab = tabOrder[currentIndex - 1] as 'home' | 'history' | 'stats';
        setTimeout(() => onTabChange(prevTab), 50);
      }
    },
    trackMouse: false,
    delta: 10,
    preventScrollOnSwipe: true
  });

  // 动画结束后重置状态
  useEffect(() => {
    if (isAnimating) {
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setSwipeDirection(null);
      }, 300); // 动画持续时间
      return () => clearTimeout(timer);
    }
  }, [isAnimating]);

  // 根据当前活动标签和滑动方向确定动画类名
  const getContentClassName = () => {
    let className = 'mobile-content';
    
    if (isAnimating && swipeDirection) {
      className += ` slide-${swipeDirection}`;
    }
    
    return className;
  };

  return (
    <div className="mobile-layout">
      <div 
        {...handlers} 
        className={getContentClassName()}
      >
        {children}
      </div>
      <div className="mobile-nav">
        <div 
          className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => onTabChange('home')}
        >
          <div className="nav-icon">
            {activeTab === 'home' ? (
              <img src="/homeed.svg" alt="首页" />
            ) : (
              <img src="/home.svg" alt="首页" />
            )}
          </div>
          <span>行程</span>
        </div>
        <div 
          className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => onTabChange('history')}
        >
          <div className="nav-icon">
            {activeTab === 'history' ? (
              <img src="/histryed.svg" alt="历史" />
            ) : (
              <img src="/histry.svg" alt="历史" />
            )}
          </div>
          <span>车票</span>
        </div>
        <div 
          className={`nav-item ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => onTabChange('stats')}
        >
          <div className="nav-icon">
            {activeTab === 'stats' ? (
              <img src="/tonged.svg" alt="统计" />
            ) : (
              <img src="/tong.svg" alt="统计" />
            )}
          </div>
          <span>统计</span>
        </div>
      </div>
    </div>
  );
};

export default MobileLayout; 