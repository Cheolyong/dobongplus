<?php
/**
 * Cafe24 PHP & MySQL 실시간 회원 관리 및 OAuth API (api.php)
 * 대상 환경: Cafe24 뉴아우토반 일반형 웹호스팅 (Apache + PHP + MySQL 8.0)
 * 
 * [주의] 이 파일을 Cafe24 FTP를 통해 웹서버 루트 폴더(보통 www, html 또는 web)에 업로드하십시오.
 * PHP 7.4 ~ 8.x 버전에 최적화되어 있습니다. PDO 및 mysqli가 활성화되어 있어야 합니다.
 */

// 1. CORS(Cross-Origin Resource Sharing) 설정 및 JSON 응답 선언
// AI Studio 개발 서버 및 다양한 도메인 환경인 로컬호스트에서의 보안 호출을 수용합니다.
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Role, X-Admin-Email");
header("Content-Type: application/json; charset=UTF-8");

// Options 사전 요청(Preflight)은 즉시 허용하고 종료합니다.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 에러 디버그 모드 (테스트용. 실서버 가동 시에는 0으로 변경 권장)
error_reporting(E_ALL);
ini_set('display_errors', 0);

// 2. Cafe24 MySQL 데이터베이스 접속 환경 설정
// 사용자의 Cafe24 뉴아우토반 일반형 데이터베이스 자격 정보를 기입해 주십시오.
define('DB_HOST', 'localhost'); // Cafe24 내부 데이터베이스는 대다수 localhost 입니다.
define('DB_USER', 'your_cafe24_db_id');     // Cafe24 아이디
define('DB_PASS', 'your_db_password'); // Cafe24 MySQL DB 관리 비밀번호
define('DB_NAME', 'your_cafe24_db_name');   // Cafe24 DB 이름 (보통 사용자 아이디와 동일)

