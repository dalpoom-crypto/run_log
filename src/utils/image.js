import imageCompression from 'browser-image-compression';

// 이미지 압축 함수
export const compressImage = async (file) => {
  const options = {
    maxSizeMB: 0.5,        // 최대 파일 크기 0.5MB
    maxWidthOrHeight: 1920, // 최대 가로/세로 1920px
    useWebWorker: true,    // 웹 워커 사용 (성능 향상)
    fileType: 'image/jpeg' // JPEG 형식으로 변환
  };

  try {
    const compressedFile = await imageCompression(file, options);
    return compressedFile;
  } catch (error) {
    console.error('이미지 압축 실패:', error);
    // 압축 실패 시 원본 파일 반환
    return file;
  }
};
