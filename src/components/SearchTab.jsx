import { useState, useEffect } from 'react';
import { db, collection, query, where, getDocs, orderBy, limit } from '../config/firebase';

const SearchTab = ({ user }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({
    users: [],
    races: [],
    places: []
  });
  const [recommendedUsers, setRecommendedUsers] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRecommendedUsers();
    loadRecentSearches();
  }, []);

  const loadRecommendedUsers = async () => {
    try {
      // 모든 사용자 가져오기 (createdAt 인덱스가 없을 수 있으므로)
      const usersQuery = query(
        collection(db, 'users'),
        limit(10)
      );
      const usersSnapshot = await getDocs(usersQuery);
      let allUsers = usersSnapshot.docs
        .filter(doc => doc.id !== user.uid) // 자신 제외
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: 'new'
        }));

      // createdAt이 있으면 정렬, 없으면 그대로 사용
      allUsers.sort((a, b) => {
        const getCreatedAtTime = (user) => {
          if (!user.createdAt) return 0;
          if (user.createdAt?.toDate) {
            return user.createdAt.toDate().getTime();
          }
          if (user.createdAt?.seconds) {
            return user.createdAt.seconds * 1000;
          }
          return 0;
        };
        return getCreatedAtTime(b) - getCreatedAtTime(a);
      });

      // 최대 3명만
      setRecommendedUsers(allUsers.slice(0, 3));
    } catch (error) {
      console.error('추천 사용자 로드 실패:', error);
      // 에러가 발생해도 빈 배열로 설정하여 앱이 크래시되지 않도록
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

    try {
      const results = {
        users: [],
        races: [],
        places: []
      };

      // 사용자 검색 (클라이언트 측 필터링으로 변경 - 인덱스 문제 방지)
      try {
        const usersQuery = query(
          collection(db, 'users'),
          limit(50) // 더 많은 사용자를 가져와서 클라이언트에서 필터링
        );
        const usersSnapshot = await getDocs(usersQuery);
        const queryLower = searchQuery.toLowerCase();
        results.users = usersSnapshot.docs
          .filter(doc => doc.id !== user.uid) // 자신 제외
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter(user => {
            const nickname = (user.nickname || '').toLowerCase();
            return nickname.includes(queryLower);
          })
          .slice(0, 10);
      } catch (error) {
        console.error('사용자 검색 실패:', error);
      }

      // 대회 검색 (클라이언트 측 필터링으로 변경)
      try {
        const racesQuery = query(
          collection(db, 'runs'),
          where('runType', '==', 'race'),
          limit(50) // 더 많은 기록을 가져와서 클라이언트에서 필터링
        );
        const racesSnapshot = await getDocs(racesQuery);
        const queryLower = searchQuery.toLowerCase();
        const racesMap = new Map();
        racesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.raceName) {
            const raceNameLower = data.raceName.toLowerCase();
            if (raceNameLower.includes(queryLower) && !racesMap.has(data.raceName)) {
              racesMap.set(data.raceName, {
                id: doc.id,
                raceName: data.raceName,
                date: data.date
              });
            }
          }
        });
        results.races = Array.from(racesMap.values()).slice(0, 10);
      } catch (error) {
        console.error('대회 검색 실패:', error);
      }

      // 장소 검색 (country, city)
      try {
        const placesQuery = query(
          collection(db, 'runs'),
          where('isOverseas', '==', true),
          limit(50)
        );
        const placesSnapshot = await getDocs(placesQuery);
        const placesMap = new Map();
        placesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.country || data.city) {
            const key = `${data.country || ''}_${data.city || ''}`;
            if (!placesMap.has(key)) {
              placesMap.set(key, {
                country: data.country || '',
                city: data.city || ''
              });
            }
          }
        });
        results.places = Array.from(placesMap.values())
          .filter(place => 
            (place.country && place.country.includes(searchQuery)) ||
            (place.city && place.city.includes(searchQuery))
          )
          .slice(0, 10);
      } catch (error) {
        console.error('장소 검색 실패:', error);
      }

      setSearchResults(results);
    } catch (error) {
      console.error('검색 실패:', error);
    } finally {
      setLoading(false);
    }
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
            placeholder="대회명, 장소, 사용자 검색..."
            className="w-full pl-10 pr-4 py-3 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none"
          />
          <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults({ users: [], races: [], places: [] });
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

      {/* 검색 결과가 있으면 */}
      {(searchResults.users.length > 0 || searchResults.races.length > 0 || searchResults.places.length > 0) ? (
        <div className="space-y-4">
          {/* 사용자 결과 */}
          {searchResults.users.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-navy-900 mb-3">👥 사용자</h3>
              <div className="space-y-2">
                {searchResults.users.map(user => (
                  <div key={user.id} className="flex items-center gap-3 p-2 hover:bg-navy-50 rounded-lg cursor-pointer">
                    <div className="w-10 h-10 rounded-full bg-navy-200 flex items-center justify-center">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.nickname} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-navy-600 text-sm">?</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-navy-900">{user.nickname || '이름 없음'}</p>
                    </div>
                    <button className="px-3 py-1.5 bg-navy-700 text-white text-xs font-semibold rounded-lg hover:bg-navy-800">
                      팔로우
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 대회 결과 */}
          {searchResults.races.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-navy-900 mb-3">🏃 대회</h3>
              <div className="space-y-2">
                {searchResults.races.map(race => (
                  <div key={race.id} className="p-2 hover:bg-navy-50 rounded-lg cursor-pointer">
                    <p className="font-semibold text-sm text-navy-900">{race.raceName}</p>
                    {race.date && (
                      <p className="text-xs text-navy-500 mt-1">{race.date}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 장소 결과 */}
          {searchResults.places.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-navy-900 mb-3">🌍 장소</h3>
              <div className="space-y-2">
                {searchResults.places.map((place, idx) => (
                  <div key={idx} className="p-2 hover:bg-navy-50 rounded-lg cursor-pointer">
                    <p className="font-semibold text-sm text-navy-900">
                      {place.country} {place.city}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : searchQuery ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <p className="text-navy-500">검색 결과가 없습니다</p>
        </div>
      ) : (
        /* 초기 화면 */
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

          {/* 추천 사용자 */}
          {recommendedUsers.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-navy-900 mb-3">추천 러너</h3>
              <div className="space-y-3">
                {recommendedUsers.map(user => (
                  <div key={user.id} className="flex items-center gap-3 p-3 bg-navy-50 rounded-lg">
                    <div className="w-12 h-12 rounded-full bg-navy-200 flex items-center justify-center flex-shrink-0">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.nickname} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-navy-600">?</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-navy-900 truncate">{user.nickname || '이름 없음'}</p>
                      <p className="text-xs text-navy-500">신규 가입</p>
                    </div>
                    <button className="px-3 py-1.5 bg-navy-700 text-white text-xs font-semibold rounded-lg hover:bg-navy-800 transition-colors flex-shrink-0">
                      팔로우
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchTab;
