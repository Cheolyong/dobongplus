import { Member } from './types';

// 회비 자동 계산 규칙 (도봉플러스 클럽)
// 1. 회원등급 기본 회비: 정회원 (30,000원), 준회원 (15,000원), 신입회원 (10,000원), 특별회원 (0원)
// 2. 직책 할인: 회장, 총무, 감독은 봉사에 대한 혜택으로 회비 100% 감면 (0원)
// 3. 가족 할인: 동일한 가족회원 ID를 가진 정회원 수를 N이라 할 때,
//    가족 정회원 총액은 (20000 * N + 10000)원 이며, 인당 '정산 월회비'는 총액을 N분할한 값입니다. (10원 단위 절사)
//    - 만약 가족 중 한 명이 '준회원(입대 등)'으로 등급이 변경되면 해당 인원은 N 카운트(할인 계산)에서 전면 제외되는 예외 처리를 보유합니다.
export function calculateMonthlyFee(
  grade: Member['grade'],
  role: Member['role'],
  hasFamily: boolean,
  familyRegularCount: number = 1
): number {
  if (role === '회장' || role === '총무' || role === '감독') {
    return 0;
  }

  if (grade === '특별회원') {
    return 0;
  }

  if (grade === '준회원') {
    return 15000;
  }

  if (grade === '신입회원') {
    return 10000;
  }

  // 정회원 요금제
  if (grade === '정회원') {
    if (hasFamily) {
      // N: 동일 가족 코드 그룹 내의 실질 '정회원' 수
      const N = Math.max(familyRegularCount, 1);
      const totalFamilyFee = 20000 * N + 10000;
      // 인당 월회비 분할 적용 (10원 단위 절사)
      return Math.floor((totalFamilyFee / N) / 10) * 10;
    }
    return 30000;
  }

  return 30000;
}

// 가족회원 ID 자동 생성 함수
// 규칙: FAM-[년도]-[시퀀스4자리] (예: FAM-2026-0004)
export function generateNextFamilyCode(existingMembers: Member[]): string {
  const currentYear = new Date().getFullYear();
  const prefix = `FAM-${currentYear}-`;
  
  // 기존 코드 중 현재 연도의 가장 높은 시퀀스 찾기
  let maxSeq = 0;
  existingMembers.forEach(m => {
    if (m.familyCode && m.familyCode.startsWith(prefix)) {
      const parts = m.familyCode.split('-');
      if (parts.length === 3) {
        const seqNum = parseInt(parts[2], 10);
        if (!isNaN(seqNum) && seqNum > maxSeq) {
          maxSeq = seqNum;
        }
      }
    }
  });

  const nextSeq = maxSeq + 1;
  const seqStr = String(nextSeq).padStart(4, '0');
  return `${prefix}${seqStr}`;
}

