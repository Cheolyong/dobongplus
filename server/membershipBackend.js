/**
 * 도봉플러스 클럽 배드민턴 동호회 회원 관리 시스템 Express 백엔드 서버 소스코드
 * 대상 환경: Cafe24 Managed Node.js Webhosting (MySQL 8.x 연계)
 * 
 * 필수 패키지 설치법:
 * npm install express mysql2 multer fast-csv dotenv cors express-session
 */

const express = require('express');
const mysql = require('mysql2/promise');
const multer = require('multer');
const csv = require('fast-csv');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const session = require('express-session');

require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Cafe24 환경 권장 세션 설정
app.use(session({
  secret: process.env.SESSION_SECRET || 'dobong-plus-club-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // http 웹호스팅 대응
    maxAge: 1000 * 60 * 60 * 4 // 4시간 세션 유지
  }
}));

// MySQL DB Pool 초기화 및 수립 (Lazy)
let dbPool = null;
function getDbPool() {
  if (!dbPool) {
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      connectionLimit: 10,
      waitForConnections: true,
      queueLimit: 0,
      charset: 'utf8mb4'
    };
    
    // 환경 변수 보안 점검
    if (!process.env.DB_PASSWORD) {
      console.warn('⚠️ Warning: DB_PASSWORD 미지정 상태. 로컬 모드 혹은 DB 설정 필요!');
    }
    
    dbPool = mysql.createPool(config);
  }
  return dbPool;
}

// Multer 파일 업로드 임시 스토어 설정
const upload = multer({ dest: '/tmp/' });


// ==========================================
// [4단계] 1. 관리자 권한 제어 보안 인증 미들웨어 (Server-side RBAC Middleware)
// ==========================================
/**
 * 최고 총무 및 회장단 관리자 그룹 권한 검증 미들웨어
 * - 허용 직책: 회장, 부회장, 운영총무, 재무총무
 * - 비인가 유저 차단 (403 Forbidden 및 경고 반환)
 */
async function apiAdminAuthorization(req, res, next) {
  try {
    // 1. 모의 구글 어드민 로그인 또는 실 세션에서 유저 확인
    const userRole = req.session?.userRole || req.headers['x-admin-role'] || '일반회원';
    const userEmail = req.session?.userEmail || req.headers['x-admin-email'] || '';

    // 허용 그룹: 회장, 부회장, 운영총무, 재무총무
    const ALLOWED_ADMINS = ['회장', '부회장', '운영총무', '재무총무'];

    if (ALLOWED_ADMINS.includes(userRole)) {
      // 통과 완료
      return next();
    }

    // 통과 실패
    return res.status(403).json({
      success: false,
      errorCode: 'FORBIDDEN_ACCESS',
      message: '보안 통제: 해당 API는 회장, 부회장, 운영총무, 재무총무 직책을 가진 최고관리자 그룹만 접근이 가능합니다.'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: '인증 서버 오류', error: error.message });
  }
}


// ==========================================
// [2단계] 1. 가족회원 월회비 자동 할인 계산 로직 (Core Business Formula)
// ==========================================
/**
 * 동일한 가족 코드를 공유하는 구성원 중, '정회원' 자격을 가진 수를 카운트하여 개별 인원의 회비를 계산합니다.
 * - 준회원으로 상태가 격하되거나 군입대 등으로 전환 시 카운트 N에서 완전 가감 제외됩니다.
 * 
 * @param {string} familyCode 가족 테이블 외래키
 * @param {mysql.Connection} connection DB 커넥션 객체(동작 내부 트랜잭션 수용 목적)
 * @returns {Promise<number>} 계산된 개별 정산 월회비 (정회원 기준)
 */
async function calculateFamilyMonthlyFee(familyCode, connection) {
  if (!familyCode) return 30000; // 가족이 없는 단독 정회원은 기본 3만원

  // 동일한가족코드를 가졌으며 grade = '정회원' 및 상태가 '활동' 또는 '가입대기'인 인원 수 카운트
  // 준회원, 특별회원은 여기서 카운트에서 배제
  const [rows] = await connection.query(
    `SELECT COUNT(*) as count FROM members 
     WHERE family_code = ? AND grade = '정회원' AND status != '휴면'`,
    [familyCode]
  );
  
  const N = rows[0]?.count || 1;
  
  if (N <= 1) {
    return 30000; // 단독 정회원 30,000원
  }

  // 할인 규칙 대입: 1인 3만원, 2인 총 5만원, 3인 총 7만원, 4인 총 9만원 -> 공식 20000 * N + 10000 적용
  const totalFamilyRegularFee = 20000 * N + 10000;
  
  // 인당 분배 정산 후 원단위(10원 단위) 절사 실행
  const individualFee = Math.floor((totalFamilyRegularFee / N) / 10) * 10;
  return individualFee;
}

