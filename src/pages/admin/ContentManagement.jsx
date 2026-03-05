import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, deleteDoc, limit } from 'firebase/firestore';

const ContentManagement = () => {
  const db = window.firebaseDb;
  
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all'); // all, race, casual

  useEffect(() => {
    loadRuns();
  }, []);

  const loadRuns = async () => {
    try {
      const runsQuery = query(
        collection(db, 'runs'),
        orderBy('createdAt', 'desc'),
        limit(100) // 최근 100개만
      );
      const snapshot = await getDocs(runsQuery);
      
      // 사용자 정보도 함께 로드
      const runsWithUsers = await Promise.all(
        snapshot.docs.map(async (runDoc) => {
          const runData = runDoc.data();
          try {
            const userDoc = await getDocs(
              query(collection(db, 'users'), where('__name__', '==', runData.userId))
            );
            const userData = userDoc.docs[0]?.data();
            
            return {
              id: runDoc.id,
              ...runData,
              userName: userData?.nickname || '알 수 없음',
            };
          } catch (e) {
            return {
              id: runDoc.id,
              ...runData,
              userName: '알 수 없음',
            };
          }
        })
      );
      
      setRuns(runsWithUsers);
    } catch (error) {
      console.error('기록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRun = async (runId) => {
    if (!confirm('이 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'runs', runId));
      alert('기록이 삭제되었습니다.');
      loadRuns();
    } catch (error) {
      console.error('기록 삭제 실패:', error);
      alert('기록 삭제에 실패했습니다.');
    }
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const filteredRuns = runs.filter(run => {
    if (filterType === 'race') return run.runType === 'race';
    if (filterType === 'casual') return run.runType === 'casual';
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-navy-700 border-t-transparent mb-4"></div>
          <p className="text-navy-600">콘텐츠 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy-900">콘텐츠 관리</h2>
        <p className="text-navy-600 mt-1">러닝 기록 관리</p>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === 'all'
                ? 'bg-navy-700 text-white'
                : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
            }`}
          >
            전체 ({runs.length})
          </button>
          <button
            onClick={() => setFilterType('race')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === 'race'
                ? 'bg-navy-700 text-white'
                : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
            }`}
          >
            대회 ({runs.filter(r => r.runType === 'race').length})
          </button>
          <button
            onClick={() => setFilterType('casual')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === 'casual'
                ? 'bg-navy-700 text-white'
                : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
            }`}
          >
            일상 ({runs.filter(r => r.runType === 'casual').length})
          </button>
        </div>
      </div>

      {/* 기록 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRuns.map((run) => (
          <div key={run.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* 썸네일 */}
            {run.photos && run.photos.length > 0 ? (
              <div className="relative aspect-square bg-navy-100">
                <img
                  src={run.photos[0]}
                  alt="Run"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="aspect-square bg-gradient-to-br from-navy-700 to-navy-900 flex items-center justify-center">
                <span className="text-white text-4xl">🏃</span>
              </div>
            )}

            {/* 정보 */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                  run.runType === 'race' 
                    ? 'bg-yellow-100 text-yellow-700' 
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {run.runType === 'race' ? '대회' : '일상'}
                </span>
                {run.isPublic === false && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded bg-gray-100 text-gray-700">
                    비공개
                  </span>
                )}
              </div>

              <h3 className="font-bold text-navy-900 mb-1 truncate">
                {run.raceName || run.location || '기록'}
              </h3>

              <div className="flex items-center gap-2 text-sm text-navy-600 mb-2">
                <span>{run.distance}km</span>
                <span>•</span>
                <span>{formatTime(run.time)}</span>
              </div>

              <p className="text-xs text-navy-500 mb-3">
                {run.userName} • {run.createdAt?.toDate ? 
                  run.createdAt.toDate().toLocaleDateString('ko-KR') : 
                  '-'
                }
              </p>

              {run.memo && (
                <p className="text-sm text-navy-700 mb-3 line-clamp-2">
                  {run.memo}
                </p>
              )}

              <button
                onClick={() => handleDeleteRun(run.id)}
                className="w-full px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
              >
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredRuns.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-lg font-medium text-navy-900 mb-2">기록이 없습니다</p>
          <p className="text-sm text-navy-600">필터를 변경해보세요</p>
        </div>
      )}
    </div>
  );
};

export default ContentManagement;
