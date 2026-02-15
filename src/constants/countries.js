export const COUNTRIES = [
  { code: 'KR', name: '대한민국', nameEn: 'South Korea' },
  { code: 'JP', name: '일본', nameEn: 'Japan' },
  { code: 'US', name: '미국', nameEn: 'United States' },
  { code: 'GB', name: '영국', nameEn: 'United Kingdom' },
  { code: 'FR', name: '프랑스', nameEn: 'France' },
  { code: 'DE', name: '독일', nameEn: 'Germany' },
  { code: 'IT', name: '이탈리아', nameEn: 'Italy' },
  { code: 'ES', name: '스페인', nameEn: 'Spain' },
  { code: 'CN', name: '중국', nameEn: 'China' },
  { code: 'TW', name: '대만', nameEn: 'Taiwan' },
  { code: 'HK', name: '홍콩', nameEn: 'Hong Kong' },
  { code: 'SG', name: '싱가포르', nameEn: 'Singapore' },
  { code: 'TH', name: '태국', nameEn: 'Thailand' },
  { code: 'VN', name: '베트남', nameEn: 'Vietnam' },
  { code: 'MY', name: '말레이시아', nameEn: 'Malaysia' },
  { code: 'ID', name: '인도네시아', nameEn: 'Indonesia' },
  { code: 'PH', name: '필리핀', nameEn: 'Philippines' },
  { code: 'AU', name: '호주', nameEn: 'Australia' },
  { code: 'NZ', name: '뉴질랜드', nameEn: 'New Zealand' },
  { code: 'CA', name: '캐나다', nameEn: 'Canada' },
  { code: 'MX', name: '멕시코', nameEn: 'Mexico' },
  { code: 'BR', name: '브라질', nameEn: 'Brazil' },
  { code: 'AR', name: '아르헨티나', nameEn: 'Argentina' },
  { code: 'CH', name: '스위스', nameEn: 'Switzerland' },
  { code: 'AT', name: '오스트리아', nameEn: 'Austria' },
  { code: 'NL', name: '네덜란드', nameEn: 'Netherlands' },
  { code: 'BE', name: '벨기에', nameEn: 'Belgium' },
  { code: 'SE', name: '스웨덴', nameEn: 'Sweden' },
  { code: 'NO', name: '노르웨이', nameEn: 'Norway' },
  { code: 'DK', name: '덴마크', nameEn: 'Denmark' },
  { code: 'FI', name: '핀란드', nameEn: 'Finland' },
  { code: 'PL', name: '폴란드', nameEn: 'Poland' },
  { code: 'CZ', name: '체코', nameEn: 'Czech Republic' },
  { code: 'GR', name: '그리스', nameEn: 'Greece' },
  { code: 'PT', name: '포르투갈', nameEn: 'Portugal' },
  { code: 'TR', name: '터키', nameEn: 'Turkey' },
  { code: 'RU', name: '러ussia', nameEn: 'Russia' },
  { code: 'AE', name: '아랍에미리트', nameEn: 'UAE' },
  { code: 'IN', name: '인도', nameEn: 'India' },
  { code: 'EG', name: '이집트', nameEn: 'Egypt' },
  { code: 'ZA', name: '남아프리카공화국', nameEn: 'South Africa' },
  { code: 'IL', name: '이스라엘', nameEn: 'Israel' },
];

export function searchCountries(query) {
  if (!query) return COUNTRIES;

  const lowerQuery = query.toLowerCase();
  return COUNTRIES.filter((country) =>
    country.name.toLowerCase().includes(lowerQuery) ||
    country.nameEn.toLowerCase().includes(lowerQuery)
  );
}