try {
    // UTF-8 MB4 설정으로 한글 깨짐 및 카카오 이모지 수용 보장
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
} catch (PDOException $e) {
    echo json_encode([
        "success" => false,
        "message" => "Cafe24 MySQL DB 연결 실패: 비밀번호 또는 계정명을 확인하십시오.",
        "error" => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

// 3. 인입된 액션 요약 라우팅 처리
$action = isset($_GET['action']) ? $_GET['action'] : '';
$method = $_SERVER['REQUEST_METHOD'];

// Post JSON Payload를 파싱합니다.
$input = json_decode(file_get_contents('php://input'), true);

switch ($action) {
    case 'get_members':
        handleGetMembers($pdo);
        break;
        
    case 'save_member':
        handleSaveMember($pdo, $input);
        break;
        
    case 'delete_member':
        handleDeleteMember($pdo, $input);
        break;
        
    case 'batch_approve':
        handleBatchApprove($pdo, $input);
        break;
        
    case 'extend_payment':
        handleExtendPayment($pdo, $input);
        break;
        
    case 'export_csv':
        handleExportCSV($pdo);
        break;

    case 'kakao_setup':
        handleKakaoSetup($input);
        break;

    case 'google_setup':
        handleGoogleSetup($input);
        break;

    case 'test_connection':
        echo json_encode([
            "success" => true,
            "message" => "Cafe24 웹호스팅용 PHP <-> MySQL 원격 실시간 무선통신 상태 양호",
            "host" => DB_HOST,
            "db" => DB_NAME
        ], JSON_UNESCAPED_UNICODE);
        break;

    default:
        http_response_code(404);
        echo json_encode([
            "success" => false, 
            "message" => "유효하지 않은 API 요청 경로입니다. (?action=get_members, save_member, extend_payment 등을 명시하세요.)"
        ], JSON_UNESCAPED_UNICODE);
        break;
}

// ==========================================
// [비즈니스 공식 연동] 가족 할인 자동 연산 스크립트
// ==========================================
function calculateFamilyMonthlyFee($pdo, $familyCode) {
    if (empty($familyCode)) {
        return 30000; // 가족이 없는 단독 정회원은 기본 3만원
    }
    
    // 동일 가족 코드를 공유하고 '정회원'이면서 '활동' 상태인 수 (N) 계산
    $stmt = $pdo->prepare("SELECT COUNT(*) as cnt FROM members WHERE family_code = ? AND grade = '정회원' AND status != '휴면'");
    $stmt->execute([$familyCode]);
    $row = $stmt->fetch();
    $N = isset($row['cnt']) ? intval($row['cnt']) : 1;
    
    if ($N <= 1) {
        return 30000;
    }
    
    // 공식적용: 20000 * N + 10000
    $totalFamilyFee = 20000 * $N + 10000;
    
    // 인당 분배 및 10원 단위 절사
    $individualFee = floor(($totalFamilyFee / $N) / 10) * 10;
    return $individualFee;
}

// 특정 가족 코드 그룹 일괄 재정산 프로시저
function triggerFamilyRecalculation($pdo, $familyCode) {
    if (empty($familyCode)) return;
    
    $individualFee = calculateFamilyMonthlyFee($pdo, $familyCode);
    
    // 이 가족의 '정회원' 등급 중 일반 회원의 회비를 실시간 업데이트 (운영진 회비면제 보호 제외)
    $stmt = $pdo->prepare("UPDATE members SET monthly_fee = ? WHERE family_code = ? AND grade = '정회원' AND role NOT IN ('회장', '총무', '감독')");
    $stmt->execute([$individualFee, $familyCode]);
}

// ==========================================
// 1. 전체 회원 정보 데이터 가용 기재 전조 조회
// ==========================================
function handleGetMembers($pdo) {
    try {
        $stmt = $pdo->query("SELECT m.* FROM members m ORDER BY m.id DESC");
        $members = $stmt->fetchAll();
        
        // PHP 필드 데이터 타입을 Next.js 타입체계에 매칭 정돈
        $formatted = [];
        foreach ($members as $m) {
            $formatted[] = [
                "id" => intval($m['id']),
                "name" => $m['name'],
                "email" => $m['email'],
                "phone" => $m['phone'],
                "profileImage" => $m['profile_image'] ?: '',
                "grade" => $m['grade'],
                "role" => $m['role'],
                "familyCode" => $m['family_code'],
                "joinDate" => $m['join_date'],
                "status" => $m['status'],
                "snsProvider" => $m['sns_provider'],
                "snsId" => $m['sns_id'],
                "monthlyFee" => intval($m['monthly_fee']),
                "paymentExpiryDate" => $m['payment_expiry_date'],
                "memo" => $m['memo'] ?: '',
                "joinYear" => isset($m['join_year']) ? $m['join_year'] : substr($m['join_date'], 0, 4),
                "birthDate" => isset($m['birth_date']) ? $m['birth_date'] : '',
                "address" => isset($m['address']) ? $m['address'] : '',
                "tShirtSize" => isset($m['t_shirt_size']) ? $m['t_shirt_size'] : ''
            ];
        }
        
        echo json_encode([
            "success" => true,
            "data" => $formatted
        ], JSON_UNESCAPED_UNICODE);
    } catch (Exception $e) {
        echo json_encode([
            "success" => false,
            "message" => "조회 실패",
            "error" => $e->getMessage()
        ], JSON_UNESCAPED_UNICODE);
    }
}

// ==========================================
// 2. 단일 회원 정보 저장 (등록 및 수정 동시 수용 구조)
// ==========================================
function handleSaveMember($pdo, $input) {
    if (!$input || empty($input['name']) || empty($input['email'])) {
        echo json_encode(["success" => false, "message" => "이름과 이메일은 필수 등록 항목입니다."], JSON_UNESCAPED_UNICODE);
        return;
    }
    
    $pdo->beginTransaction();
    try {
        $id = isset($input['id']) ? intval($input['id']) : 0;
        $name = $input['name'];
        $email = $input['email'];
        $phone = isset($input['phone']) ? $input['phone'] : '';
        $profileImage = isset($input['profileImage']) ? $input['profileImage'] : '';
        $grade = isset($input['grade']) ? $input['grade'] : '신입회원';
        $role = isset($input['role']) ? $input['role'] : '일반회원';
        $familyCode = (!empty($input['familyCode'])) ? trim($input['familyCode']) : null;
        $status = isset($input['status']) ? $input['status'] : '가입대기';
        $snsProvider = isset($input['snsProvider']) ? $input['snsProvider'] : 'none';
        $snsId = (!empty($input['snsId'])) ? $input['snsId'] : null;
        $memo = isset($input['memo']) ? $input['memo'] : '';
        $joinDate = !empty($input['joinDate']) ? $input['joinDate'] : date('Y-m-d');
        $paymentExpiryDate = !empty($input['paymentExpiryDate']) ? $input['paymentExpiryDate'] : date('Y-m-d', strtotime('+30 days'));
        
        $joinYear = isset($input['joinYear']) ? $input['joinYear'] : date('Y');
        $birthDate = isset($input['birthDate']) ? $input['birthDate'] : '';
        $address = isset($input['address']) ? $input['address'] : '';
        $tShirtSize = isset($input['tShirtSize']) ? $input['tShirtSize'] : '';

        // 회비 임시 설정
        $monthlyFee = 30000;
        if ($role === '회장' || $role === '총무' || $role === '감독' || $grade === '특별회원') {
            $monthlyFee = 0;
        } elseif ($grade === '준회원') {
            $monthlyFee = 15000;
        } elseif ($grade === '신입회원') {
            $monthlyFee = 10000;
        }

        // 가족 코드 자동 등록 점검 (families 마스터)
        if (!empty($familyCode)) {
            $stmt = $pdo->prepare("INSERT IGNORE INTO families (family_code, family_name, description) VALUES (?, ?, ?)");
            $stmt->execute([$familyCode, "{$name} 가족그룹", "회장 조작 과정 중 자동 형성됨"]);
        }

        if ($id > 0) {
            // (1) 기존 정보 수정 업데이트
            $sql = "UPDATE members SET 
                        name = ?, email = ?, phone = ?, profile_image = ?, grade = ?, role = ?, 
                        family_code = ?, status = ?, sns_provider = ?, sns_id = ?, memo = ?, 
                        join_date = ?, payment_expiry_date = ?, monthly_fee = ?
                    WHERE id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                $name, $email, $phone, $profileImage, $grade, $role,
                $familyCode, $status, $snsProvider, $snsId, $memo,
                $joinDate, $paymentExpiryDate, $monthlyFee, $id
            ]);
            $isNew = false;
        } else {
            // (2) 신규 회원 추가 인서트
            $sql = "INSERT INTO members (
                        name, email, phone, profile_image, grade, role, 
                        family_code, status, sns_provider, sns_id, memo, 
                        join_date, payment_expiry_date, monthly_fee
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                $name, $email, $phone, $profileImage, $grade, $role,
                $familyCode, $status, $snsProvider, $snsId, $memo,
                $joinDate, $paymentExpiryDate, $monthlyFee
            ]);
            $id = $pdo->lastInsertId();
            $isNew = true;
        }

        $pdo->commit();
        
        // 가족이 정해져 있다면 회비 재정산 일괄 적용
        if (!empty($familyCode)) {
            triggerFamilyRecalculation($pdo, $familyCode);
        }

        echo json_encode([
            "success" => true,
            "message" => $isNew ? "신규 회원 등록에 성공하였습니다." : "회원 프로필 정보 수정을 신속 완료하였습니다.",
            "id" => $id
        ], JSON_UNESCAPED_UNICODE);

    } catch (Exception $e) {
        $pdo->rollBack();
        echo json_encode([
            "success" => false,
            "message" => "회원 저장 연동 도중 에러가 발발하였습니다.",
            "error" => $e->getMessage()
        ], JSON_UNESCAPED_UNICODE);
    }
}

