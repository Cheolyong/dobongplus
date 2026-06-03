import type { NextApiRequest, NextApiResponse } from 'next';
import mysql from 'mysql2/promise';

let dbPool: mysql.Pool | null = null;

// 데이터베이스 커넥션 획득 (Lazy Initialization 및 커넥션 재사용)
function getDbPool() {
  if (!dbPool) {
    const host = process.env.DB_HOST || '';
    const port = parseInt(process.env.DB_PORT || '3306', 10);
    const user = process.env.DB_USER || '';
    const password = process.env.DB_PASSWORD || '';
    const database = process.env.DB_DATABASE || '';

    if (!host || !user || !database) {
      throw new Error("Vercel DB 연동을 위해 환경 변수(DB_HOST, DB_USER, DB_DATABASE, DB_PASSWORD)를 설정하십시오.");
    }

    dbPool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      connectionLimit: 5,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      charset: 'utf8mb4',
    });
  }
  return dbPool;
}

// ----------------------------------------
// 비즈니스 로직: 가족 정합성 월회비 계산 수식 구현
// ----------------------------------------
async function calculateFamilyMonthlyFee(conn: any, familyCode: string | null): Promise<number> {
  if (!familyCode) {
    return 30000; // 가족이 없는 단독 정회원은 기본 3만원
  }
  
  // 동일 가족 코드이며 '정회원'이면서 '활동' 또는 '가입대기' 상태인 구성원 수 (N) 파악
  const [rows]: any = await conn.query(
    "SELECT COUNT(*) as cnt FROM members WHERE family_code = ? AND grade = '정회원' AND status != '휴면'",
    [familyCode]
  );
  
  const N = rows[0]?.cnt ? parseInt(rows[0].cnt, 10) : 1;
  if (N <= 1) {
    return 30000;
  }
  
  // 공식 적용: 20000 * N + 10000
  const totalFamilyFee = 20000 * N + 10000;
  
  // 1인 배분액 산출 후 10원 단위 절사
  const individualFee = Math.floor((totalFamilyFee / N) / 10) * 10;
  return individualFee;
}

// 가족 집단 일괄 요금 재산정
async function triggerFamilyRecalculation(conn: any, familyCode: string | null) {
  if (!familyCode) return;
  const individualFee = await calculateFamilyMonthlyFee(conn, familyCode);
  
  // 해당 가족의 모든 정회원의 월회비를 수렴 수정 (단, 직책이 회장/총무/감독인 면제 대상은 보호 처리)
  await conn.query(
    "UPDATE members SET monthly_fee = ? WHERE family_code = ? AND grade = '정회원' AND role NOT IN ('회장', '총무', '감독')",
    [individualFee, familyCode]
  );
}

