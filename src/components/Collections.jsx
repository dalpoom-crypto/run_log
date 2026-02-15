import { useState, useEffect } from 'react';
import { db, collection, addDoc, doc, updateDoc, deleteDoc, query, where, getDocs, Timestamp } from '../config/firebase';
import { showToast } from '../utils/toast';
import { formatDate } from '../utils/formatters';

const Collections = ({ user, runs }) => {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [collectionName, setCollectionName] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');
  const [selectedRunIds, setSelectedRunIds] = useState([]);

  useEffect(() => {
    loadCollections();
  }, [user]);

  const loadCollections = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'collections'),
        where('userId', '==', user.uid)
      );
      const querySnapshot = await getDocs(q);
      const collectionsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // 클라이언트 측에서 정렬 (createdAt 기준 최신순)
      collectionsData.sort((a, b) => {
        const getCreatedAtTime = (collection) => {
          if (!collection.createdAt) return 0;
          if (collection.createdAt?.toDate) {
            return collection.createdAt.toDate().getTime();
          }
          if (collection.createdAt?.seconds) {
            return collection.createdAt.seconds * 1000;
          }
          return 0;
        };
        return getCreatedAtTime(b) - getCreatedAtTime(a);
      });
      
      setCollections(collectionsData);
    } catch (error) {
      console.error('컬렉션 로드 실패:', error);
      // 권한 오류인 경우 조용히 처리 (규칙이 아직 설정되지 않았을 수 있음)
      if (error.code === 'permission-denied' || error.message.includes('permissions')) {
        console.warn('컬렉션 권한이 없습니다. Firestore 규칙을 확인해주세요.');
        setCollections([]);
      } else {
        showToast('컬렉션을 불러오는데 실패했습니다.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async () => {
    if (!collectionName.trim()) {
      showToast('컬렉션 이름을 입력해주세요.', 'error');
      return;
    }

    try {
      // 대표 사진: 첫 번째 기록의 첫 번째 사진
      let coverPhoto = '';
      if (selectedRunIds.length > 0) {
        const firstRun = runs.find(r => r.id === selectedRunIds[0]);
        if (firstRun?.photos && firstRun.photos.length > 0) {
          coverPhoto = firstRun.photos[0];
        }
      }

      await addDoc(collection(db, 'collections'), {
        userId: user.uid,
        name: collectionName,
        description: collectionDescription,
        coverPhoto,
        runIds: selectedRunIds,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      showToast('컬렉션이 생성되었습니다.');
      setShowCreateModal(false);
      setCollectionName('');
      setCollectionDescription('');
      setSelectedRunIds([]);
      loadCollections();
    } catch (error) {
      console.error('컬렉션 생성 실패:', error);
      if (error.code === 'permission-denied' || error.message.includes('permissions')) {
        showToast('Firestore 규칙을 확인해주세요. 컬렉션 권한이 필요합니다.', 'error');
      } else {
        showToast('컬렉션 생성에 실패했습니다.', 'error');
      }
    }
  };

  const handleEditCollection = async () => {
    if (!collectionName.trim()) {
      showToast('컬렉션 이름을 입력해주세요.', 'error');
      return;
    }

    try {
      // 대표 사진 업데이트
      let coverPhoto = selectedCollection.coverPhoto;
      if (selectedRunIds.length > 0) {
        const firstRun = runs.find(r => r.id === selectedRunIds[0]);
        if (firstRun?.photos && firstRun.photos.length > 0) {
          coverPhoto = firstRun.photos[0];
        }
      }

      await updateDoc(doc(db, 'collections', selectedCollection.id), {
        name: collectionName,
        description: collectionDescription,
        coverPhoto,
        runIds: selectedRunIds,
        updatedAt: Timestamp.now()
      });

      showToast('컬렉션이 수정되었습니다.');
      setShowEditModal(false);
      setSelectedCollection(null);
      setCollectionName('');
      setCollectionDescription('');
      setSelectedRunIds([]);
      loadCollections();
    } catch (error) {
      console.error('컬렉션 수정 실패:', error);
      showToast('컬렉션 수정에 실패했습니다.', 'error');
    }
  };

  const handleDeleteCollection = async (collectionId) => {
    if (!confirm('이 컬렉션을 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'collections', collectionId));
      showToast('컬렉션이 삭제되었습니다.');
      loadCollections();
    } catch (error) {
      console.error('컬렉션 삭제 실패:', error);
      showToast('컬렉션 삭제에 실패했습니다.', 'error');
    }
  };

  const openEditModal = (collection) => {
    setSelectedCollection(collection);
    setCollectionName(collection.name);
    setCollectionDescription(collection.description || '');
    setSelectedRunIds(collection.runIds || []);
    setShowEditModal(true);
  };

  const toggleRunSelection = (runId) => {
    setSelectedRunIds(prev => 
      prev.includes(runId) 
        ? prev.filter(id => id !== runId)
        : [...prev, runId]
    );
  };

  const getCollectionRuns = (runIds) => {
    return runs.filter(run => runIds.includes(run.id));
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-navy-700 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-navy-900">📚 컬렉션</h2>
          <button
            onClick={() => {
              setCollectionName('');
              setCollectionDescription('');
              setSelectedRunIds([]);
              setShowCreateModal(true);
            }}
            className="px-4 py-2 bg-navy-700 text-white text-sm font-semibold rounded-lg hover:bg-navy-800 transition-colors"
          >
            + 새 컬렉션
          </button>
        </div>

        {collections.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">📚</div>
            <h3 className="text-lg font-bold text-navy-900 mb-2">컬렉션이 없습니다</h3>
            <p className="text-sm text-navy-600 mb-4">기록을 모아서 컬렉션을 만들어보세요!</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-navy-700 text-white text-sm font-semibold rounded-lg hover:bg-navy-800 transition-colors"
            >
              첫 컬렉션 만들기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {collections.map(collection => {
              const collectionRuns = getCollectionRuns(collection.runIds || []);
              return (
                <div
                  key={collection.id}
                  className="relative bg-navy-50 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => openEditModal(collection)}
                >
                  {collection.coverPhoto ? (
                    <img
                      src={collection.coverPhoto}
                      alt={collection.name}
                      className="w-full aspect-square object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-gradient-to-br from-navy-200 to-navy-300 flex items-center justify-center">
                      <span className="text-4xl">📚</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <h3 className="text-white font-bold text-sm mb-1 truncate">{collection.name}</h3>
                      <p className="text-white text-xs opacity-90">{collectionRuns.length}개 기록</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCollection(collection.id);
                    }}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 컬렉션 생성 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-navy-100 sticky top-0 bg-white z-10">
              <h2 className="text-xl sm:text-2xl font-bold text-navy-900">새 컬렉션</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-navy-400 hover:text-navy-600 transition-colors p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">컬렉션 이름</label>
                <input
                  type="text"
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none"
                  placeholder="예: 해외 러닝 모음"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">설명 (선택)</label>
                <textarea
                  value={collectionDescription}
                  onChange={(e) => setCollectionDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none"
                  rows="3"
                  placeholder="컬렉션에 대한 설명을 입력하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">기록 선택</label>
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {runs.map(run => (
                    <button
                      key={run.id}
                      type="button"
                      onClick={() => toggleRunSelection(run.id)}
                      className={`p-2 rounded-lg border-2 transition-colors text-left ${
                        selectedRunIds.includes(run.id)
                          ? 'border-navy-700 bg-navy-100'
                          : 'border-navy-200 hover:border-navy-300'
                      }`}
                    >
                      <div className="text-xs font-semibold text-navy-900 truncate">
                        {run.runType === 'race' ? run.raceName : run.location}
                      </div>
                      <div className="text-xs text-navy-600">{formatDate(run.date)}</div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCreateCollection}
                className="w-full bg-navy-700 text-white font-semibold py-3 rounded-lg hover:bg-navy-800 transition-colors"
              >
                생성
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 컬렉션 수정 모달 */}
      {showEditModal && selectedCollection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-navy-100 sticky top-0 bg-white z-10">
              <h2 className="text-xl sm:text-2xl font-bold text-navy-900">컬렉션 수정</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedCollection(null);
                }}
                className="text-navy-400 hover:text-navy-600 transition-colors p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">컬렉션 이름</label>
                <input
                  type="text"
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">설명 (선택)</label>
                <textarea
                  value={collectionDescription}
                  onChange={(e) => setCollectionDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none"
                  rows="3"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">기록 선택</label>
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {runs.map(run => (
                    <button
                      key={run.id}
                      type="button"
                      onClick={() => toggleRunSelection(run.id)}
                      className={`p-2 rounded-lg border-2 transition-colors text-left ${
                        selectedRunIds.includes(run.id)
                          ? 'border-navy-700 bg-navy-100'
                          : 'border-navy-200 hover:border-navy-300'
                      }`}
                    >
                      <div className="text-xs font-semibold text-navy-900 truncate">
                        {run.runType === 'race' ? run.raceName : run.location}
                      </div>
                      <div className="text-xs text-navy-600">{formatDate(run.date)}</div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleEditCollection}
                className="w-full bg-navy-700 text-white font-semibold py-3 rounded-lg hover:bg-navy-800 transition-colors"
              >
                수정 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Collections;
