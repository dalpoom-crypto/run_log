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

  useEffect(() => {
    if (!user?.uid) return;

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const notificationsData = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setNotifications(notificationsData);
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
      });
    } catch (error) {
      console.error('알림 읽음 처리 실패:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.uid) return;
    try {
      const unreadNotifications = notifications.filter((n) => !n.read);
      await Promise.all(
        unreadNotifications.map((n) =>
          updateDoc(doc(db, 'notifications', n.id), { read: true }),
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
      case 'crewKicked':
        return `${notification.crewName || '크루'}에서 강퇴되었습니다.`;
      case 'crewAdmin':
        return `${notification.crewName || '크루'}에서 관리자로 임명되었습니다.`;
      case 'crewOwner':
        return `${notification.crewName || '크루'}에서 크루장으로 위임되었습니다.`;
      case 'crewNotice':
        return `${notification.crewName || '크루'}에 새로운 공지가 올라왔습니다.`;
      case 'recordPB':
        return `개인 최고 기록이 갱신되었습니다!`;
      default:
        return '새로운 알림이 있습니다.';
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'like':
        return '🔥';
      case 'comment':
        return '💬';
      case 'follow':
      case 'mutualFollow':
        return '👥';
      case 'crewApproved':
      case 'crewKicked':
      case 'crewAdmin':
      case 'crewOwner':
      case 'crewNotice':
        return '🏃';
      case 'recordPB':
        return '🏆';
      default:
        return '🔔';
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
            <div className="divide-y divide-navy-100">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full text-left p-3 sm:p-4 hover:bg-navy-50 transition-colors ${
                    !notification.read ? 'bg-navy-25' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl flex-shrink-0">
                      {getNotificationIcon(notification.type)}
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
      </div>
    </div>
  );
};

export default NotificationModal;
