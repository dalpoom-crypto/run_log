import { useState, useEffect } from 'react';
import { db, storage, collection, addDoc, doc, updateDoc, ref, uploadBytes, getDownloadURL, Timestamp } from '../config/firebase';
import { RACE_DATABASE, RACE_TYPES } from '../constants/races';
import { searchCountries } from '../constants/countries';
import { compressImage } from '../utils/image';
import { calculatePace } from '../utils/formatters';
import { showToast } from '../utils/toast';

const AddRunForm = ({ user, onRunAdded, editingRun, onEditComplete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [runType, setRunType] = useState('race');
  
  useEffect(() => {
    const handleOpenForm = () => {
      setIsOpen(true);
    };
    window.addEventListener('openAddRunForm', handleOpenForm);
    return () => {
      window.removeEventListener('openAddRunForm', handleOpenForm);
    };
  }, []);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    distanceType: '5K',
    customDistance: '',
    hours: '0',
    minutes: '0',
    seconds: '0',
    location: '',
    raceName: '',
    memo: '',
    isPublic: true,
    textColor: 'light'
  });
  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [availableRaces, setAvailableRaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [isOverseas, setIsOverseas] = useState(false);
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [place, setPlace] = useState('');
  const [showCountrySearch, setShowCountrySearch] = useState(false);
  const [countrySearchQuery, setCountrySearchQuery] = useState('');

  useEffect(() => {
    if (editingRun) {
      setIsOpen(true);
      setRunType(editingRun.runType);
      
      const timeHours = Math.floor(editingRun.time / 3600);
      const timeMinutes = Math.floor((editingRun.time % 3600) / 60);
      const timeSeconds = editingRun.time % 60;

      const isKnownRace = RACE_DATABASE.some(race => race.name === editingRun.raceName);
      const raceNameValue = isKnownRace ? editingRun.raceName : 'CUSTOM';

      setFormData({
        date: editingRun.date,
        distanceType: editingRun.raceType || 'CUSTOM',
        customDistance: editingRun.raceType === 'CUSTOM' ? editingRun.distance.toString() : '',
        hours: timeHours.toString(),
        minutes: timeMinutes.toString(),
        seconds: timeSeconds.toString(),
        location: editingRun.location || '',
        raceName: raceNameValue,
        customRaceName: !isKnownRace ? editingRun.raceName : '',
        memo: editingRun.memo || '',
        isPublic: editingRun.isPublic !== false,
        textColor: editingRun.textColor || 'light'
      });

      setPhotoPreviews(editingRun.photos || []);
      setPhotos([]);

      // 해외 러닝 필드 초기화 (기존 데이터 호환)
      setIsOverseas(!!editingRun.isOverseas);
      setCountry(editingRun.country || '');
      setCity(editingRun.city || '');
      setPlace(editingRun.place || '');
      setCountrySearchQuery(editingRun.country || '');
      setShowCountrySearch(false);
    }
  }, [editingRun]);

  useEffect(() => {
    if (runType === 'race' && formData.date) {
      const races = RACE_DATABASE.filter(race => race.date === formData.date);
      setAvailableRaces(races);
    }
  }, [runType, formData.date]);

  const handlePhotoChange = async (e) => {
    const files = Array.from(e.target.files);
    const existingPhotoCount = photoPreviews.filter(p => p.startsWith('http')).length;
    const newPhotoCount = photos.length;
    const currentPhotoCount = existingPhotoCount + newPhotoCount;
    const availableSlots = 3 - currentPhotoCount;
    
    if (availableSlots <= 0) {
      showToast('사진은 최대 3장까지 추가할 수 있습니다.', 'error');
      e.target.value = '';
      return;
    }
    
    const filesToAdd = files.slice(0, availableSlots);
    
    const previews = await Promise.all(filesToAdd.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    }));
    
    setPhotos([...photos, ...filesToAdd]);
    setPhotoPreviews([...photoPreviews, ...previews]);
    
    e.target.value = '';
  };

  const removePhoto = (index) => {
    const isExistingPhoto = photoPreviews[index]?.startsWith('http');
    if (isExistingPhoto) {
      // 기존 사진(URL)인 경우 previews에서만 제거
      setPhotoPreviews(photoPreviews.filter((_, i) => i !== index));
    } else {
      // 새로 추가한 사진(File)인 경우 둘 다 제거
      const photoIndex = index - photoPreviews.filter(p => p.startsWith('http')).length;
      setPhotos(photos.filter((_, i) => i !== photoIndex));
      setPhotoPreviews(photoPreviews.filter((_, i) => i !== index));
    }
  };

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    // photoPreviews 재정렬
    const reorderedPreviews = [...photoPreviews];
    const draggedPreview = reorderedPreviews.splice(draggedIndex, 1)[0];
    reorderedPreviews.splice(dropIndex, 0, draggedPreview);
    setPhotoPreviews(reorderedPreviews);

    // photos 배열도 재정렬 (새로 추가한 파일만)
    const existingPhotoCount = photoPreviews.filter(p => p.startsWith('http')).length;
    const reorderedPhotos = [...photos];
    
    // draggedIndex와 dropIndex가 새로 추가한 사진 범위 내에 있는지 확인
    if (draggedIndex >= existingPhotoCount && dropIndex >= existingPhotoCount) {
      const photoIndex = draggedIndex - existingPhotoCount;
      const dropPhotoIndex = dropIndex - existingPhotoCount;
      const draggedPhoto = reorderedPhotos.splice(photoIndex, 1)[0];
      reorderedPhotos.splice(dropPhotoIndex, 0, draggedPhoto);
      setPhotos(reorderedPhotos);
    } else if (draggedIndex < existingPhotoCount && dropIndex >= existingPhotoCount) {
      // 기존 사진을 새 사진 위치로 이동하는 경우는 photos 배열 변경 없음
    } else if (draggedIndex >= existingPhotoCount && dropIndex < existingPhotoCount) {
      // 새 사진을 기존 사진 위치로 이동하는 경우
      const photoIndex = draggedIndex - existingPhotoCount;
      const draggedPhoto = reorderedPhotos.splice(photoIndex, 1)[0];
      reorderedPhotos.splice(0, 0, draggedPhoto);
      setPhotos(reorderedPhotos);
    }

    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleClose = () => {
    setIsOpen(false);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      distanceType: '5K',
      customDistance: '',
      hours: '0',
      minutes: '0',
      seconds: '0',
      location: '',
      raceName: '',
      memo: '',
      isPublic: true,
      textColor: 'light'
    });
    setPhotos([]);
    setPhotoPreviews([]);
    setIsOverseas(false);
    setCountry('');
    setCity('');
    setPlace('');
    setCountrySearchQuery('');
    setShowCountrySearch(false);
    if (editingRun) {
      onEditComplete();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 해외 러닝일 때 필수 필드 검증
      if (runType === 'casual' && isOverseas) {
        // countrySearchQuery가 있으면 country로 사용 (드롭다운 선택 또는 직접 입력)
        const finalCountry = (country && country.trim()) || (countrySearchQuery && countrySearchQuery.trim());
        
        if (!finalCountry) {
          showToast('국가를 입력해주세요.', 'error');
          setLoading(false);
          return;
        }
        if (!city || !city.trim()) {
          showToast('도시를 입력해주세요.', 'error');
          setLoading(false);
          return;
        }
      }

      // 일상 러닝일 때 location 검증 (해외가 아닐 때)
      if (runType === 'casual' && !isOverseas) {
        if (!formData.location || !formData.location.trim()) {
          showToast('장소를 입력해주세요.', 'error');
          setLoading(false);
          return;
        }
      }

      const totalSeconds = parseInt(formData.hours) * 3600 + 
                          parseInt(formData.minutes) * 60 + 
                          parseInt(formData.seconds);
      
      let distance;
      let raceType;
      
      if (formData.distanceType === 'CUSTOM') {
        distance = parseFloat(formData.customDistance);
        raceType = 'CUSTOM';
      } else {
        distance = RACE_TYPES[formData.distanceType];
        raceType = formData.distanceType;
      }

      const photoURLs = [];
      
      // photoPreviews 순서대로 처리
      for (let i = 0; i < photoPreviews.length; i++) {
        const preview = photoPreviews[i];
        if (preview.startsWith('http')) {
          // 기존 사진(URL)은 그대로 사용
          photoURLs.push(preview);
        } else {
          // 새로 추가한 사진(File)은 업로드
          // photos 배열에서 해당 인덱스 찾기 (이전까지의 새 사진 개수)
          const newPhotoCountBefore = photoPreviews.slice(0, i).filter(p => !p.startsWith('http')).length;
          const photo = photos[newPhotoCountBefore];
          if (photo) {
            const compressed = await compressImage(photo);
            const photoRef = ref(storage, `runs/${user.uid}/${Date.now()}_${Math.random()}`);
            await uploadBytes(photoRef, compressed);
            const url = await getDownloadURL(photoRef);
            photoURLs.push(url);
          }
        }
      }

      // location 처리: 해외일 때는 country + city + place 조합, 국내일 때는 formData.location
      let finalLocation = '';
      const finalCountry = (country && country.trim()) || (countrySearchQuery && countrySearchQuery.trim()) || '';
      
      if (runType === 'casual') {
        if (isOverseas) {
          // 해외: "일본 도쿄 XX공원" 형식
          const parts = [finalCountry, city, place].filter(Boolean);
          finalLocation = parts.join(' ');
        } else {
          // 국내: 기존 location
          finalLocation = formData.location || '';
        }
      }

      const runData = {
        userId: user.uid,
        runType,
        date: formData.date,
        distance,
        time: totalSeconds,
        pace: calculatePace(distance, totalSeconds),
        location: finalLocation,
        raceName: runType === 'race' ? (formData.raceName === 'CUSTOM' ? formData.customRaceName : formData.raceName) : '',
        memo: formData.memo,
        photos: photoURLs,
        isPublic: formData.isPublic,
        textColor: formData.textColor,
        raceType,
        // 해외 러닝 필드
        isOverseas: runType === 'casual' ? isOverseas : false,
        country: (runType === 'casual' && isOverseas) ? finalCountry : null,
        city: (runType === 'casual' && isOverseas) ? city : null,
        place: (runType === 'casual' && isOverseas) ? place : null,
        collections: editingRun?.collections || [],
        ...(editingRun ? {} : { createdAt: Timestamp.now() })
      };

      if (editingRun) {
        await updateDoc(doc(db, 'runs', editingRun.id), runData);
        onEditComplete();
      } else {
        await addDoc(collection(db, 'runs'), runData);
        onRunAdded();
      }
      
      handleClose();
    } catch (error) {
      console.error('기록 저장 실패:', error);
      showToast('기록 저장에 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto modal-content">
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-navy-100 sticky top-0 bg-white z-10">
              <h2 className="text-xl sm:text-2xl font-bold text-navy-900">{editingRun ? '기록 수정' : '새 기록 등록'}</h2>
              <button
                onClick={handleClose}
                className="text-navy-400 hover:text-navy-600 transition-colors p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-3 sm:space-y-5">
              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">구분</label>
                <div className="flex gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setRunType('race')}
                    className={`flex-1 py-2.5 sm:py-3 rounded-lg font-semibold text-sm sm:text-base transition-colors touch-manipulation ${
                      runType === 'race'
                        ? 'bg-navy-700 text-white'
                        : 'bg-navy-100 text-navy-600 hover:bg-navy-200 active:bg-navy-300'
                    }`}
                  >
                    대회
                  </button>
                  <button
                    type="button"
                    onClick={() => setRunType('casual')}
                    className={`flex-1 py-2.5 sm:py-3 rounded-lg font-semibold text-sm sm:text-base transition-colors touch-manipulation ${
                      runType === 'casual'
                        ? 'bg-navy-700 text-white'
                        : 'bg-navy-100 text-navy-600 hover:bg-navy-200 active:bg-navy-300'
                    }`}
                  >
                    일상
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">날짜</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  min="1900-01-01"
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none text-sm sm:text-base"
                  required
                />
              </div>

              {runType === 'race' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-navy-700 mb-2">대회명</label>
                    <select
                      value={formData.raceName}
                      onChange={(e) => setFormData({...formData, raceName: e.target.value})}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none appearance-none bg-white text-sm sm:text-base"
                      style={{ backgroundImage: "url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27currentColor%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3e%3cpolyline points=%276 9 12 15 18 9%27%3e%3c/polyline%3e%3c/svg%3e')", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.5em 1.5em', paddingRight: '3rem' }}
                      required
                    >
                      <option value="">대회를 선택하세요</option>
                      {availableRaces.map(race => (
                        <option key={race.id} value={race.name}>{race.name}</option>
                      ))}
                      <option value="CUSTOM">직접 입력</option>
                    </select>
                  </div>
                  
                  {formData.raceName === 'CUSTOM' && (
                    <div>
                      <label className="block text-sm font-semibold text-navy-700 mb-2">대회명 직접 입력</label>
                      <input
                        type="text"
                        value={formData.customRaceName || ''}
                        onChange={(e) => setFormData({...formData, customRaceName: e.target.value})}
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none text-sm sm:text-base"
                        placeholder="대회명을 입력하세요"
                        required
                      />
                    </div>
                  )}
                </>
              )}

              {runType === 'casual' && (
                <>
                  {/* 장소 + 해외 토글 (토글 안에 텍스트 포함) */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-semibold text-navy-700">
                        장소
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !isOverseas;
                          setIsOverseas(next);
                          if (!next) {
                            setCountry('');
                            setCity('');
                            setPlace('');
                            setCountrySearchQuery('');
                            setShowCountrySearch(false);
                          }
                        }}
                        className={`relative inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors ${
                          isOverseas ? 'bg-navy-700 text-white' : 'bg-slate-300 text-slate-700'
                        }`}
                        aria-pressed={isOverseas}
                      >
                        <span className="mr-2">
                          {isOverseas ? '해외' : '국내'}
                        </span>
                        <span
                          className={`flex items-center justify-center w-5 h-5 rounded-full bg-white text-[10px] transition-colors ${
                            isOverseas ? 'text-navy-700' : 'text-slate-400'
                          }`}
                        >
                          {isOverseas ? '✓' : '✕'}
                        </span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none text-sm sm:text-base"
                      placeholder="올림픽공원"
                      required
                    />
                  </div>

                  {/* 해외 러닝 세부 정보 */}
                  {isOverseas && (
                    <div className="mt-1 space-y-3">
                      {/* 국가 + 도시 한 줄 */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm font-semibold text-navy-700 mb-2">
                            국가
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={countrySearchQuery}
                              onChange={(e) => {
                                setCountrySearchQuery(e.target.value);
                                setShowCountrySearch(true);
                              }}
                              onFocus={() => setShowCountrySearch(true)}
                              placeholder="국가 검색 (예: 일본)"
                              className="w-full px-3 py-2 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none text-sm"
                              required={isOverseas}
                            />

                            {showCountrySearch && (
                              <div className="absolute z-10 w-full mt-1 bg-white border-2 border-navy-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                {searchCountries(countrySearchQuery)
                                  .slice(0, 10)
                                  .map((c) => (
                                    <button
                                      key={c.code}
                                      type="button"
                                      onClick={() => {
                                        setCountry(c.name);
                                        setCountrySearchQuery(c.name);
                                        setShowCountrySearch(false);
                                      }}
                                      className="w-full text-left px-3 py-1.5 hover:bg-navy-50 transition-colors text-sm"
                                    >
                                      {c.name} ({c.nameEn})
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-navy-700 mb-2">
                            도시
                          </label>
                          <input
                            type="text"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="도쿄"
                            className="w-full px-3 py-2 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none text-sm"
                            required={isOverseas}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">거리</label>
                <div className="grid grid-cols-5 gap-2 mb-2">
                  {['5K', '10K', 'HALF', 'FULL', 'CUSTOM'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({...formData, distanceType: type})}
                      className={`py-2 sm:py-2.5 rounded-lg font-semibold text-xs sm:text-sm transition-colors touch-manipulation ${
                        formData.distanceType === type
                          ? 'bg-navy-700 text-white'
                          : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
                      }`}
                    >
                      {type === 'CUSTOM' ? '직접입력' : type}
                    </button>
                  ))}
                </div>
                {formData.distanceType === 'CUSTOM' && (
                  <input
                    type="number"
                    step="0.01"
                    value={formData.customDistance}
                    onChange={(e) => setFormData({...formData, customDistance: e.target.value})}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none text-sm sm:text-base"
                    placeholder="거리 입력 (km)"
                    required
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">기록 시간</label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={formData.hours}
                      onChange={(e) => setFormData({...formData, hours: e.target.value})}
                      onFocus={(e) => e.target.value === '0' && setFormData({...formData, hours: ''})}
                      onBlur={(e) => !e.target.value && setFormData({...formData, hours: '0'})}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 pr-12 sm:pr-16 rounded-lg border-2 border-navy-200 bg-white focus:border-navy-600 focus:outline-none text-center text-sm sm:text-base"
                      placeholder="0"
                    />
                    <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-navy-500 pointer-events-none">시간</div>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={formData.minutes}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 59)) {
                          setFormData({...formData, minutes: value});
                        }
                      }}
                      onFocus={(e) => e.target.value === '0' && setFormData({...formData, minutes: ''})}
                      onBlur={(e) => {
                        const value = e.target.value;
                        if (!value) {
                          setFormData({...formData, minutes: '0'});
                        } else if (parseInt(value) > 59) {
                          setFormData({...formData, minutes: '59'});
                        } else if (parseInt(value) < 0) {
                          setFormData({...formData, minutes: '0'});
                        }
                      }}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 pr-10 sm:pr-12 rounded-lg border-2 border-navy-200 bg-white focus:border-navy-600 focus:outline-none text-center text-sm sm:text-base"
                      placeholder="0"
                    />
                    <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-navy-500 pointer-events-none">분</div>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={formData.seconds}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 59)) {
                          setFormData({...formData, seconds: value});
                        }
                      }}
                      onFocus={(e) => e.target.value === '0' && setFormData({...formData, seconds: ''})}
                      onBlur={(e) => {
                        const value = e.target.value;
                        if (!value) {
                          setFormData({...formData, seconds: '0'});
                        } else if (parseInt(value) > 59) {
                          setFormData({...formData, seconds: '59'});
                        } else if (parseInt(value) < 0) {
                          setFormData({...formData, seconds: '0'});
                        }
                      }}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 pr-10 sm:pr-12 rounded-lg border-2 border-navy-200 bg-white focus:border-navy-600 focus:outline-none text-center text-sm sm:text-base"
                      placeholder="0"
                    />
                    <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-navy-500 pointer-events-none">초</div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">사진 (최대 3장)</label>
                <div className="grid grid-cols-3 gap-2">
                  {photoPreviews.map((preview, idx) => (
                    <div 
                      key={idx} 
                      className="image-upload-container has-image cursor-move"
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                      style={{ opacity: draggedIndex === idx ? 0.5 : 1 }}
                    >
                      <img src={preview} alt={`Photo ${idx}`} className="image-preview pointer-events-none" />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 z-10"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded z-10 pointer-events-none">
                        {idx + 1}
                      </div>
                    </div>
                  ))}
                  {photoPreviews.length < 3 && (
                    <div className="image-upload-container" onClick={() => document.getElementById('photo-input').click()}>
                      <div className="upload-placeholder">
                        <svg className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <p className="text-xs leading-tight">사진<br/>추가</p>
                      </div>
                    </div>
                  )}
                </div>
                <input
                  id="photo-input"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">메모</label>
                <textarea
                  value={formData.memo}
                  onChange={(e) => setFormData({...formData, memo: e.target.value})}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none text-sm sm:text-base"
                  rows="3"
                  placeholder="오늘의 달리기는 어땠나요?"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">공개 설정</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, isPublic: true})}
                    className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                      formData.isPublic
                        ? 'bg-navy-700 text-white'
                        : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
                    }`}
                  >
                    공개
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, isPublic: false})}
                    className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                      !formData.isPublic
                        ? 'bg-navy-700 text-white'
                        : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
                    }`}
                  >
                    비공개
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">글씨색 선택</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, textColor: 'light'})}
                    className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                      formData.textColor === 'light'
                        ? 'bg-navy-700 text-white'
                        : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
                    }`}
                  >
                    White
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, textColor: 'dark'})}
                    className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                      formData.textColor === 'dark'
                        ? 'bg-navy-700 text-white'
                        : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
                    }`}
                  >
                    Black
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-navy-700 text-white font-semibold py-3 sm:py-4 rounded-lg hover:bg-navy-800 active:bg-navy-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base touch-manipulation"
              >
                {loading && (
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {loading ? '저장 중...' : (editingRun ? '수정 완료' : '기록 저장')}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AddRunForm;
