export const MYSQL_DDL = `-- 배드민턴 동호회 회원 관리 시스템 Database DDL
-- 대상 DBMS: MySQL 8.x / MariaDB 10.x 이상 (Cafe24 Managed Node.js Webhosting DB)
-- 문자셋: utf8mb4_unicode_ci (이모지 및 완벽한 한글 지원)

-- 1. 가족 테이블 (families)
-- 가족회원 그룹을 고유 코드로 묶어주고 관리하기 위한 구조입니다.
CREATE TABLE IF NOT EXISTS \`families\` (
  \`family_code\` VARCHAR(20) NOT NULL COMMENT '가족고유코드 (예: FAM-2026-0001)',
  \`family_name\` VARCHAR(100) NOT NULL COMMENT '가족 대표 명칭 (예: 김민재&한지유 가족)',
  \`description\` VARCHAR(255) NULL COMMENT '가족 관계에 대한 비고 또는 메모',
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '최초 생성 일자',
  \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '마지막 수정 일자',
  PRIMARY KEY (\`family_code\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='가족회원 그룹 정보 및 코드 관리 테이블';

-- 2. 회원 테이블 (members)
-- 카카오 연동 고유 SNS 식별정보 및 등급, 직책, 그리고 가족코드 외래키를 보유하는 구조입니다.
CREATE TABLE IF NOT EXISTS \`members\` (
  \`id\` INT AUTO_INCREMENT NOT NULL COMMENT '회원 고유 일련번호(PK)',
  \`name\` VARCHAR(50) NOT NULL COMMENT '회원 실명',
  \`email\` VARCHAR(100) NOT NULL COMMENT '이메일 주소(고유인증 및 카카오 수신용)',
  \`phone\` VARCHAR(20) NOT NULL COMMENT '연락처 (예: 010-XXXX-XXXX)',
  \`profile_image\` VARCHAR(255) NULL COMMENT '프로필 이미지 URL (카카오 프로필 연동 또는 개별 등록)',
  \`grade\` ENUM('정회원', '준회원', '신입회원', '특별회원') NOT NULL DEFAULT '신입회원' COMMENT '회원 자격 등급',
  \`role\` ENUM('회장', '총무', '감독', '일반회원', '고문') NOT NULL DEFAULT '일반회원' COMMENT '클럽 운영진/직책',
  \`family_code\` VARCHAR(20) NULL COMMENT '소속 가족회원 ID 코드 (가족 테이블 외래키)',
  \`status\` ENUM('활동', '휴면', '가입대기') NOT NULL DEFAULT '가입대기' COMMENT '활동 상태',
  \`sns_provider\` ENUM('kakao', 'google', 'none') NOT NULL DEFAULT 'none' COMMENT '소셜 로그인 제공처',
  \`sns_id\` VARCHAR(150) NULL COMMENT '소셜 연동 유니크 식별 아이디',
  \`monthly_fee\` INT NOT NULL DEFAULT 10000 COMMENT '자동 또는 수동으로 책정된 매월 회비',
  \`join_date\` DATE NOT NULL COMMENT '가입 승인일 또는 가입일자',
  \`memo\` TEXT NULL COMMENT '회원 특이사항 및 관리자 작성 메모',
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'DB 생성 시점',
  \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'DB 갱신 시점',
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uq_member_email\` (\`email\`),
  UNIQUE KEY \`uq_sns_identity\` (\`sns_provider\`, \`sns_id\`),
  CONSTRAINT \`fk_members_family\` FOREIGN KEY (\`family_code\`) 
    REFERENCES \`families\` (\`family_code\`) 
    ON DELETE SET NULL 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='배드민턴 클럽 회원 핵심 원장 테이블';

-- 3. 고속 조회를 위한 인덱스 설계
-- 소속 가족단위 필터링, 실명 검색, 소셜 인증 고속화를 사전에 고려한 최적화 인덱스입니다.
CREATE INDEX \`idx_members_family_code\` ON \`members\` (\`family_code\`);
CREATE INDEX \`idx_members_status_grade\` ON \`members\` (\`status\`, \`grade\`);
CREATE INDEX \`idx_members_name\` ON \`members\` (\`name\`);
`;

