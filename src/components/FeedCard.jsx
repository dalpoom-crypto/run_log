import { useState, useEffect } from 'react';
import { formatTime, formatDate } from '../utils/formatters';

const FeedCard = ({ run, author, onExpand, isExpanded }) => {
  const [showFullMemo, setShowFullMemo] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

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
  const shouldTruncateMemo = memo.length > 100;
  const displayMemo = isExpanded || !shouldTruncateMemo ? memo : memo.substring(0, 100) + '...';

  const photos = run.photos || [];
  const hasMultiplePhotos = photos.length > 1;

  const handlePrevPhoto = (e) => {
    e.stopPropagation();
    setCurrentPhotoIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const handleNextPhoto = (e) => {
    e.stopPropagation();
    setCurrentPhotoIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="bg-navy-50 rounded-xl shadow-sm overflow-hidden mb-3 sm:mb-4 border border-navy-100">
      {/* 작성자 정보 헤더 */}
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3 border-b border-navy-200 bg-white">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-navy-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {author?.photoURL ? (
            <img src={author.photoURL} alt={author.nickname || 'User'} className="w-full h-full object-cover" />
          ) : (
            <span className="text-navy-600 text-sm font-semibold">
              {author?.nickname?.[0]?.toUpperCase() || '?'}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-navy-900 text-xs sm:text-sm truncate">
            {author?.nickname || '익명'}
          </p>
          {run.isOverseas && (
            <p className="text-[10px] sm:text-xs text-navy-500 flex items-center gap-1">
              <span>🌍</span>
              {run.country || run.city || ''}
            </p>
          )}
        </div>
        {run.runType === 'race' && (
          <div className="text-xl sm:text-2xl">🏆</div>
        )}
      </div>

      {/* 러닝 사진 */}
      {photos.length > 0 ? (
        <div className="relative w-full bg-navy-100 flex items-center justify-center py-3 sm:py-4">
          <div className="relative max-w-[600px] w-full flex items-center justify-center">
            <img
              src={photos[currentPhotoIndex]}
              alt="Run"
              className="w-full h-auto max-h-[300px] sm:max-h-[400px] object-contain"
              style={{ maxWidth: '100%' }}
              loading="lazy"
            />
            
            {/* 이전 버튼 */}
            {hasMultiplePhotos && (
              <button
                onClick={handlePrevPhoto}
                className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 active:bg-opacity-80 text-white rounded-full p-1.5 sm:p-2 z-10 transition-all touch-manipulation"
                aria-label="이전 사진"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* 다음 버튼 */}
            {hasMultiplePhotos && (
              <button
                onClick={handleNextPhoto}
                className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 active:bg-opacity-80 text-white rounded-full p-1.5 sm:p-2 z-10 transition-all touch-manipulation"
                aria-label="다음 사진"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* 사진 인디케이터 */}
            {hasMultiplePhotos && (
              <div className="absolute bottom-1.5 sm:bottom-2 left-1/2 -translate-x-1/2 flex gap-1 sm:gap-1.5 z-10">
                {photos.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentPhotoIndex(index);
                    }}
                    className={`h-1.5 sm:h-2 rounded-full transition-all touch-manipulation ${
                      index === currentPhotoIndex
                        ? 'bg-white w-5 sm:w-6'
                        : 'bg-white bg-opacity-50 w-1.5 sm:w-2'
                    }`}
                    aria-label={`사진 ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={`relative w-full aspect-square flex flex-col items-center justify-center p-4 sm:p-6 text-center ${
          run.textColor === 'light' 
            ? 'bg-gradient-to-br from-navy-700 to-navy-900' 
            : 'bg-gradient-to-br from-navy-50 to-navy-100'
        }`}>
          <div className="space-y-2 sm:space-y-3">
            <div
              className={`text-sm sm:text-lg font-medium ${
                run.textColor === 'light' ? 'text-white' : 'text-navy-600'
              }`}
            >
              {getLocationLabel()}
            </div>
            <div className={`text-3xl sm:text-4xl font-bold ${
              run.textColor === 'light' ? 'text-white' : 'text-navy-900'
            }`}>
              {formatTime(run.time)}
            </div>
            <div className={`text-sm sm:text-base font-semibold ${
              run.textColor === 'light' ? 'text-white' : 'text-navy-700'
            }`}>
              {getDistanceLabel()}
            </div>
            <div className={`text-xs sm:text-sm ${
              run.textColor === 'light' ? 'text-white opacity-90' : 'text-navy-600'
            }`}>
              {formatDate(run.date)}
            </div>
          </div>
        </div>
      )}

      {/* 하단 정보 */}
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-white">
        <div className="flex items-center justify-between text-xs sm:text-sm mb-1.5 sm:mb-2">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="text-navy-600 text-xs sm:text-sm">⏱️</span>
              <span className="font-semibold text-navy-900 text-xs sm:text-sm">{formatTime(run.time)}</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="text-navy-600 text-xs sm:text-sm">📏</span>
              <span className="font-semibold text-navy-900 text-xs sm:text-sm">{getDistanceLabel()}</span>
            </div>
          </div>
          <div className="text-navy-500 text-[10px] sm:text-xs">
            {formatDate(run.date)}
          </div>
        </div>
        
        {getLocationLabel() && (
          <div className="text-xs sm:text-sm text-navy-600 flex items-center gap-1 mb-1.5 sm:mb-2">
            <span>📍</span>
            <span className="truncate">{getLocationLabel()}</span>
          </div>
        )}

        {/* 메모 (확장 시에만 표시) */}
        {isExpanded && memo && (
          <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-navy-100">
            <p className="text-xs sm:text-sm text-navy-700 whitespace-pre-wrap break-words">
              {displayMemo}
            </p>
          </div>
        )}

        {/* 확장/축소 버튼 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExpand(run.id);
          }}
          className="mt-2 sm:mt-3 text-xs sm:text-sm text-navy-600 hover:text-navy-800 active:text-navy-900 font-medium transition-colors touch-manipulation py-1"
        >
          {isExpanded ? '간략히 보기' : '더 보기'}
        </button>
      </div>
    </div>
  );
};

export default FeedCard;
