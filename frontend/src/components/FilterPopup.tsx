import React, { useState } from 'react';
import { Popup, Button } from 'tdesign-mobile-react';
import '../styles/FilterPopup.css';

interface FilterPopupProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onClear: () => void;
  children: React.ReactNode;
}

const FilterPopup: React.FC<FilterPopupProps> = ({
  visible,
  onClose,
  onConfirm,
  onClear,
  children
}) => {
  return (
    <Popup
      visible={visible}
      placement="bottom"
      onClose={onClose}
      className="t-filter-popup"
    >
      <div className="t-filter-content">
        <div className="t-filter-body">
          {children}
        </div>
        <div className="t-filter-actions">
          <Button 
            className="t-filter-cancel-btn" 
            variant="outline"
            onClick={onClear}
          >
            清空
          </Button>
          <Button 
            className="t-filter-confirm-btn"
            theme="primary" 
            onClick={onConfirm}
          >
            确定
          </Button>
        </div>
      </div>
    </Popup>
  );
};

export default FilterPopup; 