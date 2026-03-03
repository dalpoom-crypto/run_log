import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { CSVLink } from 'react-csv';

const Statistics = () => {
  const db = window.firebaseDb;
  
  const [period, setPeriod] = useState('30'); // 7, 30, 90, all
  const [stats, setStats] = useState({
    totalUsers: 0,
    newUsers: 0,
    totalRuns: 0,
    newRuns: 0,
    totalCrews: 0,
    popularRaces: [],
    activityByDay: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, [period]);

  const loadStatistics = async () => {
    try {
      // 기간 계산
      const now = new Date();
      const periodDays = period === 'all' ? 999999 : parseInt(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      // 전체 사용자
      const allUsersSnapshot = await getDocs(collection(db, 'users'));
      const totalUsers = allUsersSnapshot.size;

      // 기간 내 신규 사용자
      const newUsersQuery = query(
        collection(db, 'users'),
        where('createdAt', '>=', Timestamp.fromDate(startDate))
      );
      const newUsersSnapshot = await getDocs(newUsersQuery);
      const newUsers = newUsersSnapshot.size;

      // 전체 기록
      const allRunsSnapshot = await getDocs(collection(db, 'runs'));
      const totalRuns = allRunsSnapshot.size;
      const allRuns = allRunsSnapshot.docs.map(doc => doc.data());

      // 기간 내 신규 기록
      const newRunsQuery = query(
        collection(db, 'runs'),
        where('createdAt', '>=', Timestamp.fromDate(startDate))
      );
      const newRunsSnapshot = await getDocs(newRunsQuery);
      const newRuns = newRunsSnapshot.size;

      // 크루 수
      let totalCrews = 0;
      try {
        const crewsSnapshot = await getDocs(collection(db, 'crews'));
        totalCrews = crewsSnapshot.size;
      } catch (e) {}

      // 인기 대회 TOP 10
      const raceRuns = allRuns.filter(run => run.runType === 'race' && run.raceName);
      const raceCounts = {};
      raceRuns.forEach(run => {
        raceCounts[run.raceName] = (raceCounts[run.raceName] || 0) + 1;
      });
      const popularRaces = Object.entries(raceCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // 일별 활동 (최근 30일)
      const activityByDay = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const dayRuns = allRuns.filter(run => {
          const runDate = run.createdAt?.toDate();
          return runDate && runDate >= date && runDate < nextDate;
        });

        activityByDay.push({
          date: date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
          count: dayRuns.length
        });
      }

      setStats({
        totalUsers,
        newUsers,
        totalRuns,
        newRuns,
        totalCrews,
        popularRaces,
        activityByDay,
      });
    } catch (error) {
      console.error('통계 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // CSV 데이터 준비
  const csvData = [
    ['항목', '값'],
    ['전체 사용자', stats.totalUsers],
    ['신규 사용자', stats.newUsers],
    ['전체 기록', stats.totalRuns],
    ['신규 기록', stats.newRuns],
    ['전체 크루', stats.totalCrews],
    [],
    ['인기 대회 TOP 10'],
    ['순위', '대회명', '기록 수'],
    ...stats.popularRaces.map((race, idx) => [idx + 1, race.name, race.count])
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-navy-700 border-t-transparent mb-4"></div>
          <p className="text-navy-600">통계 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-navy-900">통계</h2>
          <p className="text-navy-600 mt-1">RunLog 활동 통계</p>
        </div>
        <CSVLink
          data={csvData}
          filename={`runlog-statistics-${new Date().toISOString().split('T')[0]}.csv`}
          className="px-4 py-2 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition-colors font-medium"
        >
          CSV 다운로드
        </CSVLink>
      </div>

      {/* 기간 선택 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex gap-2">
          <button
            onClick={() => setPeriod('7')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              period === '7'
                ? 'bg-navy-700 text-white'
                : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
            }`}
          >
            최근 7일
          </button>
          <button
            onClick={() => setPeriod('30')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              period === '30'
                ? 'bg-navy-700 text-white'
                : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
            }`}
          >
            최근 30일
          </button>
          <button
            onClick={() => setPeriod('90')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              period === '90'
                ? 'bg-navy-700 text-white'
                : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
            }`}
          >
            최근 90일
          </button>
          <button
            onClick={() => setPeriod('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              period === 'all'
                ? 'bg-navy-700 text-white'
                : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
            }`}
          >
            전체
          </button>
        </div>
      </div>

      {/* 주요 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-navy-600 mb-1">전체 사용자</p>
          <h3 className="text-3xl font-bold text-navy-900 mb-2">
            {stats.totalUsers.toLocaleString()}
          </h3>
          <p className="text-xs text-green-600 font-semibold">
            +{stats.newUsers} (기간 내)
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-navy-600 mb-1">전체 기록</p>
          <h3 className="text-3xl font-bold text-navy-900 mb-2">
            {stats.totalRuns.toLocaleString()}
          </h3>
          <p className="text-xs text-green-600 font-semibold">
            +{stats.newRuns} (기간 내)
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-navy-600 mb-1">평균 기록/사용자</p>
          <h3 className="text-3xl font-bold text-navy-900 mb-2">
            {stats.totalUsers > 0 
              ? (stats.totalRuns / stats.totalUsers).toFixed(1)
              : '0'
            }
          </h3>
          <p className="text-xs text-navy-500">개</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-navy-600 mb-1">전체 크루</p>
          <h3 className="text-3xl font-bold text-navy-900 mb-2">
            {stats.totalCrews.toLocaleString()}
          </h3>
          <p className="text-xs text-navy-500">개</p>
        </div>
      </div>

      {/* 일별 활동 차트 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-navy-900 mb-4">📈 일별 기록 추가 (최근 30일)</h3>
        <div className="h-64 flex items-end gap-1">
          {stats.activityByDay.map((day, idx) => {
            const maxCount = Math.max(...stats.activityByDay.map(d => d.count), 1);
            const height = (day.count / maxCount) * 100;
            
            return (
              <div key={idx} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-navy-700 rounded-t transition-all hover:bg-navy-600"
                  style={{ height: `${height}%`, minHeight: day.count > 0 ? '4px' : '0' }}
                  title={`${day.date}: ${day.count}개`}
                />
                {idx % 5 === 0 && (
                  <p className="text-xs text-navy-500 mt-2 rotate-45 origin-left">
                    {day.date}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 인기 대회 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-navy-900 mb-4">🏆 인기 대회 TOP 10</h3>
        {stats.popularRaces.length === 0 ? (
          <p className="text-center text-navy-500 py-8">데이터가 없습니다</p>
        ) : (
          <div className="space-y-3">
            {stats.popularRaces.map((race, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-white ${
                  idx === 0 ? 'bg-yellow-500' :
                  idx === 1 ? 'bg-gray-400' :
                  idx === 2 ? 'bg-orange-600' :
                  'bg-navy-700'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-navy-900">{race.name}</p>
                  <div className="w-full bg-navy-100 rounded-full h-2 mt-1">
                    <div
                      className="bg-navy-700 h-2 rounded-full transition-all"
                      style={{ 
                        width: `${(race.count / stats.popularRaces[0].count) * 100}%` 
                      }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-navy-900">{race.count}</p>
                  <p className="text-xs text-navy-500">기록</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Statistics;
