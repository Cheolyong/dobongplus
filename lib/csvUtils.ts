import { Member } from './types';
import { calculateMonthlyFee } from './memberHelper';

// CSV 헤더 정의 (납부만료예정일 컬럼 추가)
const CSV_HEADERS = ['이름', '이메일', '연락처', '회원등급', '직책', '가족코드', '활동상태', '가동SNS', '가입일자', '납부만료예정일', '메모'];

// 회원 목록을 CSV 스트링으로 다운로드 가능한 포맷으로 인코딩 (Excel 한글 깨짐 방지용 UTF-8 BOM 포함)
export function exportToCSV(members: Member[]): string {
  const rows = [CSV_HEADERS];
  
  members.forEach(m => {
    rows.push([
      m.name,
      m.email,
      m.phone,
      m.grade,
      m.role,
      m.familyCode || '',
      m.status,
      m.snsProvider,
      m.joinDate,
      m.paymentExpiryDate || '',
      (m.memo || '').replace(/[\n\r,]/g, ' ') // 쉼표 및 개행 제거
    ]);
  });

  return rows.map(r => r.join(',')).join('\n');
}

// 업로드된 CSV 데이터를 분석하여 회원 객체 배열로 파싱 및 유효성 검증
export function parseCSV(csvText: string, currentMembers: Member[]): Member[] {
  const lines = csvText.trim().split('\n');
  if (lines.length <= 1) return [];

  const startIndex = lines[0].includes('이름') ? 1 : 0;
  const parsedMembers: Member[] = [];
  
  let nextId = Math.max(...currentMembers.map(m => m.id), 0) + 1;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns = line.split(',').map(col => col.trim());
    if (columns.length < 5) continue; // 최소 이름, 이메일, 연락처, 등급, 직책 필요

    const name = columns[0] || '이름없음';
    const email = columns[1] || `${Date.now()}_${i}@example.com`;
    const phone = columns[2] || '010-0000-0000';
    
    // 등급 파싱 및 방어
    let grade: Member['grade'] = '신입회원';
    if (['정회원', '준회원', '신입회원', '특별회원'].includes(columns[3])) {
      grade = columns[3] as Member['grade'];
    }

    // 직책 파싱 및 방어
    let role: Member['role'] = '일반회원';
    if (['회장', '총무', '감독', '일반회원', '고문'].includes(columns[4])) {
      role = columns[4] as Member['role'];
    }

    // 가족코드 유효성 검증 및 그룹 매칭 자동 연계 로직
    // 가족코드 컬럼이 비어있지 않고 값이 존재하면, 가족 코드로 묶어줍니다.
    const familyCode = columns[5] && columns[5] !== '' ? columns[5] : null;

    // 활동상태 파싱
    let status: Member['status'] = '가입대기';
    if (columns[6] && ['활동', '휴면', '가입대기'].includes(columns[6])) {
      status = columns[6] as Member['status'];
    }

    const snsProvider = (columns[7] && ['kakao', 'google', 'none'].includes(columns[7])) 
      ? (columns[7] as Member['snsProvider']) 
      : 'none';

    const joinDate = columns[8] || new Date().toISOString().split('T')[0];
    const paymentExpiryDate = columns[9] || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 임시 1달 부여
    const memo = columns[10] || 'CSV 대량 업로드 이관 회원';

    // 신규 생성 수동 ID 매칭
    // 나중에 가족 정회원 수에 맞게 일괄 갱신할 예정이므로 1로 임시 지정
    const calculatedFee = calculateMonthlyFee(grade, role, !!familyCode, 1);

    parsedMembers.push({
      id: nextId++,
      name,
      email,
      phone,
      profileImage: `https://picsum.photos/seed/uploader_${name}/150/150`,
      grade,
      role,
      familyCode,
      joinDate,
      status,
      snsProvider,
      snsId: snsProvider !== 'none' ? `sns_${Date.now()}_${nextId}` : null,
      monthlyFee: calculatedFee,
      paymentExpiryDate,
      memo
    });
  }

  // 업로드 시, 가족 그룹으로 함께 묶인 정회원들을 세어 할인 계산 보정작업 (3단계 요건)
  // 임포트 전체 및 현재 잔존 회원을 아우르는 맵핑 보정
  const totalCombined = [...currentMembers, ...parsedMembers];
  
  return parsedMembers.map(m => {
    if (m.familyCode && m.grade === '정회원') {
      const familyRegularCount = totalCombined.filter(
        f => f.familyCode === m.familyCode && f.grade === '정회원'
      ).length;
      return {
        ...m,
        monthlyFee: calculateMonthlyFee(m.grade, m.role, true, familyRegularCount)
      };
    }
    return m;
  });
}

// 샘플 CSV 파일 템플릿 반환
export function getSampleCSVTemplate(): string {
  return `${CSV_HEADERS.join(',')}
홍길동,gildong.hong@gmail.com,010-1425-3647,정회원,일반회원,FAM-2026-0003,활동,none,2026-05-01,2026-08-31,도봉 정형외과 원장
김순희,soonhee.kim@gmail.com,010-8596-7412,정회원,일반회원,FAM-2026-0003,활동,none,2026-05-01,2026-08-31,홍길동 회원의 배우자 (가족 할인 동시 수혜)
이영재,youngjae.lee@kakao.com,010-1203-4506,준회원,일반회원,,휴면,kakao,2025-04-12,2026-04-15,군입대 중으로 임시 준회원 상태 전환 (할인 인원 제외 대상 지정)`;
}
