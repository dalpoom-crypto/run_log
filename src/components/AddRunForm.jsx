import { useState, useEffect } from 'react';
import { db, storage, collection, addDoc, doc, updateDoc, ref, uploadBytes, getDownloadURL, Timestamp } from '../config/firebase';
import { RACE_DATABASE, RACE_TYPES } from '../constants/races';
import { searchCountries } from '../constants/countries';
import { compressImage } from '../utils/image';
import { calculatePace } from '../utils/formatters';
import { showToast } from '../utils/toast';
import PhotoCropModal from './PhotoCropModal';

const AddRunForm = ({ user, onRunAdded, editingRun, onEditComplete, onClose }) => {
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
  const [originalPhotos, setOriginalPhotos] = useState([]); // 원본 사진 (크롭용)
  const [showCropModal, setShowCropModal] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(null);
  const [certificateFile, setCertificateFile] = useState(null); // 기록증 파일
  const [certificateFileName, setCertificateFileName] = useState(''); // 기록증 파일명
  const [mapFile, setMapFile] = useState(null); // 지도 파일
  const [mapFileName, setMapFileName] = useState(''); // 지도 파일명
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
      setOriginalPhotos([]);
      setCertificateFile(null);
      // 편집 모드에서는 기존 기록증이 있으면 파일명만 표시 (URL은 유지)
      setCertificateFileName(editingRun.certificateFileName || (editingRun.certificateURL ? '기록증이 등록되어 있습니다.' : ''));
      setMapFile(null);
      // 편집 모드에서는 기존 지도가 있으면 파일명만 표시 (URL은 유지)
      setMapFileName(editingRun.mapFileName || (editingRun.mapURL ? '지도가 등록되어 있습니다.' : ''));

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

    // GIF 파일은 업로드 불가
    const nonGifFiles = files.filter((file) => {
      const isGifType = file.type === 'image/gif';
      const isGifName = file.name?.toLowerCase().endsWith('.gif');
      if (isGifType || isGifName) {
        showToast('GIF 형식의 이미지는 업로드할 수 없습니다. JPG/PNG 이미지를 사용해주세요.', 'error');
        return false;
      }
      return true;
    });
    const existingPhotoCount = photoPreviews.filter(p => p.startsWith('http')).length;
    const newPhotoCount = photos.length;
    const currentPhotoCount = existingPhotoCount + newPhotoCount;
    const availableSlots = 3 - currentPhotoCount;
    
    if (availableSlots <= 0) {
      showToast('사진은 최대 3장까지 추가할 수 있습니다.', 'error');
      e.target.value = '';
      return;
    }
    
    const filesToAdd = nonGifFiles.slice(0, availableSlots);
    
    // 원본 사진을 Base64로 변환하여 저장
    const originalPreviews = await Promise.all(filesToAdd.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    }));
    
    // 자동 크롭된 미리보기 생성 (정사각형)
    const croppedPreviews = await Promise.all(originalPreviews.map(async (base64) => {
      return await createSquarePreview(base64);
    }));
    
    setOriginalPhotos([...originalPhotos, ...originalPreviews]);
    setPhotos([...photos, ...filesToAdd]);
    setPhotoPreviews([...photoPreviews, ...croppedPreviews]);
    
    e.target.value = '';
  };

  // 정사각형 미리보기 생성 (자동 크롭)
  const createSquarePreview = async (imageSrc) => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.src = imageSrc;
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const size = Math.min(image.width, image.height);
        const x = (image.width - size) / 2;
        const y = (image.height - size) / 2;
        
        canvas.width = size;
        canvas.height = size;
        
        ctx.drawImage(image, x, y, size, size, 0, 0, size, size);
        
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(imageSrc); // 실패 시 원본 반환
              return;
            }
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(imageSrc);
            reader.readAsDataURL(blob);
          },
          'image/jpeg',
          0.9
        );
      };
      image.onerror = () => resolve(imageSrc);
    });
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
      setOriginalPhotos(originalPhotos.filter((_, i) => i !== photoIndex));
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
    const reorderedOriginalPhotos = [...originalPhotos];
    
    // draggedIndex와 dropIndex가 새로 추가한 사진 범위 내에 있는지 확인
    if (draggedIndex >= existingPhotoCount && dropIndex >= existingPhotoCount) {
      const photoIndex = draggedIndex - existingPhotoCount;
      const dropPhotoIndex = dropIndex - existingPhotoCount;
      const draggedPhoto = reorderedPhotos.splice(photoIndex, 1)[0];
      const draggedOriginal = reorderedOriginalPhotos.splice(photoIndex, 1)[0];
      reorderedPhotos.splice(dropPhotoIndex, 0, draggedPhoto);
      reorderedOriginalPhotos.splice(dropPhotoIndex, 0, draggedOriginal);
      setPhotos(reorderedPhotos);
      setOriginalPhotos(reorderedOriginalPhotos);
    } else if (draggedIndex < existingPhotoCount && dropIndex >= existingPhotoCount) {
      // 기존 사진을 새 사진 위치로 이동하는 경우는 photos 배열 변경 없음
    } else if (draggedIndex >= existingPhotoCount && dropIndex < existingPhotoCount) {
      // 새 사진을 기존 사진 위치로 이동하는 경우
      const photoIndex = draggedIndex - existingPhotoCount;
      const draggedPhoto = reorderedPhotos.splice(photoIndex, 1)[0];
      const draggedOriginal = reorderedOriginalPhotos.splice(photoIndex, 1)[0];
      reorderedPhotos.splice(0, 0, draggedPhoto);
      reorderedOriginalPhotos.splice(0, 0, draggedOriginal);
      setPhotos(reorderedPhotos);
      setOriginalPhotos(reorderedOriginalPhotos);
    }

    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleClose = () => {
    setIsOpen(false);
    if (onClose) {
      onClose();
    }
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
    setOriginalPhotos([]);
    setCertificateFile(null);
    setCertificateFileName('');
    setMapFile(null);
    setMapFileName('');
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
          // 새로 추가한 사진(Base64)은 업로드
          // Base64를 Blob으로 변환
          const response = await fetch(preview);
          const blob = await response.blob();
          const file = new File([blob], `photo_${i}.jpg`, { type: 'image/jpeg' });
          
          const compressed = await compressImage(file);
          const photoRef = ref(storage, `runs/${user.uid}/${Date.now()}_${Math.random()}`);
          await uploadBytes(photoRef, compressed);
          const url = await getDownloadURL(photoRef);
          photoURLs.push(url);
        }
      }

      // 기록증 업로드 (대회일 때만)
      let certificateURL = null;
      let finalCertificateFileName = '';
      if (runType === 'race') {
        if (certificateFile) {
          try {
            // 새로 업로드한 기록증
            const compressed = await compressImage(certificateFile);
            const certificateRef = ref(storage, `certificates/${user.uid}/${Date.now()}_${Math.random()}`);
            await uploadBytes(certificateRef, compressed);
            certificateURL = await getDownloadURL(certificateRef);
            finalCertificateFileName = certificateFileName || certificateFile.name;
          } catch (error) {
            console.error('기록증 업로드 실패:', error);
            showToast('기록증 업로드에 실패했습니다. 기록은 저장되지만 기록증은 저장되지 않았습니다.', 'error');
            // 기록증 업로드 실패해도 기록은 저장되도록 계속 진행
          }
        } else if (editingRun?.certificateURL) {
          // 기존 기록증 유지
          certificateURL = editingRun.certificateURL;
          finalCertificateFileName = editingRun.certificateFileName || '';
        }
      }

      // 지도 업로드 (일상/대회 모두)
      let mapURL = null;
      let finalMapFileName = '';
      if (mapFile) {
        try {
          // 새로 업로드한 지도
          const compressed = await compressImage(mapFile);
          const mapRef = ref(storage, `maps/${user.uid}/${Date.now()}_${Math.random()}`);
          await uploadBytes(mapRef, compressed);
          mapURL = await getDownloadURL(mapRef);
          finalMapFileName = mapFileName || mapFile.name;
        } catch (error) {
          console.error('지도 업로드 실패:', error);
          showToast('지도 업로드에 실패했습니다. 기록은 저장되지만 지도는 저장되지 않았습니다.', 'error');
          // 지도 업로드 실패해도 기록은 저장되도록 계속 진행
        }
      } else if (editingRun?.mapURL) {
        // 기존 지도 유지
        mapURL = editingRun.mapURL;
        finalMapFileName = editingRun.mapFileName || '';
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
        // 기록증 (대회일 때만)
        ...(runType === 'race' && certificateURL ? { 
          certificateURL, 
          certificateFileName: finalCertificateFileName
        } : {}),
        // 지도 (일상/대회 모두)
        ...(mapURL ? {
          mapURL,
          mapFileName: finalMapFileName
        } : {}),
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
      console.error('에러 상세:', error.message, error.code);
      showToast(`기록 저장에 실패했습니다: ${error.message || '알 수 없는 오류'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50"
          onClick={handleClose}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto modal-content"
            onClick={(e) => e.stopPropagation()}
          >
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

              {/* 지도 등록 (일상/대회 모두, 사진 위에) */}
              <div className="mb-4 sm:mb-6">
                <label className="block text-sm font-semibold text-navy-700 mb-2">지도 등록</label>
                <div className="bg-navy-50 rounded-lg border-2 border-navy-200 p-3 sm:p-4">
                  {mapFileName ? (
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm text-navy-600 truncate">{mapFileName}</p>
                        <p className="text-[10px] sm:text-xs text-navy-400 mt-1">지도가 등록되었습니다.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMapFile(null);
                          setMapFileName('');
                          document.getElementById('map-input').value = '';
                        }}
                        className="ml-3 px-3 sm:px-4 py-1.5 sm:py-2 bg-navy-600 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors whitespace-nowrap"
                      >
                        다시 첨부하기
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <div className="flex items-center justify-center py-2 sm:py-3 border-2 border-dashed border-navy-300 rounded-lg hover:border-navy-500 transition-colors">
                        <div className="text-center">
                          <svg className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 text-navy-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                          <p className="text-xs sm:text-sm text-navy-600 font-medium">지도 이미지 선택</p>
                        </div>
                      </div>
                      <input
                        id="map-input"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            setMapFile(file);
                            setMapFileName(file.name);
                          }
                          e.target.value = '';
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* 기록증 등록 (대회일 때만, 지도 아래) */}
              {runType === 'race' && (
                <div className="mb-4 sm:mb-6">
                  <label className="block text-sm font-semibold text-navy-700 mb-2">기록증 등록</label>
                  <div className="bg-navy-50 rounded-lg border-2 border-navy-200 p-3 sm:p-4">
                    {certificateFileName ? (
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm text-navy-600 truncate">{certificateFileName}</p>
                          <p className="text-[10px] sm:text-xs text-navy-400 mt-1">기록증이 등록되었습니다.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCertificateFile(null);
                            setCertificateFileName('');
                            document.getElementById('certificate-input').value = '';
                          }}
                          className="ml-3 px-3 sm:px-4 py-1.5 sm:py-2 bg-navy-600 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors whitespace-nowrap"
                        >
                          다시 첨부하기
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <div className="flex items-center justify-center py-2 sm:py-3 border-2 border-dashed border-navy-300 rounded-lg hover:border-navy-500 transition-colors">
                          <div className="text-center">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 text-navy-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <p className="text-xs sm:text-sm text-navy-600 font-medium">기록증 이미지 선택</p>
                          </div>
                        </div>
                        <input
                          id="certificate-input"
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              setCertificateFile(file);
                              setCertificateFileName(file.name);
                            }
                            e.target.value = '';
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">사진 (최대 3장)</label>
                <div className="grid grid-cols-3 gap-2">
                  {photoPreviews.map((preview, idx) => {
                    const isExistingPhoto = preview.startsWith('http');
                    return (
                      <div 
                        key={idx} 
                        className="relative aspect-square overflow-hidden rounded-lg border-2 border-navy-200 cursor-move"
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, idx)}
                        onDragEnd={handleDragEnd}
                        style={{ opacity: draggedIndex === idx ? 0.5 : 1 }}
                      >
                        <img 
                          src={preview} 
                          alt={`Photo ${idx + 1}`}
                          className="w-full h-full object-cover pointer-events-none" 
                        />
                        {/* 삭제 버튼 (우측 상단) */}
                        <button
                          type="button"
                          onClick={() => removePhoto(idx)}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 shadow-lg z-10"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        {/* 위치 조정 버튼 (좌측 하단) - 새로 추가한 사진만 */}
                        {!isExistingPhoto && (
                          <button
                            type="button"
                            onClick={() => {
                              const photoIndex = idx - photoPreviews.filter(p => p.startsWith('http')).length;
                              setCurrentPhotoIndex(photoIndex);
                              setShowCropModal(true);
                            }}
                            className="absolute bottom-2 left-2 bg-white bg-opacity-90 text-navy-700 px-3 py-1 rounded-full text-xs font-semibold hover:bg-opacity-100 shadow-lg flex items-center gap-1 z-10"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                            위치 조정
                          </button>
                        )}
                        {/* 번호 표시 (좌측 상단) */}
                        <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded z-10 pointer-events-none">
                          {idx + 1}
                        </div>
                      </div>
                    );
                  })}
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

      {/* 크롭 모달 */}
      {showCropModal && currentPhotoIndex !== null && originalPhotos[currentPhotoIndex] && (
        <PhotoCropModal
          photo={originalPhotos[currentPhotoIndex]}
          onComplete={async (croppedImage) => {
            // 크롭된 이미지로 미리보기 업데이트
            const updatedPreviews = [...photoPreviews];
            const existingPhotoCount = photoPreviews.filter(p => p.startsWith('http')).length;
            const previewIndex = existingPhotoCount + currentPhotoIndex;
            updatedPreviews[previewIndex] = croppedImage;
            setPhotoPreviews(updatedPreviews);
            
            // 모달 닫기
            setShowCropModal(false);
            setCurrentPhotoIndex(null);
          }}
          onCancel={() => {
            setShowCropModal(false);
            setCurrentPhotoIndex(null);
          }}
        />
      )}
    </>
  );
};

export default AddRunForm;
