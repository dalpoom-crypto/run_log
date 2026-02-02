import { useState, useEffect } from 'react';
import { formatTime, formatDate } from '../utils/formatters';

const PersonalRecords = ({ runs }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const calculatePRs = () => {
    const prs = {};
    runs.forEach(run => {
      const type = run.raceType;
      if (type !== 'CUSTOM' && type) {
        if (!prs[type] || run.time < prs[type].time) {
          prs[type] = run;
        }
      }
    });
    return Object.entries(prs).map(([type, run]) => ({ type, ...run }));
  };

  const prs = calculatePRs();

  useEffect(() => {
    if (prs.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % prs.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [prs.length]);

  if (prs.length === 0) {
    return (
      <div className="pr-card mb-6" style={{ 
        minHeight: '120px', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '2.25rem', lineHeight: 1, marginBottom: '8px' }}>🏆</div>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '4px' }}>개인 최고 기록</h2>
        <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>첫 기록을 추가해보세요!</p>
      </div>
    );
  }

  const currentPR = prs[currentIndex];

  return (
    <div className="pr-card mb-6" style={{ 
      minHeight: '120px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center'
    }}>
      <div key={currentIndex} style={{
        animation: prs.length > 1 ? 'fadeSlideUp 0.7s ease-in-out' : 'none'
      }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, opacity: 0.9, marginBottom: '4px' }}>
          {currentPR.type}
        </div>
        <div style={{ fontSize: '2.25rem', fontWeight: 'bold', lineHeight: 1, marginBottom: '8px' }}>
          {formatTime(currentPR.time)}
        </div>
        <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
          {formatDate(currentPR.date)}
          {currentPR.raceName && ` | ${currentPR.raceName}`}
        </div>
      </div>
      <style>{`
        @keyframes fadeSlideUp {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default PersonalRecords;