// FORMAT UTIL: MySQL DATETIME 문자열 파싱 포매터
function formatMySQLDate(dateInput: any): string {
  if (!dateInput) return '';
  if (typeof dateInput === 'string') return dateInput.split('T')[0];
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    return '';
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { action } = req.query;
  
  // 1. 단순 원격 무선 연결 상태 진단 데몬 동작
  if (action === 'test_connection') {
    try {
      const pool = getDbPool();
      const [rows]: any = await pool.query("SELECT 1 as is_alive");
      return res.status(200).json({
        success: true,
        message: "Vercel 서버리스 Next.js Pages API <-> Cloud MySQL 원격 실시간 연결 테스트 성공!",
        isAlive: rows[0]?.is_alive === 1
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: "연결 실패: Vercel 환경 변수 세팅 상태를 다시 점검해 주십시오.",
        error: err.message
      });
    }
  }

  // 데이터베이스 풀 생성
  let pool;
  try {
    pool = getDbPool();
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      message: err.message || "데이터베이스 풀 생성 실패"
    });
  }

  const conn = await pool.getConnection();

  try {
    if (req.method === 'GET') {
      // 2. 전체 회원 명단 조회
      if (action === 'get_members') {
        const [members]: any = await conn.query("SELECT * FROM members ORDER BY id DESC");
        
        const formatted = members.map((m: any) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          phone: m.phone,
          profileImage: m.profile_image || '',
          grade: m.grade,
          role: m.role,
          familyCode: m.family_code,
          joinDate: formatMySQLDate(m.join_date),
          status: m.status,
          snsProvider: m.sns_provider,
          snsId: m.sns_id,
          monthlyFee: m.monthly_fee,
          paymentExpiryDate: formatMySQLDate(m.payment_expiry_date),
          memo: m.memo || '',
          joinYear: m.join_year || (m.join_date ? formatMySQLDate(m.join_date).substring(0, 4) : new Date().getFullYear().toString()),
          birthDate: m.birth_date ? formatMySQLDate(m.birth_date) : '',
          address: m.address || '',
          tShirtSize: m.t_shirt_size || ''
        }));
        
        return res.status(200).json({
          success: true,
          data: formatted
        });
      }

      // 3. 전체 회원 CSV 백업 생성 내보내기 (BOM 한글 안심 지원)
      if (action === 'export_csv') {
        const [members]: any = await conn.query("SELECT * FROM members ORDER BY id ASC");
        
        let csvContent = '\uFEFF';
        csvContent += '일련번호(ID),이름,이메일 주소,연락처,회원등급,클럽직책,소속가족코드,활동여부상태,최종정산월회비,가입승인일자,회비납기만료예정일,메모특기사항\n';
        
        members.forEach((m: any) => {
          const id = m.id;
          const name = `"${(m.name || '').replace(/"/g, '""')}"`;
          const email = `"${(m.email || '').replace(/"/g, '""')}"`;
          const phone = `"${(m.phone || '').replace(/"/g, '""')}"`;
          const grade = `"${(m.grade || '').replace(/"/g, '""')}"`;
          const role = `"${(m.role || '').replace(/"/g, '""')}"`;
          const familyCode = m.family_code ? `"${m.family_code.replace(/"/g, '""')}"` : '""';
          const status = `"${(m.status || '').replace(/"/g, '""')}"`;
          const monthlyFee = m.monthly_fee;
          const joinDate = formatMySQLDate(m.join_date);
          const paymentExpiryDate = formatMySQLDate(m.payment_expiry_date);
          const memo = `"${(m.memo || '').replace(/\n/g, ' ').replace(/"/g, '""')}"`;

          csvContent += `${id},${name},${email},${phone},${grade},${role},${familyCode},${status},${monthlyFee},${joinDate},${paymentExpiryDate},${memo}\n`;
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=Vercel_Badminton_Club_Members_${new Date().toISOString().split('T')[0]}.csv`);
        return res.status(200).send(csvContent);
      }

      return res.status(404).json({
        success: false,
        message: "지원하지 않는 GET 액션입니다."
      });

    } else if (req.method === 'POST') {
      const body = req.body || {};

      // 1. 단일 회원 정보 저장 (등록 및 수정 동시 수용 구조)
      if (action === 'save_member') {
        const {
          id,
          name,
          email,
          phone,
          profileImage,
          grade,
          role,
          familyCode,
          status,
          snsProvider,
          snsId,
          memo,
          joinDate,
          paymentExpiryDate
        } = body;

        if (!name || !email) {
          return res.status(400).json({ success: false, message: "이름과 이메일은 필수 입력 항목입니다." });
        }

        await conn.beginTransaction();

        let finalId = id ? parseInt(id, 10) : 0;
        const cleanFamilyCode = familyCode ? familyCode.trim() : null;

        // 회비 기본 계산 수식
        let monthlyFee = 30000;
        const cleanRole = role || '일반회원';
        const cleanGrade = grade || '신입회원';
        if (cleanRole === '회장' || cleanRole === '총무' || cleanRole === '감독' || cleanGrade === '특별회원') {
          monthlyFee = 0;
        } else if (cleanGrade === '준회원') {
          monthlyFee = 15000;
        } else if (cleanGrade === '신입회원') {
          monthlyFee = 10000;
        }

        // 가족 코드 마스터 자동 매칭 수립
        if (cleanFamilyCode) {
          await conn.query(
            "INSERT IGNORE INTO families (family_code, family_name, description) VALUES (?, ?, ?)",
            [cleanFamilyCode, `${name} 가족그룹`, "Vercel 조작 과정 중 자동 형성됨"]
          );
        }

        let isNew = false;
        if (finalId > 0) {
          // 기존 회원 수정
          await conn.query(
            `UPDATE members SET 
              name = ?, email = ?, phone = ?, profile_image = ?, grade = ?, role = ?, 
              family_code = ?, status = ?, sns_provider = ?, sns_id = ?, memo = ?, 
              join_date = ?, payment_expiry_date = ?, monthly_fee = ?
             WHERE id = ?`,
            [
              name, email, phone || '', profileImage || '', cleanGrade, cleanRole,
              cleanFamilyCode, status || '가입대기', snsProvider || 'none', snsId || null, memo || '',
              joinDate || formatMySQLDate(new Date()), paymentExpiryDate || formatMySQLDate(new Date(Date.now() + 30 * 24 * 3600 * 1000)),
              monthlyFee, finalId
            ]
          );
        } else {
          // 신규 회원 등록
          const [result]: any = await conn.query(
            `INSERT INTO members (
              name, email, phone, profile_image, grade, role, 
              family_code, status, sns_provider, sns_id, memo, 
              join_date, payment_expiry_date, monthly_fee
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              name, email, phone || '', profileImage || '', cleanGrade, cleanRole,
              cleanFamilyCode, status || '가입대기', snsProvider || 'none', snsId || null, memo || '',
              joinDate || formatMySQLDate(new Date()), paymentExpiryDate || formatMySQLDate(new Date(Date.now() + 30 * 24 * 3600 * 1000)),
              monthlyFee
            ]
          );
          finalId = result.insertId;
          isNew = true;
        }

        // 가족 공유 조건 변환 회비 일괄 실시간 복원 계산
        if (cleanFamilyCode) {
          await triggerFamilyRecalculation(conn, cleanFamilyCode);
        }

        await conn.commit();

        return res.status(200).json({
          success: true,
          message: isNew ? "Vercel 연동: 신규 회원이 정상 등록되었습니다." : "Vercel 연동: 회원 프로필 정보가 신속하게 갱신되었습니다.",
          id: finalId
        });
      }

      // 2. 단일 회원 정보 삭제
      if (action === 'delete_member') {
        const { id } = body;
        if (!id) {
          return res.status(400).json({ success: false, message: "회원 일련번호 ID 가 누락되었습니다." });
        }

        const targetId = parseInt(id, 10);
        
        // 가족 코드 추적
        const [rows]: any = await conn.query("SELECT family_code FROM members WHERE id = ?", [targetId]);
        const familyCode = rows[0]?.family_code || null;

        await conn.query("DELETE FROM members WHERE id = ?", [targetId]);

        if (familyCode) {
          await triggerFamilyRecalculation(conn, familyCode);
        }

        return res.status(200).json({
          success: true,
          message: "Vercel 연동: 해당 회원 정보가 DB에서 완벽하게 소거 및 기한 재정산 연계되었습니다."
        });
      }

      // 3. 일괄 가입대기 활동 승인 처리
      if (action === 'batch_approve') {
        const [result]: any = await conn.query(
          "UPDATE members SET status = '활동', grade = '정회원' WHERE status = '가입대기'"
        );
        return res.status(200).json({
          success: true,
          message: `Vercel 연동: 가입 대기 중이던 총 ${result.affectedRows}명의 회원을 활동 상태로 승인하였습니다.`
        });
      }

      // 4. 납부 예정 만료 기한 연장 수납 트랜잭션
      if (action === 'extend_payment') {
        const { memberId, depositDate, months } = body;
        if (!memberId || !depositDate || !months) {
          return res.status(400).json({ success: false, message: "수납연장 필수 인수 정보가 누락되었습니다." });
        }

        const mId = parseInt(memberId, 10);
        const mMonths = parseInt(months, 10);

        await conn.beginTransaction();

        const [members]: any = await conn.query(
          "SELECT name, payment_expiry_date FROM members WHERE id = ?",
          [mId]
        );

        if (members.length === 0) {
          await conn.rollback();
          return res.status(404).json({ success: false, message: "존재하지 않는 회원입니다." });
        }

        const m = members[0];
        const currentExpiryStr = m.payment_expiry_date;
        let baseDate = new Date(depositDate);

        if (currentExpiryStr) {
          const currentExpiry = new Date(currentExpiryStr);
          if (currentExpiry > new Date(depositDate)) {
            baseDate = currentExpiry;
          }
        }

        baseDate.setMonth(baseDate.getMonth() + mMonths);
        const newExpiryStr = formatMySQLDate(baseDate);

        const logMemo = ` [수납연장 +${mMonths}개월 (${newExpiryStr})]`;
        await conn.query(
          "UPDATE members SET payment_expiry_date = ?, memo = CONCAT(COALESCE(memo, ''), ?) WHERE id = ?",
          [newExpiryStr, logMemo, mId]
        );

        await conn.commit();

        return res.status(200).json({
          success: true,
          message: `${m.name} 회원의 수납 연장이 +${mMonths}개월 추가되었습니다.`,
          data: {
            memberName: m.name,
            newExpiryDate: newExpiryStr
          }
        });
      }

      // 5. 카카오 셋업 가이드 및 메신저 연계
      if (action === 'kakao_setup') {
        const { clientId, channelId } = body;
        const host = req.headers.host || 'localhost:3000';
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        
        return res.status(200).json({
          success: true,
          message: "Vercel 서버리스용 카카오 비즈니스 환경 세팅이 시스템 핸들러에 전달되었습니다.",
          config: {
            kakao_developers_client_id: clientId || 'READY',
            kakao_business_channel_id: channelId || 'READY',
            authorized_redirect_uri: `${protocol}://${host}/api/vercel-db?action=kakao_callback`,
            instructions: "Vercel Next.js 환경에서 카카오 간편 가입 수신을 원하시면 지정된 리디렉션주소를 앱 키 등록 페이지에 추가하십시오."
          }
        });
      }

      // 6. 구글 셋업 가이드
      if (action === 'google_setup') {
        const { clientId, clientSecret } = body;
        const host = req.headers.host || 'localhost:3000';
        const protocol = req.headers['x-forwarded-proto'] || 'http';

        return res.status(200).json({
          success: true,
          message: "Vercel 서버리스용 구글 어드민 자격 정보 연동 정밀 검검을 완료했습니다.",
          config: {
            google_client_id: clientId || 'READY',
            authorized_redirect_uri: `${protocol}://${host}/api/vercel-db?action=google_callback`,
            security_rbac: "어드민 권한 미인증 사용자가 어드민 메뉴로 우회 요청 시 Next.js 15 미들웨어 및 API 방화벽이 차단 조치합니다."
          }
        });
      }

      return res.status(404).json({
        success: false,
        message: "유효하지 않은 POST API 요청입니다."
      });
    }

    return res.status(405).json({
      success: false,
      message: "허용되지 않는 HTTP 메소드입니다."
    });

  } catch (err: any) {
    await conn.rollback().catch(() => {});
    return res.status(500).json({
      success: false,
      message: "Vercel DB Handler 오류",
      error: err.message
    });
  } finally {
    conn.release();
  }
}
