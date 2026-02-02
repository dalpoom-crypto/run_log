import { useState, useEffect } from 'react';
import { db, collection, query, where, orderBy, getDocs, doc, getDoc } from '../config/firebase';
import Profile from './Profile';
import PersonalRecords from './PersonalRecords';
import RunCard from './RunCard';
import FeedCard from './FeedCard';
import RunDetailModal from './RunDetailModal';

const Feed = ({ user, userData, onShowSettings, onEditRun, showOwnOnly = true }) => {
  const [runs, setRuns] = useState([]);
  const [authors, setAuthors] = useState({}); // userId -> author data
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState(null);
  const [expandedRun, setExpandedRun] = useState(null); // 확장된 게시물 ID
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadRuns = async () => {
    try {
      setLoading(true);
      
      if (showOwnOnly) {
        // 내 기록만 불러오기
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
          if (a.date !== b.date) {
            return new Date(b.date) - new Date(a.date);
          }
          
          const getCreatedAtTime = (run) => {
            if (!run.createdAt) return 0;
            if (run.createdAt?.toDate) return run.createdAt.toDate().getTime();
            if (run.createdAt?.seconds) return run.createdAt.seconds * 1000;
            if (run.createdAt?._seconds) return run.createdAt._seconds * 1000;
            if (run.createdAt instanceof Date) return run.createdAt.getTime();
            if (typeof run.createdAt === 'number') return run.createdAt;
            if (typeof run.createdAt === 'string') return new Date(run.createdAt).getTime();
            return 0;
          };
          
          const timeA = getCreatedAtTime(a);
          const timeB = getCreatedAtTime(b);
          
          if (timeA === 0 && timeB === 0) return b.id.localeCompare(a.id);
          if (timeA === 0) return 1;
          if (timeB === 0) return -1;
          return timeB - timeA;
        });
        
        setRuns(runsData);
      } else {
        // 홈 화면: 모든 사용자의 공개 기록 불러오기
        try {
          let allRuns = [];
          
          // orderBy가 인덱스 없이 실패할 수 있으므로 try-catch로 처리
          try {
            const allRunsQuery = query(collection(db, 'runs'), orderBy('date', 'desc'));
            const querySnapshot = await getDocs(allRunsQuery);
            allRuns = querySnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
          } catch (orderByError) {
            console.warn('orderBy 실패, 모든 기록 가져오기:', orderByError);
            // 인덱스가 없으면 orderBy 없이 가져오기
            const querySnapshot = await getDocs(collection(db, 'runs'));
            allRuns = querySnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            // 클라이언트에서 날짜순 정렬
            allRuns.sort((a, b) => {
              const dateA = new Date(a.date || 0);
              const dateB = new Date(b.date || 0);
              return dateB - dateA;
            });
          }
          
          console.log('전체 기록 수:', allRuns.length);
          console.log('현재 사용자 ID:', user.uid);
          
          // 클라이언트에서 공개 기록만 필터링
          // isPublic이 false가 아니면 공개 (기본값은 공개)
          // 기존 기록 중 isPublic 필드가 없는 것도 공개로 간주
          const publicRuns = allRuns.filter(run => {
            // 자신의 기록은 제외
            if (run.userId === user.uid) {
              console.log('자신의 기록 제외:', run.id);
              return false;
            }
            // isPublic이 명시적으로 false인 경우만 제외
            const isPublic = run.isPublic !== false;
            if (!isPublic) {
              console.log('비공개 기록 제외:', run.id, 'isPublic:', run.isPublic);
            }
            return isPublic;
          });
          
          console.log('공개 기록 수:', publicRuns.length);
          
          // 작성자 정보 가져오기
          const userIds = [...new Set(publicRuns.map(run => run.userId))];
          console.log('작성자 ID 목록:', userIds);
          
          const authorsData = {};
          
          await Promise.all(
            userIds.map(async (userId) => {
              try {
                const userDoc = await getDoc(doc(db, 'users', userId));
                if (userDoc.exists()) {
                  authorsData[userId] = userDoc.data();
                } else {
                  console.warn(`사용자 정보 없음: ${userId}`);
                }
              } catch (error) {
                console.error(`사용자 정보 로드 실패: ${userId}`, error);
              }
            })
          );
          
          console.log('작성자 정보:', authorsData);
          console.log('공개 기록들:', publicRuns.map(r => ({ 
            id: r.id, 
            userId: r.userId, 
            isPublic: r.isPublic,
            author: authorsData[r.userId]?.nickname || '알 수 없음'
          })));
          
          setAuthors(authorsData);
          
          // createdAt으로 정렬 (최신순)
          publicRuns.sort((a, b) => {
            const getCreatedAtTime = (run) => {
              if (!run.createdAt) return 0;
              if (run.createdAt?.toDate) return run.createdAt.toDate().getTime();
              if (run.createdAt?.seconds) return run.createdAt.seconds * 1000;
              if (run.createdAt?._seconds) return run.createdAt._seconds * 1000;
              if (run.createdAt instanceof Date) return run.createdAt.getTime();
              if (typeof run.createdAt === 'number') return run.createdAt;
              if (typeof run.createdAt === 'string') return new Date(run.createdAt).getTime();
              return 0;
            };
            
            const timeA = getCreatedAtTime(a);
            const timeB = getCreatedAtTime(b);
            
            if (timeA === 0 && timeB === 0) return b.id.localeCompare(a.id);
            if (timeA === 0) return 1;
            if (timeB === 0) return -1;
            return timeB - timeA;
          });
          
          setRuns(publicRuns);
          console.log('최종 표시할 기록 수:', publicRuns.length);
        } catch (error) {
          console.error('기록 로드 실패:', error);
        }
      }
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
    // 내 피드일 때만 타입 필터 적용
    if (showOwnOnly) {
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
    }
    
    // 홈 화면에서는 모든 공개 기록 표시 (필터 없음)
    return true;
  });

  return (
    <div>
      {showOwnOnly && <Profile user={user} userData={userData} runs={runs} />}
      {showOwnOnly && <PersonalRecords runs={runs} />}
      
      {/* 필터 & 검색 (showOwnOnly일 때만 표시) */}
      {showOwnOnly && (
        <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 mb-3 sm:mb-4 space-y-2 sm:space-y-3">
          {/* 필터 탭 */}
          <div className="flex gap-1.5 sm:gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg font-semibold text-xs sm:text-sm transition-colors ${
                filterType === 'all'
                  ? 'bg-navy-700 text-white'
                  : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
              }`}
            >
              전체 ({runs.length})
            </button>
            <button
              onClick={() => setFilterType('race')}
              className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg font-semibold text-xs sm:text-sm transition-colors ${
                filterType === 'race'
                  ? 'bg-navy-700 text-white'
                  : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
              }`}
            >
              대회 ({runs.filter(r => r.runType === 'race').length})
            </button>
            <button
              onClick={() => setFilterType('casual')}
              className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg font-semibold text-xs sm:text-sm transition-colors ${
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
      

      {loading ? (
        <div className={showOwnOnly ? 'grid grid-cols-3 gap-1' : 'space-y-4'}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className={showOwnOnly ? 'bg-white rounded-xl overflow-hidden animate-pulse shadow-sm' : 'bg-white rounded-xl overflow-hidden animate-pulse shadow-sm'}>
              {showOwnOnly ? (
                <div className="w-full aspect-square bg-gradient-to-br from-navy-100 to-navy-200"></div>
              ) : (
                <>
                  <div className="h-16 bg-navy-100"></div>
                  <div className="w-full aspect-square bg-gradient-to-br from-navy-100 to-navy-200"></div>
                  <div className="h-20 bg-navy-100"></div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm">
          <div className="text-6xl mb-4">🏃</div>
          <h3 className="text-xl font-bold text-navy-900 mb-2">아직 기록이 없습니다</h3>
          <p className="text-sm text-navy-600">첫 번째 달리기 기록을 추가해보세요!</p>
        </div>
      ) : filteredRuns.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-bold text-navy-900 mb-2">검색 결과가 없습니다</h3>
          <p className="text-sm text-navy-600">다른 키워드로 검색해보세요</p>
        </div>
      ) : showOwnOnly ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 sm:gap-1">
          {filteredRuns.map((run, index) => (
            <div
              key={run.id}
              className="transform transition-all duration-300 hover:scale-[1.02] hover:shadow-xl rounded-xl overflow-hidden fade-in-up"
              style={{
                animationDelay: `${index * 50}ms`,
                opacity: 0
              }}
            >
              <RunCard 
                run={run}
                onClick={() => setSelectedRun(run)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {filteredRuns.map((run, index) => (
            <div
              key={run.id}
              className="fade-in-up"
              style={{
                animationDelay: `${index * 50}ms`,
                opacity: 0
              }}
            >
              <FeedCard 
                run={run}
                author={authors[run.userId]}
                onExpand={(runId) => {
                  setExpandedRun(expandedRun === runId ? null : runId);
                }}
                isExpanded={expandedRun === run.id}
              />
            </div>
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