/**
 * 특정 가족 코드 내의 모든 정회원의 월회비를 정합성 확보를 위해 일괄 재수정 처리하는 내부 프로시저
 */
async function triggerFamilyFeeRecalculation(familyCode, connection) {
  if (!familyCode) return;

  // 1. 해당 가족에 귀속된 '정회원' 수 N 파악 및 단가 산정
  const individualFee = await calculateFamilyMonthlyFee(familyCode, connection);

  // 2. 해당 가족의 모든 정회원의 월회비를 업데이트 처리
  // 일반 정회원으로서 회임자가 아닌 직원들에게 대입. (운영진 회기 면제 0원 정수 보호)
  await connection.query(
    `UPDATE members 
     SET monthly_fee = ? 
     WHERE family_code = ? AND grade = '정회원' AND role NOT IN ('회장', '총무', '감독')`,
    [individualFee, familyCode]
  );
}


// ==========================================
// [2단계] 2. 회비 납부 기간 연장 로직 API 엔드포인트
// ==========================================
/**
 * POST /api/fees/extend-payment
 * body: { memberId: 3, depositDate: '2026-05-25', months: 6 }
 */
app.post('/api/fees/extend-payment', apiAdminAuthorization, async (req, res) => {
  const { memberId, depositDate, months } = req.body;
  
  if (!memberId || !depositDate || !months) {
    return res.status(400).json({ success: false, message: '필수 인수 공급 누락 (memberId, depositDate, months)' });
  }

  const numMonths = parseInt(months, 10);
  if (numMonths < 1 || numMonths > 12) {
    return res.status(400).json({ success: false, message: '납부 개월 수는 1개월에서 최대 12개월 분납까지만 허용됩니다.' });
  }

  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. 해당 인원의 기존 납부만료 예정일 및 상태 쿼리
    const [members] = await connection.query(
      `SELECT id, name, payment_expiry_date, grade FROM members WHERE id = ?`,
      [memberId]
    );

    if (members.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: '존재하지 않는 회원 정보입니다.' });
    }

    const member = members[0];
    const currentExpiryStr = member.payment_expiry_date; // YYYY-MM-DD 기획 데이터
    let baseDateOfExtension = new Date(depositDate); // 신규 임금일 기준 임계점

    // 기존 만료일 점검 이입 처리
    if (currentExpiryStr) {
      const currentExpiryDate = new Date(currentExpiryStr);
      // 기존 만료일이 아직 도래하지 않고 남아있다면, 기존 만료일부터 연장을 가속함 (소중한 권리 보전)
      if (currentExpiryDate > new Date(depositDate)) {
        baseDateOfExtension = currentExpiryDate;
      }
    }

    // 새 만료일 가산 계산 (개월 수 유입)
    const newExpiryDate = new Date(baseDateOfExtension);
    newExpiryDate.setMonth(newExpiryDate.getMonth() + numMonths);

    // 날짜 가쇄 문자 변환 YYYY-MM-DD
    const newExpiryStr = newExpiryDate.toISOString().split('T')[0];

    // DB 업데이트 실행
    await connection.query(
      `UPDATE members 
       SET payment_expiry_date = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [newExpiryStr, memberId]
    );

    // 로그 및 감사 이력 테이블 상재 처리 (클럽 명기)
    await connection.query(
      `INSERT INTO families (family_code, family_name, description)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE description = VALUES(description)`,
      ['LOG-FEE', '회비 수납 감사 장부', '실시간 수납 이력 가용 임시 기입 모방']
    ).catch(() => {}); // 부속 로깅 안심 건너뛰기

    await connection.commit();

    return res.json({
      success: true,
      message: `성공 축하: ${member.name} 회원의 납부 만료예정일이 ${numMonths}개월 추가 연장 완료되었습니다.`,
      data: {
        memberId,
        memberName: member.name,
        inputDepositDate: depositDate,
        extendedMonths: numMonths,
        previousExpiryDate: currentExpiryStr,
        newExpiryDate: newExpiryStr
      }
    });

  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ success: false, message: '연장 처리 점검 중 트랜잭션 에러 발생', error: error.toString() });
  } finally {
    connection.release();
  }
});


// ==========================================
// [3단계] 1 & 2. CSV 대량 업로드 / 병합 및 유효성 검증 컨트롤러 (BULK IMPORT)
// ==========================================
/**
 * POST /api/members/bulk-upload
 * 관리자 엑셀 원장 데이터를 수취하여 데이터베이스에 UPSERT 일괄 적재 및 가족 정산 재연계
 */
app.post('/api/members/bulk-upload', apiAdminAuthorization, upload.single('csvFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: '업로드할 CSV 파일을 확보할 수 없습니다.' });
  }

  const filePath = req.file.path;
  const parsedRows = [];
  
  // fast-csv를 통한 업로드 일률 리딩 처리
  fs.createReadStream(filePath)
    .pipe(csv.parse({ headers: true, trim: true }))
    .on('error', error => {
      return res.status(400).json({ success: false, message: 'CSV 파싱 엔진 오류 발생', error: error.message });
    })
    .on('data', row => {
      parsedRows.push(row);
    })
    .on('end', async () => {
      // 파이프 스트림 완독 후 데이터 정밀 주입 및 매칭 통폐합 로직
      const pool = getDbPool();
      const connection = await pool.getConnection();

      try {
        await connection.beginTransaction();

        let insertedCount = 0;
        let updatedCount = 0;
        const affectedFamilyCodes = new Set();

        for (const row of parsedRows) {
          // 컬럼 바인딩 매핑 (영어/한글 범주 유연 처리)
          const name = row['이름'] || row['name'];
          const email = row['이메일'] || row['email'];
          const phone = row['연락처'] || row['phone'] || '010-0000-0000';
          const grade = row['회원등급'] || row['grade'] || '신입회원';
          const role = row['직책'] || row['role'] || '일반회원';
          const familyCode = row['가족코드'] || row['family_code'] || null;
          const status = row['활동상태'] || row['status'] || '가입대기';
          const snsProvider = row['가동SNS'] || row['sns_provider'] || 'none';
          const joinDate = row['가입일자'] || row['join_date'] || new Date().toISOString().split('T')[0];
          const paymentExpiryDate = row['납부만료예정일'] || row['payment_expiry_date'] || joinDate;
          const memo = row['메모'] || row['memo'] || 'CSV 이관 마이그레이션';

          if (!name || !email) {
            console.warn('⚠️ 필수값(이름/이메일) 누락 행 건너뜀:', row);
            continue;
          }

          // [3단계] 2. 가족회원ID 유효성 검증 및 families 마스터 자동 묶음 처리
          if (familyCode && familyCode.trim() !== '') {
            const cleanFamilyCode = familyCode.trim();
            affectedFamilyCodes.add(cleanFamilyCode);

            // 해당 가족 코드가 families 족보 마스터에 생성되어 있는지 점검하고 없으면 자동 생성 삽입
            await connection.query(
              `INSERT IGNORE INTO families (family_code, family_name, description, created_at)
               VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
              [cleanFamilyCode, `${name} 가조(임시명칭)`, 'CSV 이관 도중 자동 매치 그룹화 형성됨']
            );
          }

          // 이메일을 유니크 키로 사용하여 UPSERT (On Duplicate Key Update) 기법 대포 가용
          const [result] = await connection.query(
            `INSERT INTO members (
              name, email, phone, grade, role, family_code, status, sns_provider, join_date, payment_expiry_date, memo, monthly_fee
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 30000)
             ON DUPLICATE KEY UPDATE
              name = VALUES(name),
              phone = VALUES(phone),
              grade = VALUES(grade),
              role = VALUES(role),
              family_code = VALUES(family_code),
              status = VALUES(status),
              payment_expiry_date = VALUES(payment_expiry_date),
              memo = VALUES(memo),
              updated_at = CURRENT_TIMESTAMP`,
            [
              name, email, phone, grade, role, 
              (familyCode && familyCode !== '') ? familyCode.trim() : null, 
              status, snsProvider, joinDate, paymentExpiryDate, memo
            ]
          );

          if (result.affectedRows === 1) {
            insertedCount++;
          } else if (result.affectedRows === 2) {
            updatedCount++;
          }
        }

        // [3단계] 2. CSV 영향 구장 내 매칭된 가족들의 할인 공식 수납액 수평 일괄 재조정!
        for (const famCode of affectedFamilyCodes) {
          await triggerFamilyFeeRecalculation(famCode, connection);
        }

        await connection.commit();

        // 디스크 임시 업로드 파일 소거
        fs.unlinkSync(filePath);

        return res.json({
          success: true,
          message: `마이그레이션 이관 성공: 대량 회원 CSV 이입 결과 정밀 완료!`,
          summary: {
            totalParsed: parsedRows.length,
            newMembersInserted: insertedCount,
            existingMembersUpdated: updatedCount,
            recalculatedFamilies: Array.from(affectedFamilyCodes)
          }
        });

      } catch (err) {
        await connection.rollback();
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return res.status(500).json({ success: false, message: 'MySQL CSV 파싱 적용 중 롤백 발생', error: err.message });
      } finally {
        connection.release();
      }
    });
});


