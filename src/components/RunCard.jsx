import { formatTime, formatDate } from '../utils/formatters';

const RunCard = ({ run, onClick }) => {
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

  return (
    <div className="bg-white overflow-hidden cursor-pointer hover:opacity-90 transition-opacity" onClick={onClick}>
      {run.photos && run.photos.length > 0 ? (
        <div className="relative w-full aspect-square bg-navy-100">
          <img
            src={run.photos[0]}
            alt="Run"
            className="w-full h-full object-cover"
            loading="lazy"
          />
          
          {/* 오버레이 - 검정 글씨일 때는 오버레이 없음, 흰색 글씨일 때는 어둡게 */}
          {run.textColor === 'light' && (
            <div className="absolute inset-0 bg-black bg-opacity-40"></div>
          )}
          
          {run.photos.length > 1 && (
            <div className="absolute top-3 right-3 z-10">
              <div className="relative w-6 h-6 sm:w-7 sm:h-7">
                <div className="absolute inset-0 border-2 border-white rounded-sm shadow-lg bg-black bg-opacity-30 backdrop-blur-sm"></div>
                <div className="absolute inset-0 border-2 border-white rounded-sm shadow-lg bg-black bg-opacity-40 backdrop-blur-sm transform translate-x-0.5 translate-y-0.5"></div>
                <div className="absolute inset-0 border-2 border-white rounded-sm shadow-lg bg-black bg-opacity-50 backdrop-blur-sm transform translate-x-1 translate-y-1"></div>
              </div>
            </div>
          )}

          {/* 해외 러닝 지구본 / 대회 트로피 */}
          {run.isOverseas ? (
            <div className="absolute top-3 left-3 text-2xl sm:text-3xl z-10 drop-shadow-lg">
              🌍
            </div>
          ) : (
            run.runType === 'race' && (
              <div className="absolute top-3 left-3 text-2xl sm:text-3xl z-10 drop-shadow-lg">
                🏆
              </div>
            )
          )}

          {run.isPublic === false && (
            <div className="absolute bottom-3 left-3 bg-black bg-opacity-60 text-white p-2 rounded-full shadow-lg z-10 backdrop-blur-sm">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}

          {/* 가운데 정보 표시 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
            <div className="space-y-3 sm:space-y-4">
              <div
                className={`text-base sm:text-lg font-medium drop-shadow-lg ${
                  run.textColor === 'light' ? 'text-white' : 'text-navy-900'
                }`}
              >
                {getLocationLabel()}
              </div>
              <div className={`text-3xl sm:text-5xl font-bold drop-shadow-lg ${
                run.textColor === 'light' ? 'text-white' : 'text-navy-900'
              }`}>
                {formatTime(run.time)}
              </div>
              <div className={`text-sm sm:text-base font-semibold drop-shadow-lg ${
                run.textColor === 'light' ? 'text-white' : 'text-navy-900'
              }`}>
                {getDistanceLabel()}
              </div>
              <div className={`text-xs sm:text-sm opacity-90 drop-shadow-lg ${
                run.textColor === 'light' ? 'text-white' : 'text-navy-900'
              }`}>
                {formatDate(run.date)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={`relative w-full aspect-square flex flex-col items-center justify-center p-6 text-center ${
          run.textColor === 'light' 
            ? 'bg-gradient-to-br from-navy-700 to-navy-900' 
            : 'bg-white'
        }`}>
          {/* 해외 러닝 지구본 / 대회 트로피 */}
          {run.isOverseas ? (
            <div className="absolute top-3 left-3 text-2xl sm:text-3xl">
              🌍
            </div>
          ) : (
            run.runType === 'race' && (
              <div className="absolute top-3 left-3 text-2xl sm:text-3xl">
                🏆
              </div>
            )
          )}
          
          {run.isPublic === false && (
            <div className={`absolute bottom-3 left-3 p-2 rounded-full shadow-lg ${
              run.textColor === 'light' 
                ? 'bg-white bg-opacity-80 text-navy-900' 
                : 'bg-navy-800 bg-opacity-80 text-white'
            }`}>
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}

          <div className="space-y-3 sm:space-y-4">
            <div
              className={`text-base sm:text-lg font-medium ${
                run.textColor === 'light' ? 'text-white' : 'text-navy-600'
              }`}
            >
              {getLocationLabel()}
            </div>
            <div className={`text-3xl sm:text-5xl font-bold ${
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
    </div>
  );
};

export default RunCard;