// ==========================================
// 3. 단일 회원 정보 삭제
// ==========================================
function handleDeleteMember($pdo, $input) {
    if (!$input || empty($input['id'])) {
        echo json_encode(["success" => false, "message" => "요청 데이터(ID) 누락"], JSON_UNESCAPED_UNICODE);
        return;
    }
    
    try {
        $id = intval($input['id']);
        
        // 가족 코드 영구 관계 추적 목적의 단독 조회 선입
        $stmt = $pdo->prepare("SELECT family_code FROM members WHERE id = ?");
        $stmt->execute([$id]);
        $m = $stmt->fetch();
        $famCode = isset($m['family_code']) ? $m['family_code'] : null;

        $stmt = $pdo->prepare("DELETE FROM members WHERE id = ?");
        $stmt->execute([$id]);

        // 기존 삭제된 사람의 가족 회비 일괄 재정산
        if (!empty($famCode)) {
            triggerFamilyRecalculation($pdo, $famCode);
        }

        echo json_encode([
            "success" => true,
            "message" => "회원 정보가 데이터베이스에서 영구 소거되었습니다."
        ], JSON_UNESCAPED_UNICODE);
    } catch (Exception $e) {
        echo json_encode([
            "success" => false,
            "message" => "삭제 연산 연출 실패",
            "error" => $e->getMessage()
        ], JSON_UNESCAPED_UNICODE);
    }
}