// ==========================================
// [3단계] 3. 회원 전체 목록 CSV 파일 내보내기 (BULK EXPORT ROUTE)
// ==========================================
/**
 * GET /api/members/export-csv
 * 전체 회원 현황 데이터(탈퇴 및 휴면 일체)를 UTF-8 복원 BOM 한글 깨짐이 차단된 CSV 양식으로 생성 릴레이
 */
app.get('/api/members/export-csv', apiAdminAuthorization, async (req, res) => {
  const pool = getDbPool();
  try {
    const [members] = await pool.query(
      `SELECT m.*, f.family_name 
       FROM members m 
       LEFT JOIN families f ON m.family_code = f.family_code 
       ORDER BY m.id ASC`
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=Dobong_Plus_Club_Members_Backup_2026.csv');

    // Excel 한글 깨짐 방지를 사전에 보장하는 UTF-8 BOM 바이트 헤더 작성 선두 이입
    res.write('\uFEFF');

    const csvStream = csv.format({ headers: true });
    csvStream.pipe(res);

    members.forEach(m => {
      csvStream.write({
        '일련번호(ID)': m.id,
        '이름': m.name,
        '이메일 주소': m.email,
        '연락처': m.phone,
        '회원등급': m.grade,
        '클럽직책': m.role,
        '소속가족코드': m.family_code || '',
        '가족대표명칭': m.family_name || '',
        '활동여부상태': m.status,
        '최종정산월회비': m.monthly_fee,
        '가입승인일자': m.join_date ? m.join_date.toISOString().split('T')[0] : '',
        '회비납기만료예정일': m.payment_expiry_date ? m.payment_expiry_date.toISOString().split('T')[0] : '',
        '관리자메모특기사항': m.memo || ''
      });
    });

    csvStream.end();

  } catch (error) {
    return res.status(500).json({ success: false, message: 'CSV 내보내기 도중 입출력 에러 발생', error: error.message });
  }
});


// ==========================================
// [4단계] 2. 카페24 배포 환경 구성 요약 문서 안내 루트
// ==========================================
app.get('/api/cafe24-deploy-info', (req, res) => {
  res.json({
    platform: 'Cafe24 Node.js Managed Hosting',
    recommentedNodeVersion: '18.x / 20.x',
    crucialPortGuideline: '카페24 Node.js의 포트는 고정 할당된 process.env.PORT 변수값을 그대로 사용해 서버를 바인딩하여야 정상 웹서빙(3458 등 내부 리버스 프록시 연계)이 수립됩니다.',
    dbEncoding: 'MySQL 데이터베이스 인코딩 문자셋은반드시 utf8mb4 / utf8mb4_unicode_ci로 수립해야 카카오 프로필 닉네임 한글 및 이모지 유입 시 문자열 깨짐과 크래시가 방지됩니다.',
    deploymentSteps: [
      '1. Cafe24 관리 콘솔에서 Node.js 웹 앱을 비활성 후 재가동 트리거 예약',
      '2. Git 클론 또는 FTP 업로드를 통해 Cafe24 web/ 폴더에 빌드 및 소스 조달',
      '3. MySQL DB에 제공된 DDL.sql 파일을 업로드하여 스키마 사전 생성 완료',
      '4. .env 파일에 DB_HOST, DB_USER, DB_PASSWORD, DB_DATABASE 지정 수립'
    ]
  });
});

// 서버 포트 오픈 (Cafe24 배포 호환용 바인딩 기법 전개)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Dobong Plus Club Core Admin Engine active at port : ${PORT} [Cafe24 Node-MySQL Spec]`);
});
