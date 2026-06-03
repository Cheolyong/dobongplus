import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div id="not-found-container" className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div id="not-found-card" className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8 text-center animate-fade-in">
        <div id="not-found-icon-container" className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 id="not-found-heading" className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
          페이지를 찾을 수 없습니다
        </h1>
        <p id="not-found-desc" className="text-slate-500 text-sm mb-8 leading-relaxed">
          요청하신 페이지가 존재하지 않거나 이전되었습니다.<br />
          아래 버튼을 완료하여 메인 회원 관리 시스템으로 돌아갈 수 있습니다.
        </p>
        <Link
          id="not-found-home-button"
          href="/"
          className="inline-flex items-center justify-center w-full px-5 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200 rounded-xl"
        >
          회원 관리 시스템 홈으로 이동
        </Link>
      </div>
    </div>
  );
}