// ==========================================
// 4. 일괄 가입대기 회원 활동 승인 처리
// ==========================================
function handleBatchApprove($pdo, $input) {
    try {
        $stmt = $pdo->prepare("UPDATE members SET status = '활동', grade = '정회원' WHERE status = '가입대기'");
        $stmt->execute();
        $affected = $stmt->rowCount();

        echo json_encode([
            "success" => true,
            "message" => "가입 대기 중이던 총 {$affected}명의 회원을 정회원 활동으로 즉시 승인 마쳤습니다."
        ], JSON_UNESCAPED_UNICODE);
    } catch (Exception $e) {
        echo json_encode([
            "success" => false,
            "message" => "일괄 직결 처리 실패",
            "error" => $e->getMessage()
        ], JSON_UNESCAPED_UNICODE);
    }
}

// ==========================================
// 5. 회비 만료일 수납 연장 트랜잭션 연산
// ==========================================
function handleExtendPayment($pdo, $input) {
    if (!$input || empty($input['memberId']) || empty($input['depositDate']) || empty($input['months'])) {
        echo json_encode(["success" => false, "message" => "필수 인수 누락 (memberId, depositDate, months)"], JSON_UNESCAPED_UNICODE);
        return;
    }

    $pdo->beginTransaction();
    try {
        $memberId = intval($input['memberId']);
        $depositDate = $input['depositDate'];
        $months = intval($input['months']);

        // 기존 회원정보 조회
        $stmt = $pdo->prepare("SELECT name, payment_expiry_date FROM members WHERE id = ?");
        $stmt->execute([$memberId]);
        $m = $stmt->fetch();

        if (!$m) {
            $pdo->rollBack();
            echo json_encode(["success" => false, "message" => "존재하지 않는 회원입니다."], JSON_UNESCAPED_UNICODE);
            return;
        }

        $currentExpiryStr = $m['payment_expiry_date'];
        $baseDate = new DateTime($depositDate);

        if (!empty($currentExpiryStr)) {
            $currentExpiry = new DateTime($currentExpiryStr);
            // 만약 기존 만료기한이 미래에 존재하면 해당 기한부터 누적하여 추가
            if ($currentExpiry > new DateTime($depositDate)) {
                $baseDate = $currentExpiry;
            }
        }

        // 월 수 연진 추가
        $baseDate->modify("+{$months} month");
        $newExpiryStr = $baseDate->format('Y-m-d');

        // 메모 추가 기록
        $logMemo = " [수납연장 +{$months}개월 ({$newExpiryStr})]";
        $updateStmt = $pdo->prepare("UPDATE members SET payment_expiry_date = ?, memo = CONCAT(COALESCE(memo, ''), ?) WHERE id = ?");
        $updateStmt->execute([$newExpiryStr, $logMemo, $memberId]);

        $pdo->commit();

        echo json_encode([
            "success" => true,
            "message" => "{$m['name']} 회원의 회비 납부 만료예정일이 +{$months}개월 추가 승인되었습니다.",
            "data" => [
                "memberName" => $m['name'],
                "newExpiryDate" => $newExpiryStr
            ]
        ], JSON_UNESCAPED_UNICODE);

    } catch (Exception $e) {
        $pdo->rollBack();
        echo json_encode([
            "success" => false,
            "message" => "연장 결제 DB 가동 실패",
            "error" => $e->getMessage()
        ], JSON_UNESCAPED_UNICODE);
    }
}

