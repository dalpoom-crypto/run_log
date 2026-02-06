import { useState, useEffect } from 'react';
import { db, doc, deleteDoc, Timestamp, collection, query, where, getDocs, addDoc, onSnapshot, getDoc, updateDoc } from '../config/firebase';
import { formatTime, formatDate } from '../utils/formatters';
import { showToast } from '../utils/toast';
import { shortenUrl, getPostUrl } from '../utils/shortUrl';

const RunDetailModal = ({ run, onClose, onDelete, onEdit, currentUser }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [likes, setLikes] = useState([]);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentCount, setCommentCount] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [isPrivateComment, setIsPrivateComment] = useState(false);
  const [isPrivateReply, setIsPrivateReply] = useState(false);
  const [commentAuthors, setCommentAuthors] = useState({});
  const [author, setAuthor] = useState(null); // 게시글 작성자 정보

  const minSwipeDistance = 50;

  // 작성자 정보 로드
  useEffect(() => {
    if (!run?.userId) return;

    const loadAuthor = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', run.userId));
        if (userDoc.exists()) {
          setAuthor(userDoc.data());
        }
      } catch (error) {
        console.error('작성자 정보 로드 실패:', error);
      }
    };

    loadAuthor();
  }, [run?.userId]);

  // run이 없으면 모달을 닫음
  if (!run) {
    return null;
  }

  // 좋아요 데이터 로드
  useEffect(() => {
    if (!run?.id || !currentUser) return;

    const likesQuery = query(
      collection(db, 'likes'),
      where('runId', '==', run.id)
    );

    const unsubscribe = onSnapshot(likesQuery, (snapshot) => {
      const likesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLikes(likesData);
      setLikeCount(likesData.length);
      setIsLiked(likesData.some(like => like.userId === currentUser.uid));
    });

    return () => unsubscribe();
  }, [run?.id, currentUser]);

  // 댓글 개수 실시간 추적
  useEffect(() => {
    if (!run?.id) return;

    const commentsQuery = query(
      collection(db, 'comments'),
      where('runId', '==', run.id)
    );

    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      const parentComments = commentsData.filter(c => !c.parentCommentId);
      setCommentCount(parentComments.length);
    }, (error) => {
      console.error('댓글 개수 로드 실패:', error);
    });

    return () => unsubscribe();
  }, [run?.id]);

  // 댓글 데이터 로드
  useEffect(() => {
    if (!run?.id || !showComments) {
      setComments([]);
      setCommentAuthors({});
      return;
    }

    const commentsQuery = query(
      collection(db, 'comments'),
      where('runId', '==', run.id)
    );

    const unsubscribe = onSnapshot(commentsQuery, async (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      commentsData.sort((a, b) => {
        const getTime = (comment) => {
          if (!comment.createdAt) return 0;
          if (comment.createdAt?.toDate) return comment.createdAt.toDate().getTime();
          if (comment.createdAt?.seconds) return comment.createdAt.seconds * 1000;
          if (comment.createdAt?._seconds) return comment.createdAt._seconds * 1000;
          return 0;
        };
        return getTime(a) - getTime(b);
      });
      
      const userIds = [...new Set(commentsData.map(c => c.userId))];
      const authorsData = {};
      
      await Promise.all(
        userIds.map(async (userId) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
              authorsData[userId] = userDoc.data();
            }
          } catch (error) {
            console.error(`댓글 작성자 정보 로드 실패: ${userId}`, error);
          }
        })
      );
      
      setCommentAuthors(authorsData);
      setComments(commentsData);
    }, (error) => {
      console.error('댓글 로드 실패:', error);
      showToast('댓글을 불러오는데 실패했습니다.', 'error');
    });

    return () => unsubscribe();
  }, [run?.id, showComments]);

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      goToNext();
    }
    if (isRightSwipe) {
      goToPrevious();
    }
  };

  const goToPrevious = () => {
    if (!run?.photos || run.photos.length === 0) return;
    setCurrentImageIndex((prev) => (prev === 0 ? run.photos.length - 1 : prev - 1));
  };

  const goToNext = () => {
    if (!run?.photos || run.photos.length === 0) return;
    setCurrentImageIndex((prev) => (prev === run.photos.length - 1 ? 0 : prev + 1));
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'runs', run.id));
      onDelete();
      onClose();
    } catch (error) {
      console.error('삭제 실패:', error);
      showToast('기록 삭제에 실패했습니다.', 'error');
    }
  };

  const handleShare = async () => {
    if (!run?.id) return;
    
    const longUrl = getPostUrl(run.id);
    const authorName = author?.nickname || '익명';
    const shareText = `${authorName}의 러닝 기록을 확인해보세요!`;
    
    // URL 단축
    showToast('링크 생성 중...', 'info');
    const shortUrl = await shortenUrl(longUrl);
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'RunLog 게시글',
          text: shareText,
          url: shortUrl
        });
      } catch (err) {
        // 사용자가 공유를 취소한 경우는 무시
        if (err.name !== 'AbortError') {
          console.error('공유 실패:', err);
          showToast('공유에 실패했습니다.', 'error');
        }
      }
    } else {
      // navigator.share를 지원하지 않는 경우 클립보드에 복사
      try {
        await navigator.clipboard.writeText(shortUrl);
        showToast('짧은 링크가 클립보드에 복사되었습니다.');
      } catch (err) {
        // 클립보드 복사 실패 시 URL을 직접 표시
        if (window.prompt('게시글 링크를 복사하세요:', shortUrl)) {
          showToast('링크가 복사되었습니다.');
        }
      }
    }
  };

  // 좋아요 토글
  const handleLike = async () => {
    if (!currentUser) return;

    try {
      if (isLiked) {
        const likeDoc = likes.find(like => like.userId === currentUser.uid);
        if (likeDoc) {
          await deleteDoc(doc(db, 'likes', likeDoc.id));
        }
      } else {
        await addDoc(collection(db, 'likes'), {
          runId: run.id,
          userId: currentUser.uid,
          createdAt: Timestamp.now()
        });
      }
    } catch (error) {
      console.error('좋아요 처리 실패:', error);
      showToast('좋아요 처리에 실패했습니다.', 'error');
    }
  };

  // 댓글 작성
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    const textToSubmit = replyingTo ? replyText : commentText;
    const isPrivate = replyingTo ? isPrivateReply : isPrivateComment;
    if (!textToSubmit.trim() || !currentUser || submittingComment) return;

    setSubmittingComment(true);
    try {
      const commentData = {
        runId: run.id,
        runOwnerId: run.userId,
        userId: currentUser.uid,
        authorNickname: currentUser.displayName || '익명',
        text: textToSubmit.trim(),
        createdAt: Timestamp.now(),
        isPrivate: isPrivate,
        isHidden: false,
        parentCommentId: replyingTo || null,
      };
      await addDoc(collection(db, 'comments'), commentData);
      setCommentText('');
      setReplyText('');
      setReplyingTo(null);
      setIsPrivateComment(false);
      setIsPrivateReply(false);
    } catch (error) {
      console.error('댓글 작성 실패:', error);
      showToast('댓글 작성에 실패했습니다.', 'error');
    } finally {
      setSubmittingComment(false);
    }
  };

  // 댓글 숨기기/보이기 토글
  const handleToggleCommentVisibility = async (commentId, currentVisibility) => {
    if (!currentUser) return;
    
    try {
      const commentRef = doc(db, 'comments', commentId);
      await updateDoc(commentRef, {
        isHidden: !currentVisibility
      });
    } catch (error) {
      console.error('댓글 숨기기 실패:', error);
      showToast('댓글 숨기기에 실패했습니다.', 'error');
    }
  };

  const getDistanceLabel = () => {
    if (!run) return '';
    if (run.raceType === 'HALF') return 'HALF';
    if (run.raceType === 'FULL') return 'FULL';
    return `${run.distance || 0}km`;
  };

  // 기존 데이터 호환: runType이 없으면 location이 있으면 casual, raceName이 있으면 race로 판단
  const getRunType = () => {
    if (run?.runType) return run.runType;
    if (run?.raceName) return 'race';
    if (run?.location) return 'casual';
    return 'casual'; // 기본값
  };

  const getTitle = () => {
    const runType = getRunType();
    if (runType === 'race') {
      return run?.raceName || run?.location || '';
    } else {
      return run?.location || run?.raceName || '';
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
      <div className="min-h-screen flex flex-col">
        <div className="sticky top-0 bg-white border-b border-navy-100 z-10 shadow-sm">
          <div className="flex items-center justify-between p-3 sm:p-4">
            <button onClick={onClose} className="text-navy-900 p-1 -ml-1">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-base sm:text-lg font-bold text-navy-900 absolute left-1/2 transform -translate-x-1/2">게시물</h2>
            {/* 더보기 버튼은 게시글 소유자일 때만 표시, 없을 때는 빈 공간 유지 */}
            <div className="relative">
              {currentUser && run.userId === currentUser.uid ? (
                <>
                  <button onClick={() => setShowMenu(!showMenu)} className="text-navy-900 p-1 -mr-1">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                  {showMenu && (
                    <div className="absolute right-0 top-10 bg-white rounded-lg shadow-lg border border-navy-200 py-2 w-32 z-20">
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          onEdit(run);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-navy-700 hover:bg-navy-50 transition-colors"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setShowDeleteConfirm(true);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-8 h-8"></div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white max-w-4xl mx-auto pb-20 sm:pb-24">
          {run.photos && run.photos.length > 0 && (
            <div className="w-full">
              <div 
                className="relative w-full"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                <img
                  src={run.photos[currentImageIndex]}
                  alt="Run"
                  className="w-full h-auto object-contain"
                />
                
                {run.photos.length > 1 && (
                  <>
                    {currentImageIndex > 0 && (
                      <button
                        className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 text-navy-900 w-8 h-8 rounded-full items-center justify-center hover:bg-opacity-100 transition-all shadow-md"
                        onClick={goToPrevious}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                    )}
                    
                    {currentImageIndex < run.photos.length - 1 && (
                      <button
                        className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 text-navy-900 w-8 h-8 rounded-full items-center justify-center hover:bg-opacity-100 transition-all shadow-md"
                        onClick={goToNext}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {run.photos.map((_, idx) => (
                        <div
                          key={idx}
                          className={`w-1.5 h-1.5 rounded-full transition-all ${
                            idx === currentImageIndex ? 'bg-navy-700 w-6' : 'bg-navy-300'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 좋아요, 댓글, 공유, 스크랩 버튼 */}
          <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-navy-100">
            <button 
              className={`flex items-center gap-1.5 transition-opacity p-1 touch-manipulation ${
                isLiked ? 'opacity-100' : 'hover:opacity-60 active:opacity-80'
              }`}
              onClick={handleLike}
              style={{ height: '28px' }}
            >
              {isLiked ? (
                <span className="text-xl sm:text-2xl text-orange-500 transition-all leading-none">
                  🔥
                </span>
              ) : (
                <span 
                  className="text-sm sm:text-base transition-all relative leading-none"
                  style={{ 
                    filter: 'grayscale(100%) opacity(0.4)',
                    textShadow: `
                      -1px -1px 0 #000,
                      1px -1px 0 #000,
                      -1px 1px 0 #000,
                      1px 1px 0 #000,
                      -2px -2px 0 #000,
                      2px -2px 0 #000,
                      -2px 2px 0 #000,
                      2px 2px 0 #000
                    `
                  }}
                >
                  🔥
                </span>
              )}
              {likeCount > 0 && (
                <span className={`text-xs sm:text-sm font-semibold ${isLiked ? 'text-orange-500' : 'text-navy-400'}`}>
                  {likeCount}
                </span>
              )}
            </button>
            <button 
              className="flex items-center gap-1.5 hover:opacity-60 active:opacity-80 transition-opacity p-1 touch-manipulation text-navy-400"
              onClick={() => setShowComments(!showComments)}
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {commentCount > 0 && (
                <span className="text-xs sm:text-sm font-semibold text-navy-400">
                  {commentCount}
                </span>
              )}
            </button>
            <button onClick={handleShare} className="hover:opacity-60 active:opacity-80 transition-opacity p-1 touch-manipulation text-navy-400">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
            <button className="ml-auto hover:opacity-60 active:opacity-80 transition-opacity p-1 touch-manipulation text-navy-400">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
          </div>

          <div className="px-3 sm:px-4 py-4 sm:py-5">
            <div className="mb-4 sm:mb-5">
              <span className="font-bold text-navy-900 text-base sm:text-lg">
                {getTitle()}
              </span>
            </div>

            <div className="mb-4 sm:mb-5">
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <div className="text-3xl sm:text-4xl font-bold text-navy-900">
                  {run?.time ? formatTime(run.time) : '--:--'}
                </div>
                {/* 기록증/지도 보기 버튼 */}
                <div className="flex items-center gap-2">
                  {getRunType() === 'race' && run?.certificateURL ? (
                    <button
                      onClick={() => {
                        window.open(run.certificateURL, '_blank');
                      }}
                      className="px-2 sm:px-3 py-1 sm:py-1.5 bg-navy-100 text-navy-700 text-xs sm:text-sm font-semibold rounded-lg hover:bg-navy-200 transition-colors flex items-center gap-1"
                      title="기록증 보기"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      기록증
                    </button>
                  ) : run?.mapURL ? (
                    <button
                      onClick={() => {
                        window.open(run.mapURL, '_blank');
                      }}
                      className="px-2 sm:px-3 py-1 sm:py-1.5 bg-navy-100 text-navy-700 text-xs sm:text-sm font-semibold rounded-lg hover:bg-navy-200 transition-colors flex items-center gap-1"
                      title="지도 보기"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      지도
                    </button>
                  ) : null}
                  {/* 기록증과 지도가 모두 있는 경우 지도도 표시 */}
                  {getRunType() === 'race' && run?.certificateURL && run?.mapURL && (
                    <button
                      onClick={() => {
                        window.open(run.mapURL, '_blank');
                      }}
                      className="px-2 sm:px-3 py-1 sm:py-1.5 bg-navy-100 text-navy-700 text-xs sm:text-sm font-semibold rounded-lg hover:bg-navy-200 transition-colors flex items-center gap-1"
                      title="지도 보기"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      지도
                    </button>
                  )}
                </div>
              </div>
              <div className="text-xs sm:text-sm text-navy-600">
                {getDistanceLabel()} · {run?.date ? formatDate(run.date) : ''}
              </div>
            </div>

            {(() => {
              const memoText = run?.memo || run?.note || run?.description || '';
              const hasMemo = memoText && typeof memoText === 'string' && memoText.trim().length > 0;
              
              if (hasMemo) {
                return (
                  <div className="memo-text text-sm sm:text-base text-navy-700 mb-5 leading-relaxed">
                    {memoText}
                  </div>
                );
              }
              return null;
            })()}

            {/* 작성일시 표시 */}
            <div className="mt-6 pt-4 pb-6 sm:pb-8 border-t border-navy-200">
              <div className="text-xs sm:text-sm text-navy-500">
                {(() => {
                  let dateStr = '';

                  // 1) createdAt 기준으로 표시 (시·분 포함)
                  try {
                    if (run?.createdAt) {
                      let date = null;

                      if (run.createdAt && typeof run.createdAt.toDate === 'function') {
                        date = run.createdAt.toDate();
                      } else if (run.createdAt instanceof Timestamp) {
                        date = run.createdAt.toDate();
                      } else if (run.createdAt.seconds && typeof run.createdAt.seconds === 'number') {
                        date = new Date(run.createdAt.seconds * 1000);
                      } else if (run.createdAt._seconds && typeof run.createdAt._seconds === 'number') {
                        date = new Date(run.createdAt._seconds * 1000);
                      } else if (run.createdAt instanceof Date) {
                        date = run.createdAt;
                      } else if (typeof run.createdAt === 'number') {
                        date = new Date(run.createdAt);
                      } else if (typeof run.createdAt === 'string') {
                        date = new Date(run.createdAt);
                      }

                      if (date && !isNaN(date.getTime())) {
                        dateStr = date.toLocaleString('ko-KR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                      }
                    }
                  } catch (e) {
                    // createdAt 파싱 실패 시 조용히 넘어감
                  }

                  // 2) createdAt이 없거나 실패한 경우 date 필드 사용 (기존 데이터 호환)
                  if (!dateStr && run?.date) {
                    let date = null;

                    // a) 먼저 기본 Date 파싱 시도
                    const direct = new Date(run.date);
                    if (!isNaN(direct.getTime())) {
                      date = direct;
                    } else if (typeof run.date === 'string') {
                      // b) 'YYYY.MM.DD' 같은 옛 포맷 처리
                      const cleaned = run.date.replace(/\./g, '-').replace(/\s/g, '');
                      const parts = cleaned.split('-');
                      if (parts.length >= 3) {
                        const [y, m, d] = parts;
                        const parsed = new Date(
                          parseInt(y, 10),
                          parseInt(m, 10) - 1,
                          parseInt(d, 10)
                        );
                        if (!isNaN(parsed.getTime())) {
                          date = parsed;
                        }
                      }
                    }

                    if (date && !isNaN(date.getTime())) {
                      dateStr = date.toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      });
                    }
                  }

                  return dateStr ? `${dateStr} 게시` : '알 수 없음';
                })()}
              </div>
            </div>

            {/* 댓글 섹션 */}
            {showComments && (
              <div className="mt-4 pt-4 border-t border-navy-200">
                {/* 댓글 목록 */}
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                  {comments.filter(c => !c.parentCommentId).length === 0 ? (
                    <p className="text-xs sm:text-sm text-navy-500 text-center py-4">
                      첫 댓글을 남겨보세요!
                    </p>
                  ) : (
                    comments
                      .filter(comment => !comment.parentCommentId)
                      .map((comment) => {
                        const commentAuthor = commentAuthors[comment.userId];
                        const canViewPrivate = !comment.isPrivate || (
                          currentUser?.uid === comment.userId || 
                          currentUser?.uid === run.userId
                        );
                        const isHidden = comment.isHidden && currentUser?.uid !== comment.userId && currentUser?.uid !== run.userId;
                        
                        return (
                          <div key={comment.id} className="space-y-2">
                            <div className="flex gap-2">
                              <div className="flex-1 bg-navy-50 rounded-lg p-2 sm:p-3">
                                <div className="flex items-center gap-2 mb-1">
                              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-2xl bg-navy-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                    {commentAuthor?.photoURL ? (
                                      <img 
                                        src={commentAuthor.photoURL} 
                                        alt={comment.authorNickname || 'User'} 
                                        className="w-full h-full object-cover" 
                                      />
                                    ) : (
                                      <span className="text-navy-600 text-xs font-semibold">
                                        {comment.authorNickname?.[0]?.toUpperCase() || '?'}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs sm:text-sm font-semibold text-navy-900">
                                    {comment.authorNickname || '익명'}
                                  </span>
                                  <span className="text-[10px] sm:text-xs text-navy-400">
                                    {comment.createdAt?.toDate ? 
                                      new Date(comment.createdAt.toDate()).toLocaleDateString('ko-KR', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      }) : ''}
                                  </span>
                                </div>
                                {isHidden ? (
                                  <p className="text-xs sm:text-sm text-navy-400 italic">
                                    비밀 댓글입니다.
                                  </p>
                                ) : comment.isPrivate && !canViewPrivate ? (
                                  <p className="text-xs sm:text-sm text-navy-400 italic">
                                    비밀 댓글입니다.
                                  </p>
                                ) : (
                                  <p className="text-xs sm:text-sm text-navy-700 whitespace-pre-wrap break-words flex items-start gap-1.5">
                                    {comment.isPrivate && (
                                      <svg className="w-3 h-3 sm:w-4 sm:h-4 text-navy-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                      </svg>
                                    )}
                                    <span>{comment.text}</span>
                                  </p>
                                )}
                                
                                {/* 답글 쓰기, 숨기기 버튼 */}
                                <div className="flex items-center gap-2 mt-2">
                                  {(currentUser?.uid === run.userId || currentUser?.uid === comment.userId) && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setReplyingTo(replyingTo === comment.id ? null : comment.id);
                                        setReplyText('');
                                      }}
                                      className="text-[10px] sm:text-xs text-navy-500 hover:text-navy-700 transition-colors"
                                    >
                                      답글 쓰기
                                    </button>
                                  )}
                                  {currentUser?.uid === comment.userId && !comment.isPrivate && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleCommentVisibility(comment.id, comment.isHidden);
                                      }}
                                      className="text-[10px] sm:text-xs text-navy-500 hover:text-navy-700 transition-colors"
                                    >
                                      {comment.isHidden ? '보이기' : '숨기기'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* 답글 작성 폼 */}
                            {replyingTo === comment.id && (
                              <form onSubmit={handleCommentSubmit} className="ml-4 flex gap-2">
                                <input
                                  type="text"
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  placeholder="답글을 입력하세요..."
                                  className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none text-xs sm:text-sm"
                                  disabled={submittingComment}
                                />
                                <button
                                  type="button"
                                  onClick={() => setIsPrivateReply(!isPrivateReply)}
                                  className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border-2 transition-colors touch-manipulation ${
                                    isPrivateReply 
                                      ? 'bg-navy-700 text-white border-navy-700' 
                                      : 'bg-white text-navy-600 border-navy-200 hover:bg-navy-50'
                                  }`}
                                  title={isPrivateReply ? '비밀 답글 해제' : '비밀 답글 (답글 작성자와 피드 주인만 볼 수 있습니다)'}
                                >
                                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                </button>
                                <button
                                  type="submit"
                                  disabled={!replyText.trim() || submittingComment}
                                  className="px-2 sm:px-3 py-1.5 sm:py-2 bg-navy-700 text-white rounded-lg font-semibold text-xs sm:text-sm hover:bg-navy-800 active:bg-navy-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                                >
                                  {submittingComment ? '등록 중...' : '등록'}
                                </button>
                              </form>
                            )}
                            
                            {/* 답글 목록 */}
                            {comments
                              .filter(reply => reply.parentCommentId === comment.id)
                              .map((reply) => {
                                const replyAuthor = commentAuthors[reply.userId];
                                const canViewReplyPrivate = !reply.isPrivate || (
                                  currentUser?.uid === reply.userId || 
                                  currentUser?.uid === run.userId
                                );
                                const isReplyHidden = reply.isHidden && currentUser?.uid !== reply.userId && currentUser?.uid !== run.userId;
                                
                                return (
                                  <div key={reply.id} className="mt-2 ml-4 pl-3 border-l-2 border-navy-200">
                                    <div className="flex items-center gap-2 mb-1">
                                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-2xl bg-navy-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                        {replyAuthor?.photoURL ? (
                                          <img 
                                            src={replyAuthor.photoURL} 
                                            alt={reply.authorNickname || 'User'} 
                                            className="w-full h-full object-cover" 
                                          />
                                        ) : (
                                          <span className="text-navy-600 text-[10px] font-semibold">
                                            {reply.authorNickname?.[0]?.toUpperCase() || '?'}
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[10px] sm:text-xs font-semibold text-navy-900">
                                        {reply.authorNickname || '익명'}
                                      </span>
                                      <span className="text-[9px] sm:text-[10px] text-navy-400">
                                        {reply.createdAt?.toDate ? 
                                          new Date(reply.createdAt.toDate()).toLocaleDateString('ko-KR', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          }) : ''}
                                      </span>
                                    </div>
                                    {isReplyHidden ? (
                                      <p className="text-[10px] sm:text-xs text-navy-400 italic">
                                        비밀 댓글입니다.
                                      </p>
                                    ) : reply.isPrivate && !canViewReplyPrivate ? (
                                      <p className="text-[10px] sm:text-xs text-navy-400 italic">
                                        비밀 댓글입니다.
                                      </p>
                                    ) : (
                                      <p className="text-[10px] sm:text-xs text-navy-700 whitespace-pre-wrap break-words flex items-start gap-1.5">
                                        {reply.isPrivate && (
                                          <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-navy-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                          </svg>
                                        )}
                                        <span>{reply.text}</span>
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        );
                      })
                  )}
                </div>

                {/* 댓글 작성 폼 */}
                <form onSubmit={handleCommentSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="댓글을 입력하세요..."
                    className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none text-xs sm:text-sm"
                    disabled={submittingComment}
                  />
                  <button
                    type="button"
                    onClick={() => setIsPrivateComment(!isPrivateComment)}
                    className={`px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg border-2 transition-colors touch-manipulation ${
                      isPrivateComment 
                        ? 'bg-navy-700 text-white border-navy-700' 
                        : 'bg-white text-navy-600 border-navy-200 hover:bg-navy-50'
                    }`}
                    title={isPrivateComment ? '비밀 댓글 해제' : '비밀 댓글 (댓글 작성자와 피드 주인만 볼 수 있습니다)'}
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </button>
                  <button
                    type="submit"
                    disabled={!commentText.trim() || submittingComment}
                    className="px-3 sm:px-4 py-2 sm:py-2.5 bg-navy-700 text-white rounded-lg font-semibold text-xs sm:text-sm hover:bg-navy-800 active:bg-navy-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                  >
                    {submittingComment ? '등록 중...' : '등록'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm modal-content">
            <h3 className="text-lg font-bold text-navy-900 mb-2">기록 삭제</h3>
            <p className="text-navy-600 mb-4 text-sm">이 기록을 정말 삭제하시겠습니까?</p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition-colors text-sm font-semibold"
              >
                삭제
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-navy-100 text-navy-700 py-2 rounded-lg hover:bg-navy-200 transition-colors text-sm font-semibold"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RunDetailModal;
