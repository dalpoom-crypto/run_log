import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { compressImage } from '../utils/image';

const PhotoCropModal = ({ photo, onComplete, onCancel }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [loading, setLoading] = useState(false);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createCroppedImage = async (imageSrc, croppedAreaPixels) => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.src = imageSrc;
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;

        canvas.width = croppedAreaPixels.width;
        canvas.height = croppedAreaPixels.height;

        ctx.drawImage(
          image,
          croppedAreaPixels.x * scaleX,
          croppedAreaPixels.y * scaleY,
          croppedAreaPixels.width * scaleX,
          croppedAreaPixels.height * scaleY,
          0,
          0,
          croppedAreaPixels.width,
          croppedAreaPixels.height
        );

        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              reject(new Error('Canvas is empty'));
              return;
            }
            try {
              // Base64로 변환
              const reader = new FileReader();
              reader.onloadend = async () => {
                const base64 = reader.result;
                // Base64를 File로 변환하여 압축
                const response = await fetch(base64);
                const blobFromBase64 = await response.blob();
                const file = new File([blobFromBase64], 'cropped.jpg', { type: 'image/jpeg' });
                const compressed = await compressImage(file);
                // 압축된 File을 Base64로 다시 변환
                const compressedReader = new FileReader();
                compressedReader.onloadend = () => resolve(compressedReader.result);
                compressedReader.onerror = () => resolve(base64);
                compressedReader.readAsDataURL(compressed);
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            } catch (error) {
              reject(error);
            }
          },
          'image/jpeg',
          0.9
        );
      };
      image.onerror = reject;
    });
  };

  const handleConfirm = async () => {
    if (!croppedAreaPixels) {
      onComplete(photo); // 크롭 영역이 없으면 원본 반환
      return;
    }

    setLoading(true);
    try {
      const croppedImage = await createCroppedImage(photo, croppedAreaPixels);
      onComplete(croppedImage);
    } catch (error) {
      console.error('이미지 크롭 실패:', error);
      onComplete(photo); // 실패 시 원본 반환
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-[70] flex flex-col">
      {/* 상단 바 */}
      <div className="h-16 bg-black bg-opacity-70 flex items-center justify-between px-4 z-10">
        <div className="flex-1"></div>
        <h3 className="text-white font-semibold text-base flex-1 text-center">위치 조정</h3>
        <div className="flex-1 flex justify-end">
          <button
            onClick={onCancel}
            className="text-white hover:text-gray-300 transition-colors p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* 크롭 영역 */}
      <div className="flex-1 relative">
        <Cropper
          image={photo}
          crop={crop}
          zoom={zoom}
          aspect={1}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          cropShape="rect"
          showGrid={true}
          style={{
            containerStyle: {
              width: '100%',
              height: '100%',
              position: 'relative',
            },
          }}
        />
      </div>

      {/* 하단 컨트롤 */}
      <div className="h-32 bg-white px-4 py-4 flex flex-col gap-3">
        {/* 줌 슬라이더 */}
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-navy-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m0-6a3 3 0 106 0v6a3 3 0 11-6 0z"
            />
          </svg>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 h-2 bg-navy-200 rounded-lg appearance-none cursor-pointer"
          />
          <svg className="w-5 h-5 text-navy-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10V7m0 3h3m-3 0h-3"
            />
          </svg>
        </div>

        {/* 취소/확인 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3 rounded-lg bg-navy-100 text-navy-700 font-semibold hover:bg-navy-200 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 py-3 rounded-lg bg-navy-700 text-white font-semibold hover:bg-navy-800 transition-colors disabled:opacity-50"
          >
            {loading ? '처리 중...' : '확인'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhotoCropModal;