export const KAKAO_OAUTH_FLOW_EXPLANATION = `
### 1. 카카오 로그인(Kakao OAuth 2.0) 웹호스팅 연동 흐름
가입 신청 시 사용자의 카카오 프로필 정보를 안전하게 가져와 \`members\` 테이블의 대기 회원으로 신규 삽입하는 흐름입니다.

1. **카카오 디벨로퍼스 애플리케이션 등록**
   - 카카오 디벨로퍼스(developers.kakao.com) 가입 후 내 애플리케이션을 생성합니다.
   - **플랫폼 > Web 플랫폼 등록**: 서비스 도메인으로 Cafe24 호스팅 도메인(예: \`http://yourdomain.cafe24.com\`)을 입력합니다.
   - **카카오 로그인 활성화**: '활성화 설정'을 \`ON\`으로 전환합니다.
   - **Redirect URI 설정**: 백엔드 콜백 API 경로 등록 (예: \`http://yourdomain.cafe24.com/api/auth/kakao/callback\`).

2. **동의 항목 설정 (인가 항목)**
   - 프로필 정보(닉네임, 프로필 이미지) 필수 수집 허용.
   - 카카오 계정(이메일) 선택 또는 필수 수집 허용.

3. **인증 흐름 시나리오 (Cafe24 백엔드 Express 구현)**
   - **A. 사용자 요청**: 사용자가 '카카오 연동 가입'을 클릭하면 프론트에서 아래 주소로 리다이렉트합니다.
     \`https://kauth.kakao.com/oauth/authorize?client_id=\${REST_API_KEY}&redirect_uri=\${REDIRECT_URI}&response_type=code\`
   - **B. 인가 코드 수신**: 사용자가 동의 완료하면 카카오가 Redirect URI로 \`code\`(인가코드)를 파라미터로 붙여 호출합니다.
   - **C. Access Token 요청 (Express 백엔드)**: 백엔드는 받은 \`code\`를 가지고 카카오 성명 서버에 POST 요청을 보내 \`access_token\`을 발급받습니다.
   - **D. 사용자 프로필 조회**: 발급받은 Token을 헤더에 실어 \`https://kapi.kakao.com/v2/user/me\` API를 호출함으로써 유저의 고유 성명, 카카오 이메일, 프로필사진 정보를 수집합니다.
   - **E. DB 저장**: 수집된 성명 및 이메일을 가지고 가입 폼을 완성하거나 즉시 \`status = '가입대기'\`, \`sns_provider = 'kakao'\` 형태로 회원 테이블에 안전히 인서트(Insert)합니다.
`;

export const GOOGLE_OAUTH_FLOW_EXPLANATION = `
### 2. 구글 어드민 로그인(Google OAuth 2.0) 연동 흐름
동호회의 신뢰성 있는 소수 총무/관리자만이 회원명부를 관리해야 하므로 백엔드에서 사전에 예약된 구글 ID 목록 또는 라이선스 이메일 계정만 어드민 통과 코드를 부여합니다.

1. **Google Cloud Console 프로젝트 등록**
   - Google API Console에서 프로젝트 등록 및 OAuth 동의 화면 구성.
   - 자격증명 > OAuth 2.0 클라이언트 ID 생성 (Web 애플리케이션용).
   - **승인된 리디렉션 URI**: \`http://yourdomain.cafe24.com/api/auth/google/callback\`.

2. **권한 필터 구현 (Express Middleware)**
   - 사용자 인증 완료 후 수신한 Google \`email\` 주소를 추출합니다.
   - DB의 사전에 승인된 관리자 목록 테이블(\`admins\`) 혹은 백엔드 환경 설정에 등록된 '관리자 허용 이메일 배열(관리 후보지 주소)'과 유효성이 일치하는지 조인 또는 체크하여, 일치할 경우에만 세션이나 세큐어 쿠키에 어드민 자격(JWT 토큰 등)을 주입합니다.
`;

export const FAMILY_CODE_ALGORITHM_EXPLANATION = `
### 3. 가족회원 ID 코드 자동 생성 및 매칭 알고리즘
가족 관계를 투명하게 증명하고 20%의 회비 할인을 차감 정산하기 위해 독창적으로 매칭하는 시나리오입니다.

1. **규칙성 정의**: \`FAM-YYYY-XXXX\`
   - \`FAM-\`: 가족(Family) 그룹을 뜻하는 고정 프리픽스.
   - \`YYYY\`: 해당 가족 그룹이 최초 매칭(체결)되어 등록된 연도 (예: \`2026\`).
   - \`XXXX\`: 당해 연도 내에 생성된 가족들의 순차 증가 4자리 일련번호 (예: \`0001\`, \`0002\`).

2. **자동 발급 매칭 시나리오**:
   - **신규 가족 생성 시**: 매칭할 기존 가족 없이 회원 등록/수정에서 '새로운 가족 추가' 버튼을 눌렀을 경우,
     백엔드는 DB에서 \`SELECT MAX(family_code) FROM families WHERE family_code LIKE 'FAM-2026-%'\` 쿼리를 실행하여 최신 시퀀스를 산출하고, 1을 더해 \`FAM-2026-0003\` 형태의 신규 유니크 코드를 먼저 \`families\` 테이블에 인서트하고, 해당 신청 회원의 \`family_code\` 값을 해당 코드로 저장합니다.
   - **기존 가족과 연동 시**: 회원 정보 등록/수정 페이지에서 이미 등록되어 있는 타 회원의 가족 관계(가족명 또는 대표자 이름)를 검색하고, 매칭에 체크하면 DB의 \`family_code\`(예: \`FAM-2026-0001\`)를 신규 가동 회원 엔티티에 그대로 복제 주입시켜 일치시킵니다.
   - **할인 트리거 연산**: 회원 목록 조회 쿼리 동작 시, 동일 \`family_code\`를 공유하는 실질 레코드 숫자가 2개 이상이고 이들의 활동여부가 '활동' 상태일 경우 즉시 자동으로 20% 회비 할인이 적용되어 회원 목록 및 납부 명부에 실시간 정산 반영됩니다.
`;
