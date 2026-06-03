import { Member } from './types';

export function generateShareableHTML(systemTitle: string, shareableMembers: Member[]): string {
  const tableRows = shareableMembers.map(m => {
    const displayedYear = m.joinYear || m.joinDate.split('-')[0];
    const displayedFee = m.monthlyFee === 0 
      ? '<span class="fee-free">회비 면제</span>' 
      : `<span class="fee-text">₩${m.monthlyFee.toLocaleString()}</span>`;
    
    const roleBadge = m.role !== '일반회원' ? `<span class="badge-exec">${m.role}</span>` : '';
    const tshirtBadge = m.tShirtSize ? `<span class="badge-tshirt">👕 ${m.tShirtSize}</span>` : '-';

    return `
      <tr>
        <td><strong>${m.name}</strong></td>
        <td>
          <div style="display: flex; gap: 4px; align-items: center;">
            <span class="badge-regular">${m.grade}</span>
            ${roleBadge}
          </div>
        </td>
        <td>
          ${tshirtBadge}
        </td>
        <td><code style="font-family: monospace;">${m.phone}</code></td>
        <td>${displayedYear}년</td>
        <td style="text-align: right;">${displayedFee}</td>
        <td style="text-align: center;"><code style="font-family: monospace;">${m.paymentExpiryDate || '-'}</code></td>
      </tr>
    `;
  }).join('');

  const htmlTagOpen = '<' + 'html lang="ko">';
  const htmlTagClose = '<' + '/html>';
  const headTagOpen = '<' + 'head>';
  const headTagClose = '<' + '/head>';
  const bodyTagOpen = '<' + 'body>';
  const bodyTagClose = '<' + '/body>';

  return `<!DOCTYPE html>
${htmlTagOpen}
${headTagOpen}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${systemTitle} - 회원 회비 현황 (공유용)</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 24px;
    }
    .card {
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
      padding: 32px;
      border-radius: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      border: 1px solid #e2e8f0;
    }
    .header-section {
      text-align: center;
      margin-bottom: 28px;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 16px;
    }
    .header-title {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 8px 0;
    }
    .header-sub {
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
      margin: 0;
    }
    .summary-grid {
      display: flex;
      justify-content: space-between;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 18px;
      margin-bottom: 24px;
      font-size: 13px;
    }
    .summary-item {
      display: flex;
      flex-direction: column;
    }
    .summary-label {
      color: #64748b;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .summary-val {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    th {
      background-color: #f1f5f9;
      color: #475569;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 10px 14px;
      border-bottom: 2px solid #cbd5e1;
    }
    td {
      padding: 12px 14px;
      font-size: 13px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }
    tr:hover td {
      background-color: #f8fafc;
    }
    .badge-exec {
      background-color: #fef3c7;
      color: #d97706;
      border: 1px solid #fde68a;
      padding: 2px 6px;
      font-size: 10px;
      font-weight: 800;
      border-radius: 4px;
      white-space: nowrap;
    }
    .badge-regular {
      background-color: #e0e7ff;
      color: #4f46e5;
      border: 1px solid #c7d2fe;
      padding: 2px 6px;
      font-size: 10px;
      font-weight: 800;
      border-radius: 4px;
      white-space: nowrap;
    }
    .badge-tshirt {
      background-color: #f0fdf4;
      color: #16a34a;
      border: 1px solid #bbf7d0;
      padding: 2px 6px;
      font-size: 10px;
      font-weight: 800;
      border-radius: 4px;
      white-space: nowrap;
    }
    .fee-text {
      font-family: monospace;
      font-weight: 800;
      color: #0f172a;
    }
    .fee-free {
      color: #10b981;
      font-size: 11px;
      font-weight: 700;
    }
    .footer {
      text-align: center;
      margin-top: 32px;
      font-size: 11px;
      color: #94a3b8;
      line-height: 1.5;
    }
  </style>
${headTagClose}
${bodyTagOpen}
  <div class="card">
    <div class="header-section">
      <div class="header-title">🏸 ${systemTitle}</div>
      <p class="header-sub">외부 공유용 회원 회비 명단 (임원 및 정회원 대상)</p>
    </div>

    <div class="summary-grid">
      <div class="summary-item">
        <span class="summary-label">대상 인원</span>
        <span class="summary-val">${shareableMembers.length}명</span>
      </div>
      <div class="summary-item" style="text-align: right;">
        <span class="summary-label" style="text-align: right;">합계 월 부과회비</span>
        <span class="summary-val">₩${shareableMembers.reduce((acc, cur) => acc + cur.monthlyFee, 0).toLocaleString()}</span>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>이름</th>
          <th>등급 / 직책</th>
          <th>티셔츠 사이즈</th>
          <th>연락처</th>
          <th>가입년도</th>
          <th style="text-align: right;">정산 월회비</th>
          <th style="text-align: center;">납기 만료예정일</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <div class="footer">
      본 명부는 ${systemTitle} 시스템에서 외부 전송 및 공유를 위해 생성한 임베디드 오프라인 HTML 파일입니다.<br>
      출력 기준 일시: ${new Date().toLocaleString('ko-KR')}
    </div>
  </div>
${bodyTagClose}
${htmlTagClose}`;
}