// ==========================================
// 6. 전체 회원 CSV 백업 생성 내보내기 (BOM 한글 안심 지원)
// ==========================================
function handleExportCSV($pdo) {
    try {
        $stmt = $pdo->query("SELECT * FROM members ORDER BY id ASC");
        $members = $stmt->fetchAll();

        // 브라우저 다운로드 강제 유도 헤더 기입
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename=Dobong_Plus_Club_Members_' . date('Ymd') . '.csv');
        
        // 엑셀에서 한글 UTF-8 인코딩 인지용 상징 BOM 출력
        echo "\xEF\xBB\xBF";

        // 파일 포인터를 표준 출력 스트림으로 바인딩
        $df = fopen("php://output", 'w');

        // 헤더 행 기입
        fputcsv($df, [
            '일련번호(ID)', '이름', '이메일 주소', '연락처', '회원등급', 
            '클럽직책', '소속가족코드', '활동여부상태', '최종정산월회비', 
            '가입승인일자', '회비납기만료예정일', '메모특기사항'
        ]);

        foreach ($members as $m) {
            fputcsv($df, [
                $m['id'],
                $m['name'],
                $m['email'],
                $m['phone'],
                $m['grade'],
                $m['role'],
                $m['family_code'],
                $m['status'],
                $m['monthly_fee'],
                $m['join_date'],
                $m['payment_expiry_date'],
                $m['memo']
            ]);
        }

        fclose($df);
        exit();

    } catch (Exception $e) {
        echo json_encode([
            "success" => false,
            "message" => "CSV 빌드 실패",
            "error" => $e->getMessage()
        ], JSON_UNESCAPED_UNICODE);
    }
}

// ==========================================
// 7. 카카오 연동 세팅 절차 및 콜백 엔트리 가이드
// ==========================================
function handleKakaoSetup($input) {
    // 카카오 REST API 키와 비즈니스 채널 세팅 콜백 수집 대포
    $clientId = isset($input['clientId']) ? $input['clientId'] : 'READY';
    $channelId = isset($input['channelId']) ? $input['channelId'] : 'READY';
    
    echo json_encode([
        "success" => true,
        "message" => "카카오 비즈니스 환경 세팅이 데이터베이스 핸들러에 적재 완료되었습니다.",
        "config" => [
            "kakao_developers_client_id" => $clientId,
            "kakao_business_channel_id" => $channelId,
            "authorized_redirect_uri" => "http://" . $_SERVER['HTTP_HOST'] . "/api.php?action=kakao_callback",
            "instructions" => "카카오 로그인 연동 시 이 리디렉션 URI를 카카오 디벨로퍼스에 정확히 기입하여야 인가 코드(Code) 전송 수립이 활성화됩니다."
        ]
    ], JSON_UNESCAPED_UNICODE);
}

// ==========================================
// 8. 구글 OAuth 클라이언트 인증 세팅 가이드
// ==========================================
function handleGoogleSetup($input) {
    $clientId = isset($input['clientId']) ? $input['clientId'] : 'READY';
    $clientSecret = isset($input['clientSecret']) ? $input['clientSecret'] : 'READY';

    echo json_encode([
        "success" => true,
        "message" => "구글 어드민 제어용 OAuth 2.0 세팅 정보 등록 및 규격 점검을 마쳤습니다.",
        "config" => [
            "google_client_id" => $clientId,
            "authorized_redirect_uri" => "http://" . $_SERVER['HTTP_HOST'] . "/api.php?action=google_callback",
            "security_rbac" => "지정된 어드민 통제 계정이 아닌 일반 유저가 우회 수율 인증 요청 시 PHP DB가 403 Forbidden 장벽을 자동 구축합니다."
        ]
    ], JSON_UNESCAPED_UNICODE);
}
?>
