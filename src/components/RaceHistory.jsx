import { useState } from 'react';
import { formatDate, formatTime } from '../utils/formatters';

const RaceHistory = ({ runs }) => {
  const [displayedCount, setDisplayedCount] = useState(2);

  // 대회별 기록 그룹핑
  const raceRecords = runs
    .filter(run => run.runType === 'race' && run.raceName)
    .reduce((acc, run) => {
      const raceName = run.raceName;
      if (!acc[raceName]) {
        acc[raceName] = [];
      }
      acc[raceName].push(run);
      return acc;
    }, {});

  // 대회별 최고 기록 계산
  const raceStats = Object.entries(raceRecords)
    .map(([raceName, records]) => {
      // 최고 기록 (가장 빠른 시간)
      const sortedByTime = [...records].sort((a, b) => a.time - b.time);
      const bestRecord = sortedByTime[0];
      
      // 최근 기록 (가장 최근 날짜)
      const sortedByDate = [...records].sort((a, b) => new Date(b.date) - new Date(a.date));
      const latestRecord = sortedByDate[0];
      
      const count = records.length;
      
      // 기록 향상도 계산
      let improvement = null;
      if (count > 1) {
        const previousRecord = sortedByDate[1];
        if (latestRecord && previousRecord) {
          improvement = previousRecord.time - latestRecord.time;
        }
      }

      // 전체 기록을 거리 → 기록(시간) → 날짜 순으로 정렬
      const allRecords = [...records].sort((a, b) => {
        // 1순위: 거리 (HALF < FULL < 기타 거리)
        const getDistanceValue = (record) => {
          if (record.raceType === 'HALF') return 1;
          if (record.raceType === 'FULL') return 2;
          return 3;
        };
        const distanceDiff = getDistanceValue(a) - getDistanceValue(b);
        if (distanceDiff !== 0) return distanceDiff;
        
        // 2순위: 기록(시간) - 빠른 순
        const timeDiff = a.time - b.time;
        if (timeDiff !== 0) return timeDiff;
        
        // 3순위: 날짜 - 최신순
        return new Date(b.date) - new Date(a.date);
      });

      return {
        raceName,
        bestRecord,
        latestRecord,
        count,
        improvement,
        allRecords
      };
    })
    .sort((a, b) => b.count - a.count); // 많이 뛴 대회 순

  if (raceStats.length === 0) return null;

  // 통계 계산
  const allRaceRuns = runs.filter(run => run.runType === 'race' && run.raceName);
  const totalRaces = raceStats.length; // 총 참가한 대회 수
  const totalParticipations = allRaceRuns.length; // 총 참가 횟수
  
  // 거리별 참가 횟수
  const distanceCounts = {
    '5K': allRaceRuns.filter(r => r.raceType === '5K').length,
    '10K': allRaceRuns.filter(r => r.raceType === '10K').length,
    'HALF': allRaceRuns.filter(r => r.raceType === 'HALF').length,
    'FULL': allRaceRuns.filter(r => r.raceType === 'FULL').length,
    'CUSTOM': allRaceRuns.filter(r => !['5K', '10K', 'HALF', 'FULL'].includes(r.raceType)).length
  };
  
  // 첫 참가 날짜와 최근 참가 날짜
  const sortedByDate = [...allRaceRuns].sort((a, b) => new Date(a.date) - new Date(b.date));
  const firstRaceDate = sortedByDate.length > 0 ? sortedByDate[0].date : null;
  const latestRaceDate = allRaceRuns.length > 0 
    ? [...allRaceRuns].sort((a, b) => new Date(b.date) - new Date(a.date))[0].date 
    : null;


  return (
    <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-navy-900">🏆 대회 기록</h2>
      </div>

      {/* 대회 참가 통계 */}
      <div className="bg-navy-50 rounded-lg p-3 sm:p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div>
            <div className="text-xs text-navy-600 mb-1">총 참가 대회</div>
            <div className="text-lg sm:text-xl font-bold text-navy-900">{totalRaces}개</div>
          </div>
          <div>
            <div className="text-xs text-navy-600 mb-1">총 참가 횟수</div>
            <div className="text-lg sm:text-xl font-bold text-navy-900">{totalParticipations}회</div>
          </div>
          {firstRaceDate && (
            <div>
              <div className="text-xs text-navy-600 mb-1">첫 참가</div>
              <div className="text-sm font-semibold text-navy-900">{formatDate(firstRaceDate)}</div>
            </div>
          )}
          {latestRaceDate && (
            <div>
              <div className="text-xs text-navy-600 mb-1">최근 참가</div>
              <div className="text-sm font-semibold text-navy-900">{formatDate(latestRaceDate)}</div>
            </div>
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-navy-200">
          <div className="text-xs text-navy-600 mb-2">거리별 참가 횟수</div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {distanceCounts['5K'] > 0 && (
              <div className="text-xs">
                <span className="text-navy-700 font-semibold">5K</span>
                <span className="text-navy-600 ml-1">{distanceCounts['5K']}회</span>
              </div>
            )}
            {distanceCounts['10K'] > 0 && (
              <div className="text-xs">
                <span className="text-navy-700 font-semibold">10K</span>
                <span className="text-navy-600 ml-1">{distanceCounts['10K']}회</span>
              </div>
            )}
            {distanceCounts['HALF'] > 0 && (
              <div className="text-xs">
                <span className="text-navy-700 font-semibold">HALF</span>
                <span className="text-navy-600 ml-1">{distanceCounts['HALF']}회</span>
              </div>
            )}
            {distanceCounts['FULL'] > 0 && (
              <div className="text-xs">
                <span className="text-navy-700 font-semibold">FULL</span>
                <span className="text-navy-600 ml-1">{distanceCounts['FULL']}회</span>
              </div>
            )}
            {distanceCounts['CUSTOM'] > 0 && (
              <div className="text-xs">
                <span className="text-navy-700 font-semibold">기타</span>
                <span className="text-navy-600 ml-1">{distanceCounts['CUSTOM']}회</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {raceStats.slice(0, displayedCount).map(({ raceName, bestRecord, latestRecord, count, improvement, allRecords }) => {
          const getDistanceLabel = (record) => {
            if (record.raceType === 'HALF') return 'HALF';
            if (record.raceType === 'FULL') return 'FULL';
            return `${record.distance}km`;
          };
          
          return (
            <div key={raceName} className="bg-navy-200 rounded-lg p-3 sm:p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-navy-900 text-sm sm:text-base truncate">{raceName}</h3>
                </div>
                <div className="text-right ml-3 flex-shrink-0">
                  <div className="text-xs sm:text-sm font-semibold text-navy-700">{count}회 참가</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-navy-300">
                <div className="space-y-3">
                  {allRecords.map((record, index) => (
                    <div key={index} className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-navy-300 text-navy-900 text-xs font-semibold">
                          {getDistanceLabel(record)}
                        </span>
                        <span className="text-navy-600 text-xs">
                          {formatDate(record.date)}
                        </span>
                      </div>
                      <span className="text-navy-900 font-bold text-xs sm:text-sm text-right">
                        {formatTime(record.time)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {displayedCount < raceStats.length && (
        <div className="text-center mt-4">
          <button
            onClick={() => setDisplayedCount(Math.min(displayedCount + 3, raceStats.length))}
            className="text-navy-600 hover:text-navy-900 text-sm font-semibold px-4 py-2 rounded-lg bg-navy-100 hover:bg-navy-200 transition-colors"
          >
            +{raceStats.length - displayedCount}개 대회 더보기
          </button>
        </div>
      )}
    </div>
  );
};

export default RaceHistory;
