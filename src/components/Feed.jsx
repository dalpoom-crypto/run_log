import { useState, useEffect } from 'react';
import { db, collection, query, where, orderBy, getDocs } from '../config/firebase';
import Profile from './Profile';
import PersonalRecords from './PersonalRecords';
import RunCard from './RunCard';
import RunDetailModal from './RunDetailModal';

const Feed = ({ user, userData, onShowSettings, onEditRun, showOwnOnly = true }) => {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedFilter, setFeedFilter] = useState('all'); // all, friends, crew

  const loadRuns = async () => {
    try {
      setLoading(true);
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
      
      // 같은 날짜의 경우 createdAt으로 추가 정렬 (최신순)
      runsData.sort((a, b) => {
        // 먼저 날짜로 정렬
        if (a.date !== b.date) {
          return new Date(b.date) - new Date(a.date);
        }
        
        // 같은 날짜인 경우 createdAt으로 정렬
        const getCreatedAtTime = (run) => {
          if (!run.createdAt) return 0;
          
          // Firestore Timestamp 처리
          if (run.createdAt?.toDate) {
            return run.createdAt.toDate().getTime();
          }
          if (run.createdAt?.seconds) {
            return run.createdAt.seconds * 1000;
          }
          if (run.createdAt?._seconds) {
            return run.createdAt._seconds * 1000;
          }
          if (run.createdAt instanceof Date) {
            return run.createdAt.getTime();
          }
          if (typeof run.createdAt === 'number') {
            return run.createdAt;
          }
          if (typeof run.createdAt === 'string') {
            return new Date(run.createdAt).getTime();
          }
          
          // createdAt이 없으면 문서 ID로 정렬 (뒤로)
          return 0;
        };
        
        const timeA = getCreatedAtTime(a);
        const timeB = getCreatedAtTime(b);
        
        // createdAt이 둘 다 있으면 최신순, 없으면 문서 ID로 정렬
        if (timeA === 0 && timeB === 0) {
          return b.id.localeCompare(a.id); // 문서 ID 역순
        }
        if (timeA === 0) return 1; // createdAt이 없는 것은 뒤로
        if (timeB === 0) return -1; // createdAt이 없는 것은 뒤로
        
        return timeB - timeA; // 최신순
      });
      
      setRuns(runsData);
    } catch (error) {
      console.error('기록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, [user]);

  const handleEdit = (run) => {
    setSelectedRun(null);
    onEditRun(run);
  };

  const filteredRuns = runs.filter(run => {
    // 타입 필터
    if (filterType === 'race' && run.runType !== 'race') return false;
    if (filterType === 'casual' && run.runType !== 'casual') return false;
    
    // 검색 필터
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const raceName = (run.raceName || '').toLowerCase();
      const location = (run.location || '').toLowerCase();
      const country = (run.country || '').toLowerCase();
      const city = (run.city || '').toLowerCase();
      return raceName.includes(query) || 
             location.includes(query) || 
             country.includes(query) || 
             city.includes(query);
    }
    
    // 피드 필터 (TODO: Phase 3에서 완전 구현)
    if (!showOwnOnly) {
      if (feedFilter === 'friends') {
        // TODO: 친구 기록만
        // filtered = filtered; // 임시
      } else if (feedFilter === 'crew') {
        // TODO: 크루 기록만
        // filtered = filtered; // 임시
      }
    }
    
    return true;
  });

  return (
    <div>
      {showOwnOnly && <Profile user={user} userData={userData} runs={runs} />}
      {showOwnOnly && <PersonalRecords runs={runs} />}
      
      {/* 필터 & 검색 (showOwnOnly일 때만 표시) */}
      {showOwnOnly && (
        <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 mb-4 space-y-3">
          {/* 필터 탭 */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-colors ${
                filterType === 'all'
                  ? 'bg-navy-700 text-white'
                  : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
              }`}
            >
              전체 ({runs.length})
            </button>
            <button
              onClick={() => setFilterType('race')}
              className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-colors ${
                filterType === 'race'
                  ? 'bg-navy-700 text-white'
                  : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
              }`}
            >
              대회 ({runs.filter(r => r.runType === 'race').length})
            </button>
            <button
              onClick={() => setFilterType('casual')}
              className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-colors ${
                filterType === 'casual'
                  ? 'bg-navy-700 text-white'
                  : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
              }`}
            >
              일상 ({runs.filter(r => r.runType === 'casual').length})
            </button>
          </div>

          {/* 검색 */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="대회명 또는 장소 검색..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none text-sm"
            />
            <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* 피드 필터 (showOwnOnly가 false일 때만 표시) */}
      {!showOwnOnly && (
        <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setFeedFilter('all')}
              className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-colors ${
                feedFilter === 'all'
                  ? 'bg-navy-700 text-white'
                  : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setFeedFilter('friends')}
              className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-colors ${
                feedFilter === 'friends'
                  ? 'bg-navy-700 text-white'
                  : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
              }`}
            >
              친구
            </button>
            <button
              onClick={() => setFeedFilter('crew')}
              className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-colors ${
                feedFilter === 'crew'
                  ? 'bg-navy-700 text-white'
                  : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
              }`}
            >
              크루
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-3 gap-1">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white overflow-hidden animate-pulse">
              <div className="w-full aspect-square bg-navy-100"></div>
            </div>
          ))}
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <div className="text-5xl mb-3">🏃</div>
          <h3 className="text-lg font-bold text-navy-900 mb-2">아직 기록이 없습니다</h3>
          <p className="text-sm text-navy-600">첫 번째 달리기 기록을 추가해보세요!</p>
        </div>
      ) : filteredRuns.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <div className="text-5xl mb-3">🔍</div>
          <h3 className="text-lg font-bold text-navy-900 mb-2">검색 결과가 없습니다</h3>
          <p className="text-sm text-navy-600">다른 키워드로 검색해보세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1">
          {filteredRuns.map(run => (
            <RunCard 
              key={run.id} 
              run={run}
              onClick={() => setSelectedRun(run)}
            />
          ))}
        </div>
      )}

      {selectedRun && (
        <RunDetailModal
          run={selectedRun}
          onClose={() => setSelectedRun(null)}
          onDelete={loadRuns}
          onEdit={handleEdit}
        />
      )}
    </div>
  );
};

export default Feed;
