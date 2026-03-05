import { useState, useEffect } from 'react';
import {
  db,
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
  onSnapshot,
  orderBy,
} from '../config/firebase';
import { showToast } from '../utils/toast';

const NotificationModal = ({ user, userData, onClose, onViewUserProfile }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsedDates, setCollapsedDates] = useState(new Set()); // 접힌 날짜들

  useEffect(() => {
    if (!user?.uid) return;

    // 모든 알림 가져오기 (읽지 않은 알림은 모두, 읽은 알림은 7일 이내만 필터링)
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const allNotifications = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      
      // 7일 전 날짜 계산
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      // 필터링: 읽지 않은 알림은 모두 표시, 읽은 알림은 읽은 시점 기준 7일 이내만 표시
      const filteredNotifications = allNotifications.filter((n) => {
        // 읽지 않은 알림은 모두 표시
        if (!n.read) return true;
        
        // 읽은 알림은 읽은 시점 기준으로 7일 이내만 표시
        // readAt 필드가 있으면 readAt 기준, 없으면 createdAt 기준 (하위 호환성)
        let readAt = null;
        
        // readAt 필드 파싱
        if (n.readAt) {
          try {
            if (typeof n.readAt.toDate === 'function') {
              readAt = n.readAt.toDate();
            } else if (n.readAt.seconds !== undefined) {
              readAt = new Date(n.readAt.seconds * 1000);
            } else if (n.readAt._seconds !== undefined) {
              readAt = new Date(n.readAt._seconds * 1000);
            } else if (n.readAt instanceof Date) {
              readAt = n.readAt;
            } else if (typeof n.readAt === 'number') {
              readAt = new Date(n.readAt);
            }
          } catch (e) {
            console.error('readAt 파싱 실패:', e, n.readAt);
          }
        }
        
        // readAt이 없으면 createdAt을 기준으로 (기존 알림 호환)
        if (!readAt && n.createdAt) {
          try {
            if (typeof n.createdAt.toDate === 'function') {
              readAt = n.createdAt.toDate();
            } else if (n.createdAt.seconds !== undefined) {
              readAt = new Date(n.createdAt.seconds * 1000);
            } else if (n.createdAt._seconds !== undefined) {
              readAt = new Date(n.createdAt._seconds * 1000);
            } else if (n.createdAt instanceof Date) {
              readAt = n.createdAt;
            } else if (typeof n.createdAt === 'number') {
              readAt = new Date(n.createdAt);
            }
          } catch (e) {
            console.error('createdAt 파싱 실패:', e, n.createdAt);
          }
        }
        
        // readAt이 없거나 유효하지 않으면 createdAt 기준으로 7일 이내 확인
        if (!readAt || isNaN(readAt.getTime())) {
          // createdAt이 있으면 createdAt 기준으로 7일 이내 확인
          let createdAt = null;
          if (n.createdAt) {
            try {
              if (typeof n.createdAt.toDate === 'function') {
                createdAt = n.createdAt.toDate();
              } else if (n.createdAt.seconds !== undefined) {
                createdAt = new Date(n.createdAt.seconds * 1000);
              } else if (n.createdAt._seconds !== undefined) {
                createdAt = new Date(n.createdAt._seconds * 1000);
              } else if (n.createdAt instanceof Date) {
                createdAt = n.createdAt;
              }
            } catch (e) {
              console.error('createdAt 파싱 실패:', e);
            }
          }
          if (createdAt && !isNaN(createdAt.getTime())) {
            const isWithin7Days = createdAt >= sevenDaysAgo;
            return isWithin7Days;
          }
          // createdAt도 없으면 표시하지 않음
          return false;
        }
        
        // 읽은 시점이 7일 이내인지 확인
        const isWithin7Days = readAt >= sevenDaysAgo;
        return isWithin7Days;
      });
      
      // 디버깅: 필터링 결과 확인
      console.log('전체 알림:', allNotifications.length);
      console.log('필터링된 알림:', filteredNotifications.length);
      console.log('읽은 알림 수:', allNotifications.filter(n => n.read).length);
      console.log('필터링된 읽은 알림 수:', filteredNotifications.filter(n => n.read).length);
      
      setNotifications(filteredNotifications);
      
      // 가장 최근 알림이 있는 날짜만 펼친 상태로 설정 (오늘이 아니어도 최신 알림 날짜는 펼침)
      const grouped = groupNotificationsByDate(filteredNotifications);
      const dateKeys = Object.keys(grouped);
      const initialCollapsed = new Set();

      if (dateKeys.length > 1) {
        // 첫 번째 날짜(가장 최근 알림이 있는 날짜)만 펼치고 나머지는 접기
        dateKeys.forEach((dateKey, index) => {
          if (index > 0) {
            initialCollapsed.add(dateKey);
          }
        });
      }

      setCollapsedDates(initialCollapsed);
      
      setLoading(false);
    }, (error) => {
      console.error('알림 로드 실패:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const handleMarkAsRead = async (notificationId) => {
    if (!user?.uid) return;
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
        readAt: Timestamp.now(), // 읽은 시점 저장
      });
    } catch (error) {
      console.error('알림 읽음 처리 실패:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.uid) return;
    try {
      const unreadNotifications = notifications.filter((n) => !n.read);
      const readAt = Timestamp.now();
      await Promise.all(
        unreadNotifications.map((n) =>
          updateDoc(doc(db, 'notifications', n.id), { 
            read: true,
            readAt: readAt, // 읽은 시점 저장
          }),
        ),
      );
      showToast('모든 알림을 읽음 처리했습니다.');
    } catch (error) {
      console.error('알림 일괄 읽음 처리 실패:', error);
      showToast('알림 읽음 처리에 실패했습니다.', 'error');
    }
  };

  const getNotificationMessage = (notification) => {
    switch (notification.type) {
      case 'like':
        return `${notification.fromUserNickname || '누군가'}님이 좋아요를 눌렀습니다.`;
      case 'comment':
        return `${notification.fromUserNickname || '누군가'}님이 댓글을 남겼습니다.`;
      case 'follow':
        return `${notification.fromUserNickname || '누군가'}님이 팔로우했습니다.`;
      case 'mutualFollow':
        return `${notification.fromUserNickname || '누군가'}님과 러닝 버디가 되었습니다.`;
      case 'crewApproved':
        return `${notification.crewName || '크루'} 가입이 승인되었습니다.`;
      case 'crewRejected':
        return `${notification.crewName || '크루'} 가입 신청이 거부되었습니다.`;
      case 'crewKicked':
        return `${notification.crewName || '크루'}에서 강퇴되었습니다.`;
      case 'crewAdmin':
        return `${notification.crewName || '크루'}에서 관리자로 임명되었습니다.`;
      case 'crewOwner':
        return `${notification.crewName || '크루'}에서 크루장으로 위임되었습니다.`;
      case 'crewNotice':
        return `${notification.crewName || '크루'}에 새로운 공지가 올라왔습니다.`;
      case 'crewJoinRequest':
        return `${notification.requesterNickname || '누군가'}님이 ${notification.crewName || '크루'} 가입을 신청했습니다.`;
      case 'crewJoinCancel':
        return `${notification.requesterNickname || '누군가'}님이 ${notification.crewName || '크루'} 가입 신청을 취소했습니다.`;
      case 'crewMemberLeft':
        return `${notification.memberNickname || '누군가'}님이 ${notification.crewName || '크루'}에서 탈퇴했습니다.`;
      case 'recordPB':
        return `개인 최고 기록이 갱신되었습니다!`;
      default:
        return '새로운 알림이 있습니다.';
    }
  };

  const iconClass = 'w-5 h-5 text-navy-700';
  const getNotificationIcon = (type) => {
    const Svg = ({ d, className = iconClass }) => (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
      </svg>
    );
    switch (type) {
      case 'like':
        return <Svg d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" className={`${iconClass} text-orange-500`} />;
      case 'comment':
        return <Svg d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />;
      case 'follow':
      case 'mutualFollow':
        return (
          <Svg
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            className={`${iconClass} text-sky-600`}
          />
        );
      case 'crewApproved':
      case 'crewRejected':
      case 'crewKicked':
      case 'crewAdmin':
      case 'crewOwner':
      case 'crewNotice':
      case 'crewJoinRequest':
      case 'crewJoinCancel':
      case 'crewMemberLeft':
        return (
          <Svg
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            className={`${iconClass} text-purple-600`}
          />
        );
      case 'recordPB':
        return <Svg d="M5 3h14v5a3 3 0 01-3 3H8a3 3 0 01-3-3V3zm0 0V2a1 1 0 011-1h12a1 1 0 011 1v1M5 3v2a3 3 0 003 3h8a3 3 0 003-3V3M5 9v4.5A2.5 2.5 0 007.5 16h9a2.5 2.5 0 002.5-2.5V9m-12 2a3 3 0 013-3h6a3 3 0 013 3m-12-2h12" className={`${iconClass} text-amber-500`} />;
      default:
        return <Svg d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />;
    }
  };

  const handleNotificationClick = async (notification) => {
    await handleMarkAsRead(notification.id);

    // 알림 타입에 따라 다른 동작
    if (notification.type === 'like' || notification.type === 'comment') {
      // 게시글로 이동 (추후 구현)
      if (notification.runId) {
        // 게시글 상세보기로 이동
        window.dispatchEvent(
          new CustomEvent('viewRun', { detail: { runId: notification.runId } }),
        );
      }
    } else if (notification.type === 'follow' || notification.type === 'mutualFollow') {
      // 프로필로 이동
      if (notification.fromUserId && onViewUserProfile) {
        onViewUserProfile(notification.fromUserId);
      }
    } else if (notification.type === 'crewJoinRequest') {
      // 크루 가입 신청 알림: 멤버 관리 화면으로 이동
      window.dispatchEvent(new CustomEvent('openCrewManage', { 
        detail: { 
          crewId: notification.crewId,
          membershipId: notification.membershipId 
        } 
      }));
    } else if (
      notification.type === 'crewApproved' ||
      notification.type === 'crewKicked' ||
      notification.type === 'crewAdmin' ||
      notification.type === 'crewOwner' ||
      notification.type === 'crewNotice'
    ) {
      // 크루 탭으로 이동 (추후 구현)
      window.dispatchEvent(new CustomEvent('openCrewTab'));
    }

    onClose();
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    let date = null;
    if (timestamp && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (timestamp instanceof Timestamp) {
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp._seconds) {
      date = new Date(timestamp._seconds * 1000);
    }
    if (!date || isNaN(date.getTime())) return '';

    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  // 알림을 날짜별로 그룹화
  const groupNotificationsByDate = (notificationsToGroup = notifications) => {
    const grouped = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    notificationsToGroup.forEach((notification) => {
      let date = null;
      if (notification.createdAt) {
        try {
          if (typeof notification.createdAt.toDate === 'function') {
            date = notification.createdAt.toDate();
          } else if (notification.createdAt.seconds !== undefined) {
            date = new Date(notification.createdAt.seconds * 1000);
          } else if (notification.createdAt._seconds !== undefined) {
            date = new Date(notification.createdAt._seconds * 1000);
          } else if (notification.createdAt instanceof Date) {
            date = notification.createdAt;
          }
        } catch (e) {
          console.error('날짜 파싱 실패:', e);
        }
      }

      if (!date || isNaN(date.getTime())) {
        // 날짜를 파싱할 수 없으면 "기타"로 분류
        const key = '기타';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(notification);
        return;
      }

      const notificationDate = new Date(date);
      notificationDate.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today - notificationDate) / (1000 * 60 * 60 * 24));

      let dateKey = '';
      if (diffDays === 0) {
        dateKey = '오늘';
      } else if (diffDays === 1) {
        dateKey = '1일 전';
      } else if (diffDays === 2) {
        dateKey = '2일 전';
      } else if (diffDays < 7) {
        dateKey = `${diffDays}일 전`;
      } else {
        dateKey = date.toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
      }

      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(notification);
    });

    return grouped;
  };

  const toggleDateCollapse = (dateKey) => {
    setCollapsedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-navy-200">
          <h3 className="text-base sm:text-lg font-bold text-navy-900">알림</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-navy-600 hover:text-navy-800 transition-colors"
              >
                모두 읽음
              </button>
            )}
            <button
              onClick={onClose}
              className="text-navy-400 hover:text-navy-600 transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* 알림 목록 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-sm text-navy-500 text-center py-8">불러오는 중...</div>
          ) : notifications.length === 0 ? (
            <div className="text-sm text-navy-500 text-center py-8">알림이 없습니다.</div>
          ) : (
            <div>
              {Object.entries(groupNotificationsByDate()).map(([dateKey, dateNotifications]) => {
                const isToday = dateKey === '오늘';
                const isCollapsed = collapsedDates.has(dateKey);
                const shouldShow = isToday || !isCollapsed;

                return (
                  <div key={dateKey} className="border-b border-navy-100 last:border-b-0">
                    {/* 날짜 헤더 */}
                    <button
                      onClick={() => !isToday && toggleDateCollapse(dateKey)}
                      className={`w-full text-left px-3 sm:px-4 py-2 bg-navy-50 hover:bg-navy-100 transition-colors flex items-center justify-between ${
                        !isToday ? 'cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      <span className="text-xs sm:text-sm font-semibold text-navy-700">
                        {dateKey}
                      </span>
                      {!isToday && (
                        <svg
                          className={`w-4 h-4 text-navy-500 transition-transform ${
                            isCollapsed ? '' : 'rotate-180'
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      )}
                    </button>

                    {/* 해당 날짜의 알림 목록 */}
                    {shouldShow && (
                      <div className="divide-y divide-navy-100">
                        {dateNotifications.map((notification) => (
                          <button
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={`w-full text-left p-3 sm:p-4 hover:bg-navy-50 transition-colors ${
                              !notification.read ? 'bg-navy-25' : ''
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0">
                                <div className="w-9 h-9 rounded-full bg-navy-50 flex items-center justify-center">
                                  {getNotificationIcon(notification.type)}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm sm:text-base font-semibold text-navy-900 mb-1">
                                  {getNotificationMessage(notification)}
                                </p>
                                <p className="text-xs text-navy-500">
                                  {formatDate(notification.createdAt)}
                                </p>
                              </div>
                              {!notification.read && (
                                <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 mt-2"></div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;
