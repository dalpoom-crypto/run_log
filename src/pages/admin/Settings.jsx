import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, Timestamp, query, where, getDoc } from 'firebase/firestore';

const Settings = () => {
  const db = window.firebaseDb;
  
  const [activeTab, setActiveTab] = useState('races'); // notices, races
  const [loading, setLoading] = useState(false);

  // 공지사항
  const [notices, setNotices] = useState([]);
  const [newNotice, setNewNotice] = useState({ title: '', content: '' });
  const [editingNotice, setEditingNotice] = useState(null);

  // 대회 데이터
  const [races, setRaces] = useState([]);
  const [newRace, setNewRace] = useState({ name: '', date: '' });
  const [unregisteredUserRaces, setUnregisteredUserRaces] = useState([]);
  const [raceYearFilter, setRaceYearFilter] = useState('all');
  const [raceMonthFilter, setRaceMonthFilter] = useState('all');

  useEffect(() => {
    if (activeTab === 'notices') {
      loadNotices();
    } else if (activeTab === 'races') {
      loadRaces();
      loadUserRaces();
    }
  }, [activeTab]);

  const loadNotices = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'notices'));
      const noticesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotices(noticesData.sort((a, b) => 
        (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0)
      ));
    } catch (error) {
      console.error('공지사항 로드 실패:', error);
      setNotices([]);
    }
  };

  const loadRaces = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'raceData'));
      const racesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRaces(racesData.sort((a, b) => 
        new Date(b.date) - new Date(a.date)
      ));
    } catch (error) {
      console.error('대회 데이터 로드 실패:', error);
      setRaces([]);
    }
  };

  // 사용자 기록에서 사용된 대회명 중, 공식 대회 데이터에 등록되지 않은 것들을 수집
  const loadUserRaces = async () => {
    try {
      // 대회 타입(runType === 'race')인 모든 기록 조회
      const runsSnapshot = await getDocs(
        query(
          collection(db, 'runs'),
          where('runType', '==', 'race')
        )
      );

      // 현재 등록된 공식 대회 목록 이름 세트
      const raceDataSnapshot = await getDocs(collection(db, 'raceData'));
      const officialRaceNames = new Set(
        raceDataSnapshot.docs
          .map((doc) => doc.data()?.name)
          .filter(Boolean)
      );

      // raceName 기준으로 사용자 대회 정보 수집 (공식 데이터에 없는 것만)
      const raceMap = {};

      runsSnapshot.docs.forEach((runDoc) => {
        const data = runDoc.data();
        const name = data.raceName;
        if (!name || officialRaceNames.has(name)) return;

        const createdAtDate = data.createdAt?.toDate ? data.createdAt.toDate() : null;
        const existing = raceMap[name];

        // 더 최근에 등록된 기록을 기준으로 저장
        if (!existing || (createdAtDate && createdAtDate > existing.createdAt)) {
          raceMap[name] = {
            name,
            date: data.date || '',
            createdAt: createdAtDate,
            userId: data.userId || null,
          };
        }
      });

      const raceArray = Object.values(raceMap);

      // 작성자 닉네임 조회
      const authorCache = {};
      await Promise.all(
        raceArray.map(async (item) => {
          const uid = item.userId;
          if (!uid) {
            item.author = '알 수 없음';
            return;
          }
          if (!authorCache[uid]) {
            try {
              const userDoc = await getDoc(doc(db, 'users', uid));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                authorCache[uid] = userData.nickname || '알 수 없음';
              } else {
                authorCache[uid] = '알 수 없음';
              }
            } catch (e) {
              authorCache[uid] = '알 수 없음';
            }
          }
          item.author = authorCache[uid];
        })
      );

      // 날짜 기준 정렬 (최신 우선)
      raceArray.sort((a, b) => {
        const ad = a.date || '';
        const bd = b.date || '';
        return bd.localeCompare(ad);
      });

      setUnregisteredUserRaces(raceArray);
    } catch (error) {
      console.error('사용자 대회 데이터 로드 실패:', error);
      setUnregisteredUserRaces([]);
    }
  };

  const handleAddNotice = async (e) => {
    e.preventDefault();
    if (!newNotice.title.trim() || !newNotice.content.trim()) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const noticeRef = doc(collection(db, 'notices'));
      await setDoc(noticeRef, {
        title: newNotice.title,
        content: newNotice.content,
        createdAt: Timestamp.now(),
        active: true
      });

      alert('공지사항이 추가되었습니다.');
      setNewNotice({ title: '', content: '' });
      loadNotices();
    } catch (error) {
      console.error('공지사항 추가 실패:', error);
      alert('공지사항 추가에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNotice = async (noticeId) => {
    if (!confirm('이 공지사항을 삭제하시겠습니까?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'notices', noticeId));
      alert('공지사항이 삭제되었습니다.');
      loadNotices();
    } catch (error) {
      console.error('공지사항 삭제 실패:', error);
      alert('공지사항 삭제에 실패했습니다.');
    }
  };

  const handleAddRace = async (e) => {
    e.preventDefault();
    if (!newRace.name.trim() || !newRace.date) {
      alert('대회명과 날짜를 모두 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const raceRef = doc(collection(db, 'raceData'));
      await setDoc(raceRef, {
        name: newRace.name,
        date: newRace.date,
        createdAt: Timestamp.now()
      });

      alert('대회가 추가되었습니다.');
      setNewRace({ name: '', date: '' });
      loadRaces();
    } catch (error) {
      console.error('대회 추가 실패:', error);
      alert('대회 추가에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRace = async (raceId) => {
    if (!confirm('이 대회를 삭제하시겠습니까?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'raceData', raceId));
      alert('대회가 삭제되었습니다.');
      loadRaces();
    } catch (error) {
      console.error('대회 삭제 실패:', error);
      alert('대회 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy-900">설정</h2>
        <p className="text-navy-600 mt-1">앱 설정 관리</p>
      </div>

      {/* 탭 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('races')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'races'
                ? 'bg-navy-700 text-white'
                : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
            }`}
          >
            🏆 대회 데이터
          </button>
          <button
            onClick={() => setActiveTab('notices')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'notices'
                ? 'bg-navy-700 text-white'
                : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
            }`}
          >
            📢 공지사항
          </button>
        </div>
      </div>

      {/* 공지사항 탭 */}
      {activeTab === 'notices' && (
        <div className="space-y-6">
          {/* 공지사항 추가 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-navy-900 mb-4">새 공지사항 추가</h3>
            <form onSubmit={handleAddNotice} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">
                  제목
                </label>
                <input
                  type="text"
                  value={newNotice.title}
                  onChange={(e) => setNewNotice({ ...newNotice, title: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-navy-200 rounded-lg focus:border-navy-600 focus:outline-none"
                  placeholder="공지사항 제목"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">
                  내용
                </label>
                <textarea
                  value={newNotice.content}
                  onChange={(e) => setNewNotice({ ...newNotice, content: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-navy-200 rounded-lg focus:border-navy-600 focus:outline-none"
                  rows="4"
                  placeholder="공지사항 내용"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition-colors font-medium disabled:opacity-50"
              >
                {loading ? '추가 중...' : '공지사항 추가'}
              </button>
            </form>
          </div>

          {/* 공지사항 목록 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-navy-900 mb-4">
              공지사항 목록 ({notices.length}개)
            </h3>
            {notices.length === 0 ? (
              <p className="text-center text-navy-500 py-8">공지사항이 없습니다</p>
            ) : (
              <div className="space-y-3">
                {notices.map((notice) => (
                  <div key={notice.id} className="border border-navy-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-bold text-navy-900">{notice.title}</h4>
                      <button
                        onClick={() => handleDeleteNotice(notice.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        삭제
                      </button>
                    </div>
                    <p className="text-sm text-navy-700 mb-2">{notice.content}</p>
                    <p className="text-xs text-navy-500">
                      {notice.createdAt?.toDate ? 
                        notice.createdAt.toDate().toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        }) : 
                        '-'
                      }
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 대회 데이터 탭 */}
      {activeTab === 'races' && (
        <div className="space-y-6">
          {/* 대회 추가 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-navy-900 mb-4">새 대회 추가</h3>
            <form onSubmit={handleAddRace} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">
                  대회명
                </label>
                <input
                  type="text"
                  value={newRace.name}
                  onChange={(e) => setNewRace({ ...newRace, name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-navy-200 rounded-lg focus:border-navy-600 focus:outline-none"
                  placeholder="예: 서울국제마라톤"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">
                  날짜
                </label>
                <input
                  type="date"
                  value={newRace.date}
                  onChange={(e) => setNewRace({ ...newRace, date: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-navy-200 rounded-lg focus:border-navy-600 focus:outline-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition-colors font-medium disabled:opacity-50"
              >
                {loading ? '추가 중...' : '대회 추가'}
              </button>
            </form>
          </div>

          {/* 대회 목록 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-navy-900 mb-4">
              대회 목록
            </h3>

            {/* 년/월 필터 */}
            <div className="flex flex-wrap gap-2 items-center mb-4">
              <span className="text-sm font-medium text-navy-700 mr-2">기간 필터</span>
              <select
                value={raceYearFilter}
                onChange={(e) => setRaceYearFilter(e.target.value)}
                className="px-3 py-1.5 border-2 border-navy-200 rounded-lg text-sm focus:outline-none focus:border-navy-600"
              >
                <option value="all">전체 연도</option>
                {Array.from(
                  new Set(
                    [
                      ...races.map((r) => r.date).filter(Boolean),
                      ...unregisteredUserRaces.map((r) => r.date).filter(Boolean),
                    ].map((d) => d.split('-')[0])
                  )
                )
                  .filter(Boolean)
                  .sort((a, b) => b.localeCompare(a))
                  .map((year) => (
                    <option key={year} value={year}>
                      {year}년
                    </option>
                  ))}
              </select>
              <select
                value={raceMonthFilter}
                onChange={(e) => setRaceMonthFilter(e.target.value)}
                className="px-3 py-1.5 border-2 border-navy-200 rounded-lg text-sm focus:outline-none focus:border-navy-600"
              >
                <option value="all">전체 월</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m.toString().padStart(2, '0')}>
                    {m}월
                  </option>
                ))}
              </select>
            </div>

            {(() => {
              // 공식 대회 + 사용자 직접 입력 대회 합친 목록
              const combined = [
                ...races.map((race) => ({
                  id: race.id,
                  name: race.name,
                  date: race.date || '',
                  author: '관리자',
                  createdAt: race.createdAt?.toDate ? race.createdAt.toDate() : null,
                  source: 'official',
                })),
                ...unregisteredUserRaces.map((race) => ({
                  id: race.name,
                  name: race.name,
                  date: race.date || '',
                  author: race.author || '알 수 없음',
                  createdAt: race.createdAt || null,
                  source: 'user',
                })),
              ];

              const filtered = combined.filter((item) => {
                if (!item.date) {
                  return raceYearFilter === 'all' && raceMonthFilter === 'all';
                }
                const [y, m] = item.date.split('-');
                if (raceYearFilter !== 'all' && y !== raceYearFilter) return false;
                if (raceMonthFilter !== 'all' && m !== raceMonthFilter) return false;
                return true;
              });

              // 날짜 기준 정렬 (최신 우선)
              filtered.sort((a, b) => {
                const ad = a.date || '';
                const bd = b.date || '';
                return bd.localeCompare(ad);
              });

              if (filtered.length === 0) {
                return (
                  <p className="text-center text-navy-500 py-8">
                    선택한 기간에 해당하는 대회가 없습니다.
                  </p>
                );
              }

              return (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-navy-200 bg-navy-50">
                        <th className="px-3 py-2 text-left font-semibold text-navy-800">대회명</th>
                        <th className="px-3 py-2 text-left font-semibold text-navy-800">날짜</th>
                        <th className="px-3 py-2 text-left font-semibold text-navy-800">작성자</th>
                        <th className="px-3 py-2 text-left font-semibold text-navy-800">생성일</th>
                        <th className="px-3 py-2 text-left font-semibold text-navy-800">구분</th>
                        <th className="px-3 py-2 text-right font-semibold text-navy-800">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((race) => (
                        <tr key={race.id} className="border-b border-navy-100 hover:bg-navy-50">
                          <td className="px-3 py-2 text-navy-900">{race.name}</td>
                          <td className="px-3 py-2 text-navy-700">
                            {race.date || '-'}
                          </td>
                          <td className="px-3 py-2 text-navy-700">{race.author}</td>
                          <td className="px-3 py-2 text-navy-700">
                            {race.createdAt
                              ? race.createdAt.toLocaleDateString('ko-KR', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                })
                              : '-'}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                                race.source === 'official'
                                  ? 'bg-navy-100 text-navy-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {race.source === 'official' ? '공식' : '사용자 입력'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {race.source === 'official' ? (
                              <button
                                onClick={() => handleDeleteRace(race.id)}
                                className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-xs font-medium"
                              >
                                삭제
                              </button>
                            ) : (
                              <span className="text-xs text-navy-400">
                                기록에서 자동 수집
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