// 초기 더미 회원 목록 (납부만료 예정일 및 2026년 기준 실시간 상태값 부여)
export const INITIAL_MEMBERS: Member[] = [
  {
    id: 1,
    name: "강진우",
    email: "jinwoo.kang@kakao.com",
    phone: "010-1234-5678",
    profileImage: "https://picsum.photos/seed/user1/150/150",
    grade: "정회원",
    role: "회장",
    familyCode: null,
    joinDate: "2024-03-15",
    status: "활동",
    snsProvider: "google",
    snsId: "g_1029384756",
    monthlyFee: 0,
    paymentExpiryDate: "2026-12-31",
    memo: "클럽을 총괄하는 회장님입니다. 매월 열정적으로 참여 중.",
    joinYear: "2024",
    birthDate: "1984-05-20",
    address: "서울특별시 도봉구 쌍문동",
    tShirtSize: "L(100)"
  },
  {
    id: 2,
    name: "김민재",
    email: "minjae.kim@kakao.com",
    phone: "010-8765-4321",
    profileImage: "https://picsum.photos/seed/user2/150/150",
    grade: "정회원",
    role: "총무",
    familyCode: "FAM-2026-0001",
    joinDate: "2024-11-20",
    status: "활동",
    snsProvider: "kakao",
    snsId: "k_20394857",
    monthlyFee: 0,
    paymentExpiryDate: "2026-07-31",
    memo: "회계 및 총무 담당. 한지유 회원의 남편. 운영진 회비 면제 대상.",
    joinYear: "2024",
    birthDate: "1988-12-11",
    address: "서울특별시 도봉구 방학동",
    tShirtSize: "XL(105)"
  },
  {
    id: 3,
    name: "한지유",
    email: "jiyu.han@kakao.com",
    phone: "010-5566-7788",
    profileImage: "https://picsum.photos/seed/user3/150/150",
    grade: "정회원",
    role: "일반회원",
    familyCode: "FAM-2026-0001",
    joinDate: "2025-01-10",
    status: "활동",
    snsProvider: "kakao",
    snsId: "k_98765432",
    monthlyFee: 25000, // 가족 2명 정회원 적용으로 인당 (20000*2+10000)/2 = 25,000원
    paymentExpiryDate: "2026-06-30",
    memo: "김민재 회원의 아내. 부부 동반 가입에 따른 가족 할인(N=2, 2.5만원) 적용 대상자.",
    joinYear: "2025",
    birthDate: "1991-03-14",
    address: "서울특별시 도봉구 방학동",
    tShirtSize: "M(95)"
  },
  {
    id: 4,
    name: "이태호",
    email: "taeho.lee@google.com",
    phone: "010-9988-1122",
    profileImage: "https://picsum.photos/seed/user4/150/150",
    grade: "정회원",
    role: "감독",
    familyCode: null,
    joinDate: "2023-05-01",
    status: "활동",
    snsProvider: "google",
    snsId: "g_99887766",
    monthlyFee: 0,
    paymentExpiryDate: "2026-10-31",
    memo: "선수 출신 레슨 담당 감독님.",
    joinYear: "2023",
    birthDate: "1980-08-25",
    address: "서울특별시 노원구 상계동",
    tShirtSize: "L(100)"
  },
  {
    id: 5,
    name: "박서윤",
    email: "seoyun.park@kakao.com",
    phone: "010-3344-5566",
    profileImage: "https://picsum.photos/seed/user5/150/150",
    grade: "준회원", // '준회원' -> 가족 할인 카운트 N에서 배제
    role: "일반회원",
    familyCode: "FAM-2026-0002",
    joinDate: "2025-04-12",
    status: "활동",
    snsProvider: "kakao",
    snsId: "k_33441122",
    monthlyFee: 15000, // 준회원 고정금액 1.5만원 (정회원 할인에서 완전히 제외)
    paymentExpiryDate: "2026-04-15", // 데모용 기간 만료 상태
    memo: "박지호 회원의 누나. 개인 사정으로 가족 할인 정회원 카운트에서 배제됨.",
    joinYear: "2025",
    birthDate: "1994-07-07",
    address: "경기도 의정부시 신곡동",
    tShirtSize: "S(90)"
  },
  {
    id: 6,
    name: "박지호",
    email: "jiho.park@kakao.com",
    phone: "010-4455-6677",
    profileImage: "https://picsum.photos/seed/user6/150/150",
    grade: "신입회원",
    role: "일반회원",
    familyCode: "FAM-2026-0002",
    joinDate: "2026-02-18",
    status: "활동",
    snsProvider: "kakao",
    snsId: "k_44558899",
    monthlyFee: 10000, // 신입회원 1만원
    paymentExpiryDate: "2026-05-20", // 데모용 기간 만료 상태
    memo: "박서윤 회원의 남동생. 파워풀한 스매싱 보유 유망주.",
    joinYear: "2026",
    birthDate: "1997-11-03",
    address: "경기도 의정부시 신곡동",
    tShirtSize: "2XL(110)"
  },
  {
    id: 7,
    name: "최다은",
    email: "daeun.choi@kakao.com",
    phone: "010-1111-2222",
    profileImage: "https://picsum.photos/seed/user7/150/150",
    grade: "준회원",
    role: "일반회원",
    familyCode: null,
    joinDate: "2026-05-10",
    status: "가입대기",
    snsProvider: "kakao",
    snsId: "k_11112222_kakao",
    monthlyFee: 15000,
    paymentExpiryDate: "2026-06-15",
    memo: "카카오 간편가입 후 승인 대기 중인 신규 신청자.",
    joinYear: "2026",
    birthDate: "1999-04-22",
    address: "서울특별시 강북구 수유동",
    tShirtSize: "SS(85)"
  },
  {
    id: 8,
    name: "정동원",
    email: "dongwon@daum.net",
    phone: "010-7777-8888",
    profileImage: "https://picsum.photos/seed/user8/150/150",
    grade: "특별회원",
    role: "고문",
    familyCode: null,
    joinDate: "2021-01-01",
    status: "활동",
    snsProvider: "none",
    snsId: null,
    monthlyFee: 0,
    paymentExpiryDate: "2027-12-31",
    memo: "초대 회장 및 클럽 창립 공로 고문. 특별회원 면제.",
    joinYear: "2021",
    birthDate: "1960-01-01",
    address: "경기도 남양주시 와부읍",
    tShirtSize: "XL(105)"
  }
];
