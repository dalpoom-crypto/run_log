// URL 단축 유틸리티
// is.gd API를 사용하여 무료로 URL 단축 (API 키 불필요)

export const shortenUrl = async (longUrl) => {
  try {
    // is.gd API 사용 (무료, API 키 불필요)
    const response = await fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(longUrl)}`);
    const data = await response.json();
    
    if (data.shorturl) {
      return data.shorturl;
    } else {
      // 단축 실패 시 원본 URL 반환
      console.warn('URL 단축 실패:', data);
      return longUrl;
    }
  } catch (error) {
    console.error('URL 단축 오류:', error);
    // 오류 발생 시 원본 URL 반환
    return longUrl;
  }
};

// 게시글 URL 생성 (짧은 경로 형식)
export const getPostUrl = (runId) => {
  const baseUrl = window.location.origin;
  // 짧은 경로 형식 사용: /p/{runId}
  return `${baseUrl}/p/${runId}`;
};
