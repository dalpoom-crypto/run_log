import { db, collection, addDoc, Timestamp, doc, getDoc } from '../config/firebase';

/**
 * 알림 생성 유틸리티 함수
 * @param {string} userId - 알림을 받을 사용자 ID
 * @param {string} type - 알림 타입
 * @param {object} data - 알림 데이터
 */
export const createNotification = async (userId, type, data = {}) => {
  if (!userId) return;

  try {
    // 사용자 알림 설정 확인
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return;

    const userData = userDoc.data();
    // 알림이 꺼져있으면 생성하지 않음
    if (userData.notificationsEnabled === false) return;

    const notificationData = {
      userId,
      type,
      read: false,
      createdAt: Timestamp.now(),
      ...data,
    };

    await addDoc(collection(db, 'notifications'), notificationData);
  } catch (error) {
    console.error('알림 생성 실패:', error);
  }
};
