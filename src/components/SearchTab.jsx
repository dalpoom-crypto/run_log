import { useState, useEffect } from 'react';
import { db, collection, query, where, getDocs, orderBy, limit, doc, getDoc, setDoc, deleteDoc, Timestamp } from '../config/firebase';
import { showToast } from '../utils/toast';
import RunCard from './RunCard';
import Feed from './Feed';
import RunDetailModal from './RunDetailModal';

const SearchTab = ({ user, userData }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState(null); // 'posts' or 'user'
  const [searchResults, setSearchResults] = useState({
    posts: [],
    users: []
  });
  const [recommendedUsers, setRecommendedUsers] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState(null);
  const [viewingUserId, setViewingUserId] = useState(null); // 검색한 러너의 피드 보기
  const [userStats, setUserStats] = useState({}); // userId -> stats
  const [relationships, setRelationships] = useState({}); // userId -> relationship status
  const [showStatsModal, setShowStatsModal] = useState(null); // { userId, type: 'records' | 'friends' }
  const [followCounts, setFollowCounts] = useState({}); // userId -> { followers, following }

  useEffect(() => {
    loadRecommendedUsers();
    loadRecentSearches();
  }, []);

  // 사용자 통계 계산 (전체 기록 수, 대회수, 일상수, 해외 일상수, 42.195km finisher 여부)
  const calculateUserStats = async (userId) => {
    try {
      const runsQuery = query(
        collection(db, 'runs'),
        where('userId', '==', userId)
      );
      const runsSnapshot = await getDocs(runsQuery);
      const runs = runsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const raceCount = runs.filter(run => run.runType === 'race').length;
      const casualCount = runs.filter(run => run.runType === 'casual').length;
      const overseasCasualCount = runs.filter(run => run.runType === 'casual' && run.isOverseas).length;
      const totalCount = runs.length;
      const hasFullMarathon = runs.some(run => 
        run.raceType === 'FULL' || 
        (run.runType === 'race' && run.distance && run.distance >= 42.195)
      );
      
      return {
        totalCount,
        raceCount,
        casualCount,
        overseasCasualCount,
        hasFullMarathon
      };
    } catch (error) {
      console.error('사용자 통계 계산 실패:', error);
      return { totalCount: 0, raceCount: 0, casualCount: 0, overseasCasualCount: 0, hasFullMarathon: false };
    }
  };

  // 친구 수 계산
  const calculateFriendCount = async (userId) => {
    try {
      const friendsQuery1 = query(
        collection(db, 'friends'),
        where('userId1', '==', userId)
      );
      const friendsQuery2 = query(
        collection(db, 'friends'),
        where('userId2', '==', userId)
      );
      const [friendsSnapshot1, friendsSnapshot2] = await Promise.all([
        getDocs(friendsQuery1),
        getDocs(friendsQuery2)
      ]);
      return friendsSnapshot1.size + friendsSnapshot2.size;
    } catch (error) {
      console.error('친구 수 계산 실패:', error);
      return 0;
    }
  };

  // 팔로워/팔로잉 수 계산
  const calculateFollowCounts = async (userId) => {
    try {
      const followersQuery = query(
        collection(db, 'follows'),
        where('followingId', '==', userId)
      );
      const followingQuery = query(
        collection(db, 'follows'),
        where('followerId', '==', userId)
      );
      const [followersSnapshot, followingSnapshot] = await Promise.all([
        getDocs(followersQuery),
        getDocs(followingQuery)
      ]);
      return {
        followers: followersSnapshot.size,
        following: followingSnapshot.size
      };
    } catch (error) {
      console.error('팔로우 수 계산 실패:', error);
      return { followers: 0, following: 0 };
    }
  };

  // 관계 상태 확인
  const checkRelationship = async (targetUserId) => {
    if (!user || !targetUserId || user.uid === targetUserId) return null;
    
    try {
      const currentUserId = user.uid;
      
      // 내가 팔로우하는지 확인
      const followingQuery = query(
        collection(db, 'follows'),
        where('followerId', '==', currentUserId),
        where('followingId', '==', targetUserId)
      );
      const followingSnapshot = await getDocs(followingQuery);
      const iAmFollowing = !followingSnapshot.empty;
      
      // 상대가 나를 팔로우하는지 확인
      const followersQuery = query(
        collection(db, 'follows'),
        where('followerId', '==', targetUserId),
        where('followingId', '==', currentUserId)
      );
      const followersSnapshot = await getDocs(followersQuery);
      const followingMe = !followersSnapshot.empty;
      
      // 친구 관계 확인
      const friendsQuery1 = query(
        collection(db, 'friends'),
        where('userId1', '==', currentUserId),
        where('userId2', '==', targetUserId)
      );
      const friendsQuery2 = query(
        collection(db, 'friends'),
        where('userId1', '==', targetUserId),
        where('userId2', '==', currentUserId)
      );
      const [friendsSnapshot1, friendsSnapshot2] = await Promise.all([
        getDocs(friendsQuery1),
        getDocs(friendsQuery2)
      ]);
      const isFriend = !friendsSnapshot1.empty || !friendsSnapshot2.empty;
      
      if (isFriend) {
        return { type: 'friend', label: '러닝 버디' };
      } else if (iAmFollowing && followingMe) {
        return { type: 'mutualFollow', label: '러닝 버디' };
      } else if (iAmFollowing) {
        return { type: 'iAmFollowing', label: '팔로잉 중' };
      } else {
        return { type: 'none', label: '팔로우' };
      }
    } catch (error) {
      console.error('관계 확인 실패:', error);
      return { type: 'none', label: '팔로우' };
    }
  };

  // 추천 러너 로드 (랜덤)
  const loadRecommendedUsers = async () => {
    try {
      const usersQuery = query(
        collection(db, 'users'),
        limit(50)
      );
      const usersSnapshot = await getDocs(usersQuery);
      let allUsers = usersSnapshot.docs
        .filter(doc => doc.id !== user.uid)
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

      // 랜덤으로 섞기
      allUsers = allUsers.sort(() => Math.random() - 0.5);
      
      // 최대 3명만
      const selectedUsers = allUsers.slice(0, 3);
      
      // 각 사용자의 통계 및 관계 정보 가져오기
      const usersWithStats = await Promise.all(
        selectedUsers.map(async (userData) => {
          const stats = await calculateUserStats(userData.id);
          const relationship = await checkRelationship(userData.id);
          const friendCount = await calculateFriendCount(userData.id);
          const followCountsData = await calculateFollowCounts(userData.id);
          return {
            ...userData,
            stats,
            relationship,
            friendCount,
            followCounts: followCountsData
          };
        })
      );
      
      setRecommendedUsers(usersWithStats);
    } catch (error) {
      console.error('추천 사용자 로드 실패:', error);
      setRecommendedUsers([]);
    }
  };

  const loadRecentSearches = () => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  };

  const saveRecentSearch = (query) => {
    const updated = [query, ...recentSearches.filter(q => q !== query)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    saveRecentSearch(searchQuery);
    setViewingUserId(null);
    setSearchType(null);

    try {
      const queryLower = searchQuery.toLowerCase();
      
      // 먼저 사용자 검색
      const usersQuery = query(
        collection(db, 'users'),
        limit(50)
      );
      const usersSnapshot = await getDocs(usersQuery);
      const matchedUsers = usersSnapshot.docs
        .filter(doc => doc.id !== user.uid)
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(userData => {
          const nickname = (userData.nickname || '').toLowerCase();
          return nickname.includes(queryLower);
        });

      // 사용자가 정확히 일치하면 해당 러너의 피드 표시
      const exactMatch = matchedUsers.find(u => 
        (u.nickname || '').toLowerCase() === queryLower
      );

      if (exactMatch) {
        setViewingUserId(exactMatch.id);
        setSearchType('user');
        setSearchResults({ posts: [], users: [] });
      } else {
        // 게시글 검색 (대회명, 장소 등)
        const runsQuery = query(
          collection(db, 'runs'),
          limit(100)
        );
        const runsSnapshot = await getDocs(runsQuery);
        const matchedPosts = runsSnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter(run => {
            const raceName = (run.raceName || '').toLowerCase();
            const location = (run.location || '').toLowerCase();
            const country = (run.country || '').toLowerCase();
            const city = (run.city || '').toLowerCase();
            const place = (run.place || '').toLowerCase();
            
            return raceName.includes(queryLower) ||
                   location.includes(queryLower) ||
                   country.includes(queryLower) ||
                   city.includes(queryLower) ||
                   place.includes(queryLower);
          })
          .slice(0, 30); // 최대 30개

        // 사용자 목록에 통계 및 관계 정보 추가
        const usersWithStats = await Promise.all(
          matchedUsers.slice(0, 10).map(async (userData) => {
            const stats = await calculateUserStats(userData.id);
            const relationship = await checkRelationship(userData.id);
            const friendCount = await calculateFriendCount(userData.id);
            const followCountsData = await calculateFollowCounts(userData.id);
            return {
              ...userData,
              stats,
              relationship,
              friendCount,
              followCounts: followCountsData
            };
          })
        );

        setSearchType('posts');
        setSearchResults({
          posts: matchedPosts,
          users: usersWithStats
        });
      }
    } catch (error) {
      console.error('검색 실패:', error);
      showToast('검색에 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 팔로우 처리
  const handleFollow = async (targetUserId, currentRelationship) => {
    if (!user || !targetUserId) return;

    try {
      const currentUserId = user.uid;
      
      if (currentRelationship?.type === 'none') {
        // 팔로우
        await setDoc(doc(db, 'follows', `${currentUserId}_${targetUserId}`), {
          followerId: currentUserId,
          followingId: targetUserId,
          createdAt: Timestamp.now()
        });
        showToast('팔로우했습니다.');
        
        // 알림 생성
        const currentUserDoc = await getDoc(doc(db, 'users', currentUserId));
        const currentUserData = currentUserDoc.exists() ? currentUserDoc.data() : {};
        await createNotification(targetUserId, 'follow', {
          fromUserId: currentUserId,
          fromUserNickname: currentUserData.nickname || user.displayName || '익명',
        });
        
        // 맞팔로우 확인 (상대가 나를 팔로우 중인지 확인)
        const reverseFollowQuery = query(
          collection(db, 'follows'),
          where('followerId', '==', targetUserId),
          where('followingId', '==', currentUserId)
        );
        const reverseFollowSnapshot = await getDocs(reverseFollowQuery);
        if (!reverseFollowSnapshot.empty) {
          // 맞팔로우가 되었으므로 양쪽 모두에게 알림
          const targetUserDoc = await getDoc(doc(db, 'users', targetUserId));
          const targetUserData = targetUserDoc.exists() ? targetUserDoc.data() : {};
          await createNotification(currentUserId, 'mutualFollow', {
            fromUserId: targetUserId,
            fromUserNickname: targetUserData.nickname || '익명',
          });
          await createNotification(targetUserId, 'mutualFollow', {
            fromUserId: currentUserId,
            fromUserNickname: currentUserData.nickname || user.displayName || '익명',
          });
        }
        
        // 관계 상태 업데이트
        const newRelationship = await checkRelationship(targetUserId);
        setRelationships(prev => ({
          ...prev,
          [targetUserId]: newRelationship
        }));
        
        // 추천 러너 목록도 업데이트
        setRecommendedUsers(prev => 
          prev.map(u => 
            u.id === targetUserId 
              ? { ...u, relationship: newRelationship }
              : u
          )
        );
      } else if (currentRelationship?.type === 'iAmFollowing') {
        // 팔로우 해제
        await deleteDoc(doc(db, 'follows', `${currentUserId}_${targetUserId}`));
        showToast('팔로우를 해제했습니다.');
        
        const newRelationship = await checkRelationship(targetUserId);
        setRelationships(prev => ({
          ...prev,
          [targetUserId]: newRelationship
        }));
        
        setRecommendedUsers(prev => 
          prev.map(u => 
            u.id === targetUserId 
              ? { ...u, relationship: newRelationship }
              : u
          )
        );
      }
    } catch (error) {
      console.error('팔로우 처리 실패:', error);
      showToast('작업에 실패했습니다.', 'error');
    }
  };

  // 신규 가입 여부 확인 (일주일 이내)
  const isNewUser = (userData) => {
    if (!userData.createdAt) return false;
    
    let createdAt = null;
    if (userData.createdAt?.toDate) {
      createdAt = userData.createdAt.toDate();
    } else if (userData.createdAt?.seconds) {
      createdAt = new Date(userData.createdAt.seconds * 1000);
    } else if (userData.createdAt instanceof Date) {
      createdAt = userData.createdAt;
    } else {
      return false;
    }
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    return createdAt >= oneWeekAgo;
  };

  return (
    <div className="space-y-4">
      {/* 검색창 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="러너 닉네임, 대회명, 장소 검색..."
            className="w-full pl-10 pr-4 py-3 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none"
          />
          <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults({ posts: [], users: [] });
                setSearchType(null);
                setViewingUserId(null);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {searchQuery && (
            <button
              onClick={handleSearch}
              disabled={loading}
              className="absolute right-10 top-1/2 -translate-y-1/2 text-navy-600 hover:text-navy-800 font-semibold text-sm"
            >
              {loading ? '검색 중...' : '검색'}
            </button>
          )}
        </div>
      </div>

      {/* 검색 결과: 러너 피드 */}
      {searchType === 'user' && viewingUserId && (
        <Feed
          user={user}
          userData={userData}
          showOwnOnly={true}
          viewingUserId={viewingUserId}
          onViewUserProfile={(userId) => setViewingUserId(userId)}
        />
      )}

      {/* 검색 결과: 게시글 3열 그리드 */}
      {searchType === 'posts' && searchResults.posts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-bold text-navy-900 mb-4">게시글 검색 결과</h3>
          <div className="grid grid-cols-3 gap-1 sm:gap-1">
            {searchResults.posts.map((run) => (
              <div
                key={run.id}
                className="transform transition-all duration-300 hover:scale-[1.02] hover:shadow-xl rounded-xl overflow-hidden fade-in-up"
              >
                <RunCard
                  run={run}
                  onClick={() => setSelectedRun(run)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 검색 결과: 사용자 목록 */}
      {searchType === 'posts' && searchResults.users.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-bold text-navy-900 mb-3">👥 사용자</h3>
          <div className="space-y-2">
            {searchResults.users.map(userData => {
              const stats = userData.stats || { totalCount: 0, raceCount: 0, casualCount: 0, overseasCasualCount: 0, hasFullMarathon: false };
              const relationship = userData.relationship || { type: 'none', label: '팔로우' };
              const friendCount = userData.friendCount || 0;
              const followCountsData = userData.followCounts || { followers: 0, following: 0 };
              const isNew = isNewUser(userData);
              
              return (
                <div 
                  key={userData.id} 
                  className="flex items-center gap-3 p-2 hover:bg-navy-50 rounded-lg cursor-pointer"
                  onClick={() => {
                    setViewingUserId(userData.id);
                    setSearchType('user');
                  }}
                >
                <div className="w-10 h-10 rounded-2xl bg-navy-200 flex items-center justify-center flex-shrink-0">
                    {userData.photoURL ? (
                      <img src={userData.photoURL} alt={userData.nickname} className="w-full h-full rounded-2xl object-cover" />
                    ) : (
                      <span className="text-navy-600 text-sm">?</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-navy-900 truncate">{userData.nickname || '이름 없음'}</p>
                    <div className="space-y-1 mt-0.5">
                      {/* 첫 번째 줄: 기록, 러닝 버디 */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowStatsModal({ userId: userData.id, type: 'records', stats });
                          }}
                          className="text-[10px] text-navy-600 hover:text-navy-800 transition-colors"
                        >
                          <span className="font-semibold">기록</span>
                          <span className="ml-1">{stats.totalCount}</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowStatsModal({ userId: userData.id, type: 'friends', followCounts: followCountsData });
                          }}
                          className="text-[10px] text-navy-600 hover:text-navy-800 transition-colors"
                        >
                          <span className="font-semibold">러닝 버디</span>
                          <span className="ml-1">{friendCount}</span>
                        </button>
                      </div>
                      {/* 두 번째 줄: 뱃지들 */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {isNew && (
                          <span className="text-[10px] text-navy-600 bg-navy-100 px-1.5 py-0.5 rounded">신규 가입</span>
                        )}
                        {stats.hasFullMarathon && (
                          <span className="text-[10px] text-navy-600 bg-navy-100 px-1.5 py-0.5 rounded">42.195km finisher</span>
                        )}
                        {userData.crewName && (
                          <span className="text-[10px] text-navy-600 bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">{userData.crewName}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFollow(userData.id, relationship);
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex-shrink-0 ${
                      relationship.type === 'none'
                        ? 'bg-navy-700 text-white hover:bg-navy-800'
                        : relationship.type === 'friend' || relationship.type === 'mutualFollow'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-navy-100 text-navy-700'
                    }`}
                  >
                    {relationship.label}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 검색 결과 없음 */}
      {searchQuery && searchType === 'posts' && searchResults.posts.length === 0 && searchResults.users.length === 0 && !loading && (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <p className="text-navy-500">검색 결과가 없습니다</p>
        </div>
      )}

      {/* 초기 화면 */}
      {!searchQuery && !viewingUserId && (
        <div className="space-y-4">
          {/* 최근 검색 */}
          {recentSearches.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-navy-900 mb-3">최근 검색</h3>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((query, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSearchQuery(query);
                      handleSearch();
                    }}
                    className="px-3 py-1.5 bg-navy-100 text-navy-700 rounded-full text-sm hover:bg-navy-200 transition-colors"
                  >
                    {query}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 추천 러너 */}
          {recommendedUsers.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-navy-900 mb-3">추천 러너</h3>
              <div className="space-y-3">
                {recommendedUsers.map(userData => {
                  const relationship = userData.relationship || { type: 'none', label: '팔로우' };
                  const stats = userData.stats || { totalCount: 0, raceCount: 0, casualCount: 0, overseasCasualCount: 0, hasFullMarathon: false };
                  const friendCount = userData.friendCount || 0;
                  const followCountsData = userData.followCounts || { followers: 0, following: 0 };
                  const isNew = isNewUser(userData);
                  
                  return (
                    <div 
                      key={userData.id} 
                      className="flex items-center gap-3 p-3 bg-navy-50 rounded-lg cursor-pointer hover:bg-navy-100 transition-colors"
                      onClick={() => {
                        setViewingUserId(userData.id);
                        setSearchType('user');
                      }}
                    >
                      <div className="w-12 h-12 rounded-2xl bg-navy-200 flex items-center justify-center flex-shrink-0">
                        {userData.photoURL ? (
                          <img src={userData.photoURL} alt={userData.nickname} className="w-full h-full rounded-2xl object-cover" />
                        ) : (
                          <span className="text-navy-600">?</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-navy-900 truncate mb-1">{userData.nickname || '이름 없음'}</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isNew && (
                            <span className="text-[10px] text-navy-600 bg-navy-100 px-2 py-0.5 rounded">신규 가입</span>
                          )}
                          {stats.hasFullMarathon && (
                            <span className="text-[10px] text-navy-600 bg-navy-100 px-2 py-0.5 rounded">42.195km finisher</span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowStatsModal({ userId: userData.id, type: 'records', stats });
                            }}
                            className="text-[10px] text-navy-500 hover:text-navy-700 transition-colors"
                          >
                            기록 {stats.totalCount}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowStatsModal({ userId: userData.id, type: 'friends', followCounts: followCountsData });
                            }}
                            className="text-[10px] text-navy-500 hover:text-navy-700 transition-colors"
                          >
                            러닝 버디 {friendCount}
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFollow(userData.id, relationship);
                        }}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex-shrink-0 ${
                          relationship.type === 'none'
                            ? 'bg-navy-700 text-white hover:bg-navy-800'
                            : relationship.type === 'friend' || relationship.type === 'mutualFollow'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-navy-100 text-navy-700'
                        }`}
                      >
                        {relationship.label}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 게시글 상세 모달 */}
      {selectedRun && (
        <RunDetailModal
          run={selectedRun}
          onClose={() => setSelectedRun(null)}
          onDelete={() => {
            setSelectedRun(null);
            handleSearch(); // 검색 결과 새로고침
          }}
          onEdit={() => {
            setSelectedRun(null);
          }}
          currentUser={{ uid: user.uid, userData, displayName: userData?.nickname || user.displayName }}
        />
      )}

      {/* 통계 상세 모달 */}
      {showStatsModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowStatsModal(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-navy-900">
                {showStatsModal.type === 'records' ? '기록' : '러닝 버디'}
              </h3>
              <button
                onClick={() => setShowStatsModal(null)}
                className="text-navy-400 hover:text-navy-600 transition-colors p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {showStatsModal.type === 'records' && showStatsModal.stats && (
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-navy-50 rounded-lg">
                  <span className="text-sm font-semibold text-navy-700">대회</span>
                  <span className="text-sm text-navy-900">{showStatsModal.stats.raceCount}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-navy-50 rounded-lg">
                  <span className="text-sm font-semibold text-navy-700">일상 {showStatsModal.stats.overseasCasualCount > 0 && `(해외 ${showStatsModal.stats.overseasCasualCount})`}</span>
                  <span className="text-sm text-navy-900">{showStatsModal.stats.casualCount}</span>
                </div>
              </div>
            )}
            
            {showStatsModal.type === 'friends' && showStatsModal.followCounts && (
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-navy-50 rounded-lg">
                  <span className="text-sm font-semibold text-navy-700">팔로워</span>
                  <span className="text-sm text-navy-900">{showStatsModal.followCounts.followers}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-navy-50 rounded-lg">
                  <span className="text-sm font-semibold text-navy-700">팔로잉</span>
                  <span className="text-sm text-navy-900">{showStatsModal.followCounts.following}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchTab;
