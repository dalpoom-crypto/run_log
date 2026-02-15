import { useState, useEffect } from 'react';
import { db, collection, query, where, orderBy, getDocs, doc, getDoc } from '../config/firebase';
import Profile from './Profile';
import PersonalRecords from './PersonalRecords';
import RunCard from './RunCard';
import FeedCard from './FeedCard';
import RunDetailModal from './RunDetailModal';

const Feed = ({ user, userData, onShowSettings, onEditRun, showOwnOnly = true, viewingUserId = null, onViewUserProfile }) => {
  const [runs, setRuns] = useState([]);
  const [authors, setAuthors] = useState({}); // userId -> author data
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState(null);
  const [expandedRun, setExpandedRun] = useState(null); // 확장된 게시물 ID
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [homeVisibleCount, setHomeVisibleCount] = useState(10); // 홈 피드에서 한 번에 보여줄 개수

  const loadRuns = async () => {
    try {
      setLoading(true);
      
      if (showOwnOnly || viewingUserId) {
        // 내 기록 또는 특정 사용자의 기록 불러오기
        const targetUserId = viewingUserId || user.uid;
        const q = query(
          collection(db, 'runs'),
          where('userId', '==', targetUserId),
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
          // - 내 기록은 홈 피드에서 제외
          // - isPublic 이 명시적으로 false 인 것만 제외
          // - isPublic 필드가 없거나 true 인 것은 공개로 간주
          const publicRuns = allRuns.filter(run => {
            if (run.userId === user.uid) {
              return false;
            }
            return run.isPublic !== false;
          });
          
          console.log('공개 기록 수:', publicRuns.length);
          
          // 작성자 정보 가져오기
          const userIds = [...new Set(publicRuns.map(run => run.userId))];
          console.log('작성자 ID 목록:', userIds);
          
          const authorsData = {};
          
          // 사용자 정보 가져오기
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
          
          // 관계 데이터 가져오기 (팔로우, 친구)
          const currentUserId = user.uid;
          
          // 내가 팔로우하는 사람들
          const followingQuery = query(
            collection(db, 'follows'),
            where('followerId', '==', currentUserId)
          );
          const followingSnapshot = await getDocs(followingQuery);
          const followingIds = followingSnapshot.docs.map(doc => doc.data().followingId);
          
          // 나를 팔로우하는 사람들
          const followersQuery = query(
            collection(db, 'follows'),
            where('followingId', '==', currentUserId)
          );
          const followersSnapshot = await getDocs(followersQuery);
          const followerIds = followersSnapshot.docs.map(doc => doc.data().followerId);
          
          // 친구 관계 확인 (서로 팔로우하고 친구 요청이 수락된 경우)
          const friendsQuery = query(
            collection(db, 'friends'),
            where('userId1', '==', currentUserId)
          );
          const friendsSnapshot1 = await getDocs(friendsQuery);
          const friendIds1 = friendsSnapshot1.docs.map(doc => doc.data().userId2);
          
          const friendsQuery2 = query(
            collection(db, 'friends'),
            where('userId2', '==', currentUserId)
          );
          const friendsSnapshot2 = await getDocs(friendsQuery2);
          const friendIds2 = friendsSnapshot2.docs.map(doc => doc.data().userId1);
          
          const allFriendIds = [...new Set([...friendIds1, ...friendIds2])];
          
          // 각 작성자에 관계 정보 추가
          userIds.forEach(userId => {
            if (authorsData[userId]) {
              authorsData[userId].iAmFollowing = followingIds.includes(userId);
              authorsData[userId].followingMe = followerIds.includes(userId);
              authorsData[userId].isFriend = allFriendIds.includes(userId);
            }
          });
          
          console.log('작성자 정보:', authorsData);
          console.log('공개 기록들:', publicRuns.map(r => ({ 
            id: r.id, 
            userId: r.userId, 
            isPublic: r.isPublic,
            author: authorsData[r.userId]?.nickname || '알 수 없음'
          })));
          
          setAuthors(authorsData);
          
          // 랜덤 정렬 (홈 화면 피드)
          publicRuns.sort(() => Math.random() - 0.5);
          
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
  }, [user, viewingUserId]);

  // 기록 추가/수정 후 피드 새로고침
  useEffect(() => {
    const handleRunsUpdated = () => {
      loadRuns();
    };

    window.addEventListener('runsUpdated', handleRunsUpdated);
    return () => window.removeEventListener('runsUpdated', handleRunsUpdated);
  }, [user, viewingUserId]);

  const isHomeFeed = !showOwnOnly && !viewingUserId;

  // 홈 피드 모드가 바뀌거나 데이터가 바뀔 때, 표시 개수 초기화
  useEffect(() => {
    if (isHomeFeed) {
      setHomeVisibleCount(10);
    } else {
      setHomeVisibleCount(0);
    }
  }, [isHomeFeed, runs.length]);

  // 홈 화면에서 스크롤 내리면 더 많은 게시글을 순차적으로 표시
  useEffect(() => {
    if (!isHomeFeed) return;

    const handleScroll = () => {
      if (!isHomeFeed || loading) return;

      const scrollPosition = window.innerHeight + window.scrollY;
      const fullHeight = document.documentElement.scrollHeight;
      const threshold = 200; // 하단 200px 근처에서 추가 로딩

      if (scrollPosition >= fullHeight - threshold) {
        setHomeVisibleCount((prev) => {
          if (prev >= runs.length) return prev;
          return Math.min(prev + 10, runs.length);
        });
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHomeFeed, loading, runs.length]);

  // 홈/프로필 탭 아이콘을 다시 눌렀을 때 상세보기/확장 상태 리셋
  useEffect(() => {
    const handleResetFeedView = () => {
      setSelectedRun(null);
      setExpandedRun(null);
    };

    window.addEventListener('resetFeedView', handleResetFeedView);
    return () => window.removeEventListener('resetFeedView', handleResetFeedView);
  }, []);

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

  // viewingUserId가 있으면 해당 사용자의 정보 가져오기
  const [viewingUserData, setViewingUserData] = useState(null);
  
  useEffect(() => {
    const loadViewingUserData = async () => {
      if (viewingUserId) {
        try {
          const userDoc = await getDoc(doc(db, 'users', viewingUserId));
          if (userDoc.exists()) {
            setViewingUserData(userDoc.data());
          }
        } catch (error) {
          console.error('사용자 정보 로드 실패:', error);
        }
      } else {
        setViewingUserData(null);
      }
    };
    loadViewingUserData();
  }, [viewingUserId]);
  
  // 관계 데이터 가져오기 (viewingUserId가 있을 때)
  const [relationshipData, setRelationshipData] = useState({});
  
  useEffect(() => {
    const loadRelationshipData = async () => {
      if (viewingUserId && user) {
        try {
          const currentUserId = user.uid;
          
          // 내가 상대를 팔로우하는지 확인
          const followingQuery = query(
            collection(db, 'follows'),
            where('followerId', '==', currentUserId),
            where('followingId', '==', viewingUserId)
          );
          const followingSnapshot = await getDocs(followingQuery);
          const iAmFollowing = !followingSnapshot.empty;
          
          // 상대가 나를 팔로우하는지 확인
          const followersQuery = query(
            collection(db, 'follows'),
            where('followerId', '==', viewingUserId),
            where('followingId', '==', currentUserId)
          );
          const followersSnapshot = await getDocs(followersQuery);
          const followingMe = !followersSnapshot.empty;
          
          // 친구 관계 확인
          const friendsQuery1 = query(
            collection(db, 'friends'),
            where('userId1', '==', currentUserId),
            where('userId2', '==', viewingUserId)
          );
          const friendsQuery2 = query(
            collection(db, 'friends'),
            where('userId1', '==', viewingUserId),
            where('userId2', '==', currentUserId)
          );
          const [friendsSnapshot1, friendsSnapshot2] = await Promise.all([
            getDocs(friendsQuery1),
            getDocs(friendsQuery2)
          ]);
          const isFriend = !friendsSnapshot1.empty || !friendsSnapshot2.empty;
          
          setRelationshipData({
            iAmFollowing,
            followingMe,
            isFriend
          });
        } catch (error) {
          console.error('관계 데이터 로드 실패:', error);
        }
      } else {
        setRelationshipData({});
      }
    };
    loadRelationshipData();
  }, [viewingUserId, user]);

  return (
    <div>
      {/* Profile 컴포넌트: 내 피드 또는 다른 사용자 피드 */}
      {showOwnOnly && (
        viewingUserId ? (
          <Profile 
            user={{ uid: viewingUserId, ...viewingUserData }} 
            userData={viewingUserData} 
            runs={runs}
            relationshipData={relationshipData}
            currentUser={user}
            onViewUserProfile={onViewUserProfile}
          />
        ) : (
          <Profile user={user} userData={userData} runs={runs} />
        )
      )}
      {showOwnOnly && <PersonalRecords runs={runs} />}
      
      {/* 필터 & 검색 (내 피드일 때만 표시, 다른 사용자 피드에서는 제외) */}
      {(showOwnOnly && !viewingUserId) && (
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
      ) : (showOwnOnly || viewingUserId) ? (
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
                // 내 피드(내 기록) + 타인 피드 격자 썸네일 모두 같은 레이오버 스타일 사용
                compactOverlay={showOwnOnly || !!viewingUserId}
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
                currentUser={{ uid: user.uid, userData }}
                onNicknameClick={onViewUserProfile || ((userId) => {
                  window.dispatchEvent(new CustomEvent('viewUserProfile', { detail: { userId } }));
                })}
                compactOverlay={showOwnOnly}
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
          currentUser={{ uid: user.uid, userData, displayName: userData?.nickname || user.displayName }}
          onViewUserProfile={onViewUserProfile}
        />
      )}
    </div>
  );
};

export default Feed;
