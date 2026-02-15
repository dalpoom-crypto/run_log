import { useState, useEffect } from 'react';
import { formatTime, formatDate, formatDateTime } from '../utils/formatters';
import { Timestamp, db, collection, doc, setDoc, deleteDoc, getDoc, query, where, getDocs, addDoc, onSnapshot, orderBy } from '../config/firebase';
import { showToast } from '../utils/toast';
import { shortenUrl, getPostUrl } from '../utils/shortUrl';
import { createNotification } from '../utils/notifications';

const FeedCard = ({ run, author, onExpand, isExpanded, currentUser, onNicknameClick, compactOverlay = false }) => {
  const [showFullMemo, setShowFullMemo] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [showUnfollowSheet, setShowUnfollowSheet] = useState(false);
  const [likes, setLikes] = useState([]);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentCount, setCommentCount] = useState(0); // 댓글 개수 (항상 추적)
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); // 답글 작성 중인 댓글 ID
  const [replyText, setReplyText] = useState(''); // 답글 텍스트
  const [isPrivateComment, setIsPrivateComment] = useState(false); // 비밀 댓글 여부
  const [isPrivateReply, setIsPrivateReply] = useState(false); // 답글 비밀 여부
  const [commentAuthors, setCommentAuthors] = useState({}); // 댓글 작성자 정보
  const [isScrapped, setIsScrapped] = useState(false); // 스크랩 여부

  // run이 변경될 때 사진 인덱스 초기화
  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [run.id]);
  
  const getDistanceLabel = () => {
    if (run.raceType === 'HALF') return 'HALF';
    if (run.raceType === 'FULL') return 'FULL';
    return `${run.distance}km`;
  };

  // 해외/국내에 따른 장소 표시
  const getLocationLabel = () => {
    if (run.isOverseas) {
      const parts = [run.country, run.city, run.place].filter(Boolean);
      if (parts.length > 0) return parts.join(' ');
    }
    return run.runType === 'race' ? (run.raceName || '') : (run.location || '');
  };

  const memo = run.memo || '';
  const hasMemo = memo.trim().length > 0;
  const shouldTruncateMemo = memo.length > 100;
  const displayMemo = isExpanded || !shouldTruncateMemo ? memo : memo.substring(0, 100) + '...';

  // 작성일시 포맷팅
  const getCreatedAtString = () => {
    if (!run.createdAt) return '';
    
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
    
    if (!date || isNaN(date.getTime())) return '';
    
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const photos = run.photos || [];
  const hasMultiplePhotos = photos.length > 1;

  // 오버레이 텍스트 크기 (홈 피드 vs 내 피드)
  // compactOverlay=true => 내 피드용 (모바일에서 더 작게)
  const locationTextClass = compactOverlay
    ? 'text-[10px] sm:text-xl'
    : 'text-base sm:text-2xl';
  const timeTextClass = compactOverlay
    ? 'text-base sm:text-5xl'
    : 'text-4xl sm:text-6xl';
  const distanceTextClass = compactOverlay
    ? 'text-[10px] sm:text-lg'
    : 'text-base sm:text-xl';
  const dateTextClass = compactOverlay
    ? 'text-[10px] sm:text-base'
    : 'text-base sm:text-lg';

  // 하단 정보 텍스트 크기 (홈 피드 vs 내 피드)
  const bottomMainTextClass = compactOverlay
    ? 'text-xs sm:text-sm'           // 내 피드용: 한 단계 작게
    : 'text-sm sm:text-base';        // 홈 피드용: 전체적으로 더 키움
  const bottomSubTextClass = compactOverlay
    ? 'text-[11px] sm:text-sm'       // 보조 정보: 살짝 키움
    : 'text-xs sm:text-sm';          // 홈 피드 보조 정보도 한 단계 키움

  const multiIconContainerClass = compactOverlay ? 'w-5 h-5' : 'w-7 h-7';
  const multiIconRectClass = compactOverlay ? 'w-4 h-4' : 'w-5 h-5';

  // 좋아요 데이터 로드
  useEffect(() => {
    if (!run.id || !currentUser) return;

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
  }, [run.id, currentUser]);

  // 스크랩 상태 확인
  useEffect(() => {
    if (!run.id || !currentUser) {
      setIsScrapped(false);
      return;
    }

    const checkScrap = async () => {
      try {
        const scrapQuery = query(
          collection(db, 'scraps'),
          where('userId', '==', currentUser.uid),
          where('runId', '==', run.id)
        );
        const snapshot = await getDocs(scrapQuery);
        setIsScrapped(!snapshot.empty);
      } catch (error) {
        console.error('스크랩 상태 확인 실패:', error);
      }
    };

    checkScrap();
  }, [run.id, currentUser]);

  // 댓글 개수 실시간 추적 (항상 실행)
  useEffect(() => {
    if (!run.id) return;

    const commentsQuery = query(
      collection(db, 'comments'),
      where('runId', '==', run.id)
    );

    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // 부모 댓글만 카운트 (답글 제외)
      const parentComments = commentsData.filter(c => !c.parentCommentId);
      setCommentCount(parentComments.length);
    }, (error) => {
      console.error('댓글 개수 로드 실패:', error);
    });

    return () => unsubscribe();
  }, [run.id]);

  // 댓글 데이터 로드 (댓글 섹션이 열렸을 때만)
  useEffect(() => {
    if (!run.id || !showComments) {
      setComments([]);
      setCommentAuthors({});
      return;
    }

    // 인덱스 문제를 피하기 위해 orderBy 없이 가져온 후 클라이언트에서 정렬
    const commentsQuery = query(
      collection(db, 'comments'),
      where('runId', '==', run.id)
    );

    const unsubscribe = onSnapshot(commentsQuery, async (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // 클라이언트에서 시간순 정렬
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
      
      // 댓글 작성자 정보 가져오기
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
  }, [run.id, showComments]);

  // 좋아요 토글
  const handleLike = async () => {
    if (!currentUser) return;

    try {
      if (isLiked) {
        // 좋아요 제거
        const likeDoc = likes.find(like => like.userId === currentUser.uid);
        if (likeDoc) {
          await deleteDoc(doc(db, 'likes', likeDoc.id));
        }
      } else {
        // 좋아요 추가
        await addDoc(collection(db, 'likes'), {
          runId: run.id,
          userId: currentUser.uid,
          createdAt: Timestamp.now()
        });
        
        // 알림 생성 (자신의 글에 좋아요가 아닌 경우만)
        if (run.userId !== currentUser.uid) {
          await createNotification(run.userId, 'like', {
            fromUserId: currentUser.uid,
            fromUserNickname: currentUser.userData?.nickname || currentUser.displayName || '익명',
            runId: run.id,
          });
        }
      }
    } catch (error) {
      console.error('좋아요 처리 실패:', error);
      showToast('좋아요 처리에 실패했습니다.', 'error');
    }
  };

  // 스크랩 토글
  const handleScrap = async () => {
    if (!currentUser) return;

    try {
      if (isScrapped) {
        // 스크랩 제거
        const scrapQuery = query(
          collection(db, 'scraps'),
          where('userId', '==', currentUser.uid),
          where('runId', '==', run.id)
        );
        const snapshot = await getDocs(scrapQuery);
        if (!snapshot.empty) {
          await deleteDoc(snapshot.docs[0].ref);
          showToast('스크랩을 취소했습니다.');
        }
      } else {
        // 스크랩 추가
        await addDoc(collection(db, 'scraps'), {
          runId: run.id,
          userId: currentUser.uid,
          authorId: run.userId,
          authorNickname: author?.nickname || author?.displayName || '',
          runData: {
            ...run,
            createdAt: run.createdAt || Timestamp.now()
          },
          createdAt: Timestamp.now()
        });
        showToast('스크랩했습니다.');
      }
      setIsScrapped(!isScrapped);
    } catch (error) {
      console.error('스크랩 처리 실패:', error);
      showToast('스크랩 처리에 실패했습니다.', 'error');
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
        runOwnerId: run.userId, // 피드 주인 ID 저장 (비밀 댓글 확인용)
        userId: currentUser.uid,
        authorNickname: currentUser.userData?.nickname || currentUser.displayName || '익명',
        text: textToSubmit.trim(),
        createdAt: Timestamp.now(),
        isPrivate: isPrivate,
        isHidden: false,
        parentCommentId: replyingTo || null // 답글이면 부모 댓글 ID
      };
      
      const commentRef = await addDoc(collection(db, 'comments'), commentData);
      
      // 알림 생성 (자신의 글에 댓글이 아닌 경우만, 비밀 댓글이 아닌 경우만)
      if (run.userId !== currentUser.uid && !isPrivate) {
        await createNotification(run.userId, 'comment', {
          fromUserId: currentUser.uid,
          fromUserNickname: currentUser.userData?.nickname || currentUser.displayName || '익명',
          runId: run.id,
          commentId: commentRef.id,
        });
      }
      
      if (replyingTo) {
        setReplyText('');
        setReplyingTo(null);
        setIsPrivateReply(false);
      } else {
        setCommentText('');
        setIsPrivateComment(false);
      }
    } catch (error) {
      console.error('댓글 작성 실패:', error);
      showToast(`댓글 작성에 실패했습니다: ${error.message}`, 'error');
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

  // 관계 상태 확인
  const getRelationshipStatus = () => {
    if (!currentUser || !author || currentUser.uid === run.userId) {
      return null; // 자신의 게시글은 표시 안 함
    }
    
    const userData = currentUser.userData || {};
    const authorId = run.userId;
    const currentUserId = currentUser.uid;
    
    // 크루 확인 (양쪽 관계와 무관하게 크루에 속하면 표시)
    const isCrewMember = author?.crewName && userData?.crewName && 
                         author.crewName === userData.crewName;
    
    // TODO: 추후 Firestore에서 실제 관계 데이터 가져오기
    // 임시로 author 데이터에서 관계 정보 확인
    // 예상 구조:
    // - author.followingMe: 상대가 나를 팔로우 중인지
    // - author.iAmFollowing: 내가 상대를 팔로우 중인지
    // - author.isFriend: 서로 친구인지
    // - author.friendNickname: 친구일 때 상대방 닉네임
    
    const followingMe = author?.followingMe || false; // 상대가 나를 팔로우 중
    const iAmFollowing = author?.iAmFollowing || false; // 내가 상대를 팔로우 중
    const isFriend = author?.isFriend || false; // 서로 친구
    const friendNickname = author?.friendNickname || author?.nickname || '';
    
    // 크루는 항상 표시 (관계와 무관)
    if (isCrewMember) {
      return { 
        type: 'crew', 
        label: author.crewName || '크루',
        showBadge: true 
      };
    }
    
  // 친구 관계 (서로 수락 완료) - 러닝 버디
    if (isFriend) {
      return { 
        type: 'friend', 
        label: '러닝 버디',
        showBadge: true,
        showButton: false,
        clickable: true, // 클릭 가능하게 설정
        useIcon: true, // 이모티콘 사용
        icon: '🤝' // 악수 이모티콘
      };
    }
    
  // 양쪽 다 팔로우 중 (맞팔로우) - 러닝 버디로 표시
    if (iAmFollowing && followingMe) {
      return { 
        type: 'mutualFollow', 
        label: '러닝 버디',
        showBadge: true,
        showButton: false,
        clickable: true, // 클릭 가능하게 설정
        useIcon: true, // 이모티콘 사용
        icon: '🤝' // 악수 이모티콘
      };
    }
    
    // 상대가 나를 팔로우 중
    if (followingMe && !iAmFollowing) {
      return { 
        type: 'followingMe', 
        label: '나를 팔로우 중입니다',
        showBadge: true,
        showButton: true,
        buttonLabel: '맞팔로우'
      };
    }
    
    // 내가 상대를 팔로우 중
    if (iAmFollowing && !followingMe) {
      return { 
        type: 'iAmFollowing', 
        label: '팔로잉 중',
        showBadge: true,
        showButton: false,
        useIcon: true, // 페이스메이커 아이콘 사용
        clickable: true // 클릭 가능하게 설정
      };
    }
    
    // 아무 관계 아님
    return { 
      type: 'none', 
      label: '팔로우',
      showButton: true,
      buttonLabel: '팔로우'
    };
  };

  const relationshipStatus = getRelationshipStatus();

  const handleRelationshipAction = async (e) => {
    e.stopPropagation();
    
    if (!relationshipStatus || !currentUser || !author) return;
    
    const currentUserId = currentUser.uid;
    const authorId = run.userId;
    let success = false;
    
    try {
      switch (relationshipStatus.type) {
        case 'none':
          // 팔로우 요청
          await setDoc(doc(db, 'follows', `${currentUserId}_${authorId}`), {
            followerId: currentUserId,
            followingId: authorId,
            createdAt: Timestamp.now()
          });
          showToast('팔로우했습니다.');
          
          // 알림 생성
          await createNotification(authorId, 'follow', {
            fromUserId: currentUserId,
            fromUserNickname: currentUser.userData?.nickname || currentUser.displayName || '익명',
          });
          
          // 맞팔로우 확인
          const reverseFollowQuery = query(
            collection(db, 'follows'),
            where('followerId', '==', authorId),
            where('followingId', '==', currentUserId)
          );
          const reverseFollowSnapshot = await getDocs(reverseFollowQuery);
          if (!reverseFollowSnapshot.empty) {
            // 맞팔로우가 되었으므로 양쪽 모두에게 알림
            await createNotification(currentUserId, 'mutualFollow', {
              fromUserId: authorId,
              fromUserNickname: author?.nickname || author?.displayName || '익명',
            });
            await createNotification(authorId, 'mutualFollow', {
              fromUserId: currentUserId,
              fromUserNickname: currentUser.userData?.nickname || currentUser.displayName || '익명',
            });
          }
          
          success = true;
          // 페이지 새로고침하여 상태 업데이트
          setTimeout(() => window.location.reload(), 500);
          break;
          
        case 'iAmFollowing':
          // 친구 신청
          // 팔로우 관계가 이미 있으므로 친구 요청 생성
          await setDoc(doc(db, 'friendRequests', `${currentUserId}_${authorId}`), {
            requesterId: currentUserId,
            receiverId: authorId,
            status: 'pending',
            createdAt: Timestamp.now()
          });
          showToast('친구 신청을 보냈습니다.');
          success = true;
          setTimeout(() => window.location.reload(), 500);
          break;
          
        case 'followingMe':
          // 맞팔로우 (상대가 나를 팔로우 중이므로 나도 팔로우)
          await setDoc(doc(db, 'follows', `${currentUserId}_${authorId}`), {
            followerId: currentUserId,
            followingId: authorId,
            createdAt: Timestamp.now()
          });
          showToast('맞팔로우했습니다.');
          
          // 맞팔로우 알림 (양쪽 모두에게)
          await createNotification(currentUserId, 'mutualFollow', {
            fromUserId: authorId,
            fromUserNickname: author?.nickname || author?.displayName || '익명',
          });
          await createNotification(authorId, 'mutualFollow', {
            fromUserId: currentUserId,
            fromUserNickname: currentUser.userData?.nickname || currentUser.displayName || '익명',
          });
          
          success = true;
          setTimeout(() => window.location.reload(), 500);
          break;
          
        case 'friend':
          // 친구 관리 (추후 구현)
          alert('친구 관리 기능은 추후 구현됩니다.');
          break;
          
        default:
          break;
      }
    } catch (error) {
      console.error('관계 액션 실패:', error);
      // 이미 일부 작업이 성공한 경우(팔로우/신청은 되었지만, 알림 등 부가 작업에서 실패)는
      // 사용자에게 추가 에러 토스트를 보여주지 않음
      if (!success) {
        showToast('작업에 실패했습니다.', 'error');
      }
    }
  };

  const handlePrevPhoto = (e) => {
    e.stopPropagation();
    setCurrentPhotoIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const handleNextPhoto = (e) => {
    e.stopPropagation();
    setCurrentPhotoIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  // 스와이프 처리 (모바일)
  const minSwipeDistance = 50;

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

    if (isLeftSwipe && hasMultiplePhotos) {
      setCurrentPhotoIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
    }
    if (isRightSwipe && hasMultiplePhotos) {
      setCurrentPhotoIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
    }
  };

  return (
    <div className="bg-navy-50 rounded-xl shadow-sm overflow-hidden mb-3 sm:mb-4 border border-navy-100">
      {/* 작성자 정보 헤더 */}
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3 border-b border-navy-200 bg-white">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-navy-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {author?.photoURL ? (
            <img src={author.photoURL} alt={author.nickname || 'User'} className="w-full h-full object-cover" />
          ) : (
            <span className="text-navy-600 text-sm font-semibold">
              ?
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onNicknameClick && run.userId) {
                onNicknameClick(run.userId);
              }
            }}
            className="font-semibold text-navy-900 text-xs sm:text-sm truncate hover:text-navy-700 transition-colors text-left w-full"
          >
            {author?.nickname || author?.displayName || run.authorNickname || '익명'}
          </button>
        </div>
        {/* 관계 상태 표시 (홈 화면에서만) */}
        {relationshipStatus && (
          <div className="flex-shrink-0 flex items-center gap-2">
            {/* 크루 뱃지 (왼쪽에 위치) */}
            {relationshipStatus.type === 'crew' && (
              <div className="px-2 sm:px-3 py-1 sm:py-1.5 bg-purple-100 text-purple-700 text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap">
                크루
              </div>
            )}
            
            {/* 관계 상태 표시 */}
            {relationshipStatus.showBadge && relationshipStatus.type !== 'crew' && (
              relationshipStatus.clickable ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (relationshipStatus.clickable) {
                      setShowUnfollowSheet(true);
                    }
                  }}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap flex items-center gap-1 hover:opacity-80 active:opacity-90 transition-opacity cursor-pointer ${
                    relationshipStatus.type === 'friend' || relationshipStatus.type === 'mutualFollow'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-navy-100 text-navy-700'
                  }`}
                >
                  {relationshipStatus.useIcon ? (
                    <>
                      <span className="text-base sm:text-lg">{relationshipStatus.icon || '🏃'}</span>
                      <span>{relationshipStatus.label}</span>
                    </>
                  ) : (
                    relationshipStatus.label
                  )}
                </button>
              ) : (
                <div className="px-2 sm:px-3 py-1 sm:py-1.5 bg-navy-100 text-navy-700 text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap flex items-center gap-1">
                  {relationshipStatus.useIcon ? (
                    <>
                      <span className="text-base sm:text-lg">🏃</span>
                      <span>{relationshipStatus.label}</span>
                    </>
                  ) : (
                    relationshipStatus.label
                  )}
                </div>
              )
            )}
            
            {/* 액션 버튼 */}
            {relationshipStatus.showButton && (
              <button
                onClick={handleRelationshipAction}
                className="px-2 sm:px-3 py-1 sm:py-1.5 bg-navy-700 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-navy-800 active:bg-navy-900 transition-colors touch-manipulation whitespace-nowrap"
              >
                {relationshipStatus.buttonLabel}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 러닝 사진 */}
      {photos.length > 0 ? (
        <div 
          className="relative w-full bg-navy-100 flex items-center justify-center overflow-hidden px-2"
          style={{ aspectRatio: '1 / 1' }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={photos[currentPhotoIndex]}
              alt="Run"
              className="w-full h-full object-contain block"
              loading="lazy"
            />
            
            {/* 이전 버튼 (PC만 표시) */}
            {hasMultiplePhotos && (
              <button
                onClick={handlePrevPhoto}
                className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 active:bg-opacity-80 text-white rounded-full p-2 z-10 transition-all touch-manipulation items-center justify-center"
                aria-label="이전 사진"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* 다음 버튼 (PC만 표시) */}
            {hasMultiplePhotos && (
              <button
                onClick={handleNextPhoto}
                className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 active:bg-opacity-80 text-white rounded-full p-2 z-10 transition-all touch-manipulation items-center justify-center"
                aria-label="다음 사진"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* 사진 인디케이터 (여러 장일 때 우상단 겹친 사각형 아이콘 - 인스타그램 스타일 참고, 텍스트/흰 라인 없음) */}
            {hasMultiplePhotos && (
              <div className="absolute top-3 right-3 z-10 pointer-events-none">
                <div className={`relative ${multiIconContainerClass}`}>
                  {/* 뒤쪽 사각형 */}
                  <div className={`absolute left-1.5 top-0 ${multiIconRectClass} rounded-md bg-black bg-opacity-30`} />
                  {/* 앞쪽 사각형 */}
                  <div className={`absolute left-0 top-1.5 ${multiIconRectClass} rounded-md bg-black bg-opacity-70`} />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div 
          className={`relative w-full flex items-center justify-center overflow-hidden px-2 ${
            run.textColor === 'light' 
              ? 'bg-gradient-to-br from-navy-700 to-navy-900' 
              : 'bg-gradient-to-br from-navy-50 to-navy-100'
          }`}
          style={{ aspectRatio: '1 / 1' }}
        >
          <div className="relative w-full h-full flex flex-col items-center justify-center text-center p-4 sm:p-6">
            <div className="space-y-2 sm:space-y-3">
              <div className={`${locationTextClass} font-medium ${run.textColor === 'light' ? 'text-white' : 'text-navy-600'}`}>
                {getLocationLabel()}
              </div>
              <div className={`${timeTextClass} font-bold ${run.textColor === 'light' ? 'text-white' : 'text-navy-900'}`}>
                {formatTime(run.time)}
              </div>
              <div className={`${distanceTextClass} font-semibold ${run.textColor === 'light' ? 'text-white' : 'text-navy-700'}`}>
                {getDistanceLabel()}
              </div>
              <div className={`${dateTextClass} ${run.textColor === 'light' ? 'text-white opacity-90' : 'text-navy-600'}`}>
                {formatDate(run.date)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 좋아요, 댓글, 공유, 스크랩 버튼 */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-navy-100 bg-white">
        <button 
          className={`flex items-center gap-1.5 transition-opacity p-1 touch-manipulation ${
            isLiked ? 'opacity-100' : 'hover:opacity-60 active:opacity-80'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            handleLike();
          }}
          style={{ height: '28px' }} // 고정 높이로 박스 크기 영향 방지
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
          onClick={(e) => {
            e.stopPropagation();
            setShowComments(!showComments);
          }}
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
        <button 
          className="hover:opacity-60 active:opacity-80 transition-opacity p-1 touch-manipulation text-navy-400"
          onClick={async (e) => {
            e.stopPropagation();
            const longUrl = getPostUrl(run.id);
            const shareText = `${author?.nickname || author?.displayName || run.authorNickname || '익명'}의 러닝 기록을 확인해보세요!`;
            
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
          }}
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </button>
        <button 
          className={`ml-auto hover:opacity-60 active:opacity-80 transition-opacity p-1 touch-manipulation ${
            isScrapped ? 'text-navy-700' : 'text-navy-400'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            handleScrap();
          }}
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill={isScrapped ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </button>
      </div>

      {/* 댓글 섹션 */}
      {showComments && (
        <div className="px-3 sm:px-4 py-3 sm:py-4 bg-navy-50 border-b border-navy-100">
          {/* 댓글 목록 */}
          <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-xs sm:text-sm text-navy-500 text-center py-4">
                첫 댓글을 남겨보세요!
              </p>
            ) : (
              comments
                .filter(comment => !comment.parentCommentId) // 부모 댓글만 표시
                .map((comment) => {
                  const commentAuthor = commentAuthors[comment.userId];
                  const canViewPrivate = !comment.isPrivate || (
                    currentUser.uid === comment.userId || 
                    currentUser.uid === run.userId
                  );
                  const isHidden = comment.isHidden && currentUser.uid !== comment.userId && currentUser.uid !== run.userId;
                  
                  return (
                    <div key={comment.id} className="space-y-2">
                      <div className="flex gap-2">
                        <div className="flex-1 bg-white rounded-lg p-2 sm:p-3">
                          <div className="flex items-center gap-2 mb-1">
                            {/* 프로필 사진 */}
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
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onNicknameClick && comment.userId) {
                                  onNicknameClick(comment.userId);
                                }
                              }}
                              className="text-xs sm:text-sm font-semibold text-navy-900 hover:text-navy-700 transition-colors"
                            >
                              {comment.authorNickname || '익명'}
                            </button>
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
                            {(currentUser.uid === run.userId || currentUser.uid === comment.userId) && (
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
                            {currentUser.uid === comment.userId && !comment.isPrivate && (
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
                          
                          {/* 답글 목록 */}
                          {comments
                            .filter(reply => reply.parentCommentId === comment.id)
                            .map((reply) => {
                              const replyAuthor = commentAuthors[reply.userId];
                              const canViewReplyPrivate = !reply.isPrivate || (
                                currentUser.uid === reply.userId || 
                                currentUser.uid === run.userId
                              );
                              const isReplyHidden = reply.isHidden && currentUser.uid !== reply.userId && currentUser.uid !== run.userId;
                              
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
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (onNicknameClick && reply.userId) {
                                          onNicknameClick(reply.userId);
                                        }
                                      }}
                                      className="text-[10px] sm:text-xs font-semibold text-navy-900 hover:text-navy-700 transition-colors"
                                    >
                                      {reply.authorNickname || '익명'}
                                    </button>
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
                    </div>
                  );
                })
            )}
          </div>

          {/* 댓글 입력 */}
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

      {/* 하단 정보 */}
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-white">
        <div className={`flex items-center justify-between ${bottomMainTextClass} mb-1.5 sm:mb-2`}>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className={`text-navy-600 ${bottomMainTextClass}`}>⏱️</span>
              <span className={`font-semibold text-navy-900 ${bottomMainTextClass}`}>{formatTime(run.time)}</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className={`text-navy-600 ${bottomMainTextClass}`}>📏</span>
              <span className={`font-semibold text-navy-900 ${bottomMainTextClass}`}>{getDistanceLabel()}</span>
            </div>
          </div>
          <div className={`text-navy-500 ${bottomSubTextClass}`}>
            {formatDate(run.date)}
          </div>
        </div>
        
        {getLocationLabel() && (
          <div className={`${bottomSubTextClass} text-navy-600 flex items-center gap-1 mb-1.5 sm:mb-2`}>
            <span>{run.isOverseas ? '🌍' : (run.runType === 'race' ? '🏆' : '📍')}</span>
            <span className="truncate">{getLocationLabel()}</span>
          </div>
        )}

        {/* 게시 일시 표시 (항상 표시, 내용보다 위에) */}
        {getCreatedAtString() && (
          <div className="mb-2 sm:mb-3 pt-2 sm:pt-3 border-t border-navy-100">
            <div className={`${bottomSubTextClass} text-navy-400`}>
              {getCreatedAtString()} 게시
            </div>
          </div>
        )}

        {/* 더보기 버튼 (메모가 있을 때만, 게시 일시 다음에) */}
        {hasMemo && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExpand(run.id);
            }}
            className={`mb-2 sm:mb-3 ${bottomMainTextClass} text-navy-600 hover:text-navy-800 active:text-navy-900 font-medium transition-colors touch-manipulation py-1`}
          >
            {isExpanded ? '간략히 보기' : '더 보기'}
          </button>
        )}

        {/* 메모 (확장 시에만 표시, 더보기 버튼 다음에) */}
        {isExpanded && hasMemo && (
          <div className="pt-2 sm:pt-3 border-t border-navy-100">
            <p className={`${bottomMainTextClass} text-navy-700 whitespace-pre-wrap break-words`}>
              {displayMemo}
            </p>
          </div>
        )}
      </div>

      {/* 팔로우 해제 팝업 (화면 가운데) */}
      {showUnfollowSheet && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowUnfollowSheet(false)}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-sm p-4 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg sm:text-xl font-bold text-navy-900 text-center mb-2">
              팔로우 해제
            </h3>
            <p className="text-sm sm:text-base text-navy-600 text-center mb-6">
              {author?.nickname || '이 사용자'}님의 게시글을 더 이상 볼 수 없습니다.
            </p>
            <div className="space-y-2">
              <button
                onClick={async () => {
                  try {
                    const followDocId = `${currentUser.uid}_${run.userId}`;
                    await deleteDoc(doc(db, 'follows', followDocId));
                    showToast('팔로우를 해제했습니다.');
                    setShowUnfollowSheet(false);
                    setTimeout(() => window.location.reload(), 500);
                  } catch (error) {
                    console.error('팔로우 해제 실패:', error);
                    showToast('팔로우 해제에 실패했습니다.', 'error');
                  }
                }}
                className="w-full bg-red-500 text-white py-3 sm:py-4 rounded-lg font-semibold text-sm sm:text-base hover:bg-red-600 active:bg-red-700 transition-colors touch-manipulation"
              >
                팔로우 해제
              </button>
              <button
                onClick={() => setShowUnfollowSheet(false)}
                className="w-full bg-navy-100 text-navy-700 py-3 sm:py-4 rounded-lg font-semibold text-sm sm:text-base hover:bg-navy-200 active:bg-navy-300 transition-colors touch-manipulation"
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

export default FeedCard;
