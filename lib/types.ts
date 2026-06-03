export interface Member {
  id: number;
  name: string;
  email: string;
  phone: string;
  profileImage: string;
  grade: '정회원' | '준회원' | '신입회원' | '특별회원';
  role: '회장' | '총무' | '감독' | '일반회원' | '고문';
  familyCode: string | null; // e.g. FAM-2026-0001
  joinDate: string;
  status: '활동' | '휴면' | '가입대기' | '탈퇴';
  snsProvider: 'kakao' | 'google' | 'none';
  snsId: string | null;
  monthlyFee: number; // calculated field or stored
  paymentExpiryDate: string; // 납부만료 예정일 (e.g. YYYY-MM-DD)
  memo?: string;
  joinYear?: string; // e.g. "2024"
  birthDate?: string; // e.g. "1994-08-15"
  address?: string; // e.g. "서울특별시 도봉구 방학동"
  tShirtSize?: 'SS(85)' | 'S(90)' | 'M(95)' | 'L(100)' | 'XL(105)' | '2XL(110)' | '3XL(115)' | '';
}

export interface Family {
  familyCode: string; // FAM-YYYY-XXXX
  familyName: string; // e.g. '김철수 & 김영희 가족'
  createdAt: string;
  description: string;
}
