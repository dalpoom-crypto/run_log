// 시간 포맷팅 함수
export const formatTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
};

// 페이스 계산 함수
export const calculatePace = (distanceKm, timeSeconds) => {
  const paceSeconds = timeSeconds / distanceKm;
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.floor(paceSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

// 날짜 포맷팅 함수 (YYYY.MM.DD)
export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
};

// 작성일시 포맷팅 함수 (시·분 포함)
export const formatDateTime = (createdAt) => {
  if (!createdAt) return '';
  
  let date = null;
  
  // Firestore Timestamp 처리
  if (createdAt && typeof createdAt.toDate === 'function') {
    date = createdAt.toDate();
  } else if (createdAt.seconds && typeof createdAt.seconds === 'number') {
    date = new Date(createdAt.seconds * 1000);
  } else if (createdAt._seconds && typeof createdAt._seconds === 'number') {
    date = new Date(createdAt._seconds * 1000);
  } else if (createdAt instanceof Date) {
    date = createdAt;
  } else if (typeof createdAt === 'number') {
    date = new Date(createdAt);
  } else if (typeof createdAt === 'string') {
    date = new Date(createdAt);
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