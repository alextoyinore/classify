import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const showMax = 5;
    
    if (totalPages <= showMax) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, start + showMax - 1);
      
      if (end === totalPages) {
        start = Math.max(1, totalPages - showMax + 1);
      }
      
      for (let i = start; i <= end; i++) pages.push(i);
      
      if (start > 1) {
        if (start > 2) pages.unshift('...');
        pages.unshift(1);
      }
      
      if (end < totalPages) {
        if (end < totalPages - 1) pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="pagination-container">
      <div className="pagination-info">
        Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
      </div>
      
      <div className="pagination-list">
        <button 
          className="pagination-btn nav-btn" 
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft size={16} />
          <span>Prev</span>
        </button>
        
        {getPageNumbers().map((p, i) => (
          p === '...' ? (
            <span key={`dots-${i}`} className="text-muted" style={{ padding: '0 4px' }}>...</span>
          ) : (
            <button 
              key={p} 
              className={`pagination-btn ${p === currentPage ? 'active' : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        ))}
        
        <button 
          className="pagination-btn nav-btn" 
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <span>Next</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
