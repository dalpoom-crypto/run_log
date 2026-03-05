import { useState, useEffect } from 'react';
import { db, collection, query, where, orderBy, getDocs } from '../config/firebase';
import { formatDate, formatTime } from '../utils/formatters';
import RaceHistory from './RaceHistory';

const RecordsManagement = ({ user }) => {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRuns = async () => {
      try {
        const q = query(
          collection(db, 'runs'),
          where('userId', '==', user.uid),
          orderBy('date', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const runsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setRuns(runsData);
      } catch (error) {
        console.error('기록 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    };
    loadRuns();
  }, [user]);

  // 거리별 기록 계산 (항상 4개 항목 표시)
  const distanceRecords = ['5K', '10K', 'HALF', 'FULL'].map(type => {
    const typeRuns = runs.filter(run => run.raceType === type);
    const isEmpty = typeRuns.length === 0;

    if (isEmpty) {
      return {
        type,
        typeName: type === 'HALF' ? 'HALF' : type === 'FULL' ? 'FULL' : type,
        isEmpty: true
      };
    }

    const best = typeRuns.reduce((prev, curr) => prev.time < curr.time ? prev : curr);
    const average = typeRuns.reduce((sum, run) => sum + run.time, 0) / typeRuns.length;

    return {
      type,
      typeName: type === 'HALF' ? 'HALF' : type === 'FULL' ? 'FULL' : type,
      best,
      average,
      count: typeRuns.length,
      isEmpty: false,
      allRuns: typeRuns.sort((a, b) => new Date(b.date) - new Date(a.date))
    };
  });


  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-navy-700 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 거리별 기록 */}
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-navy-900 mb-4">📏 거리별 기록</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {distanceRecords.map(({ type, typeName, best, average, count, isEmpty }) => (
            <div
              key={type}
              className={`rounded-lg p-4 ${
                isEmpty
                  ? 'bg-gradient-to-br from-navy-50 to-navy-100 border border-dashed border-navy-200'
                  : 'bg-gradient-to-br from-navy-50 to-navy-100 border border-navy-100'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base sm:text-lg font-bold text-navy-900">{typeName}</h3>
                {!isEmpty && <span className="text-xs text-navy-600">{count}회</span>}
              </div>
              {isEmpty ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-navy-600 to-navy-800 flex items-center justify-center text-xl text-white mb-2">
                    🏃
                  </div>
                  <div className="text-sm text-navy-600 font-medium mb-1">기록을 남겨보세요!</div>
                  <div className="text-xs text-navy-500">첫 기록을 달성하면 여기에 표시됩니다</div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <div className="text-xs text-navy-600 mb-1">최고 기록</div>
                    <div className="text-xl sm:text-2xl font-bold text-navy-900">{formatTime(best.time)}</div>
                    <div className="text-xs text-navy-500 mt-1">
                      {formatDate(best.date)}
                    </div>
                  </div>
                  {count > 1 && (
                    <div>
                      <div className="text-xs text-navy-600 mb-1">평균 기록</div>
                      <div className="text-base font-semibold text-navy-700">{formatTime(Math.round(average))}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 대회별 기록 */}
      <RaceHistory runs={runs} />
    </div>
  );
};

export default RecordsManagement;
