'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Download,
  Upload,
  FileSpreadsheet,
  UserCheck,
  Users,
  CreditCard,
  Lock,
  Settings,
  RefreshCw,
  Heart,
  Info,
  Check,
  X,
  ExternalLink,
  ShieldCheck,
  Key,
  Copy,
  PlusCircle,
  HelpCircle,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

import { Member } from '@/lib/types';
import { INITIAL_MEMBERS, calculateMonthlyFee, generateNextFamilyCode } from '@/lib/memberHelper';
import { MYSQL_DDL, KAKAO_OAUTH_FLOW_EXPLANATION, GOOGLE_OAUTH_FLOW_EXPLANATION, FAMILY_CODE_ALGORITHM_EXPLANATION } from '@/lib/dbSchema';
import { exportToCSV, parseCSV, getSampleCSVTemplate } from '@/lib/csvUtils';
import { generateShareableHTML } from '@/lib/htmlTemplate';

export default function Home() {
  // Cafe24 실시간 연동 (PHP/MySQL) 설정 상태
  const [isLiveMode, setIsLiveMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cafe24_live_mode');
      return saved === 'true';
    }
    return false;
  });
  
  // 연동 백엔드 유형 선택 ('cafe24' | 'vercel')
  const [liveModeType, setLiveModeType] = useState<'cafe24' | 'vercel'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cafe24_live_type');
      return (saved === 'vercel' ? 'vercel' : 'cafe24');
    }
    return 'cafe24';
  });
  
  const [liveApiUrl, setLiveApiUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cafe24_live_api_url');
      if (saved) return saved;
      
      const savedType = localStorage.getItem('cafe24_live_type');
      return savedType === 'vercel' ? '/api/vercel-db' : '/api.php';
    }
    return '/api.php';
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [liveError, setLiveError] = useState<string>('');

  // 상태 관리
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);

  // Cafe24 실시간 회원 연동 가져오기 함수 (비동기 통신 구현)
  const fetchMembers = useCallback(async () => {
    if (!isLiveMode) {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('dobong_members_data');
        if (saved) {
          try {
            setMembers(JSON.parse(saved));
          } catch (e) {
            setMembers(INITIAL_MEMBERS);
          }
        } else {
          setMembers(INITIAL_MEMBERS);
        }
      }
      return;
    }

    setLoading(true);
    setLiveError('');
    try {
      // 1. 카페24 PHP 원격 MySQL 서버에 GET 요청을 보냄
      const res = await fetch(`${liveApiUrl}?action=get_members`);
      if (!res.ok) throw new Error(`HTTP 상태 오류: ${res.status}`);
      const payload = await res.json();
      if (payload.success) {
        setMembers(payload.data);
      } else {
        setLiveError(payload.message || '데이터를 가져오는데 실패했습니다.');
      }
    } catch (err: any) {
      setLiveError(`Cafe24 연결오류: ${err.message}. (API 경로 및 데이터베이스 설정을 확인하세요)`);
    } finally {
      setLoading(false);
    }
  }, [isLiveMode, liveApiUrl]);

  // 실시간 연동 모드가 켜지거나 URL이 바뀔 때 데이터를 즉시 연동
  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const [activeTab, setActiveTab] = useState<'members' | 'fees' | 'families' | 'csv' | 'ddl' | 'sandbox'>('members');
  const [feesPartition, setFeesPartition] = useState<'all' | 'exec' | 'regular' | 'associate' | 'withdrawn'>('all');
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>('all');
  
  // 검색 및 필터 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // 수정/등록 모달 상태
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  
  // 입력 폼 필드 상태
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formGrade, setFormGrade] = useState<Member['grade']>('신입회원');
  const [formRole, setFormRole] = useState<Member['role']>('일반회원');
  const [formStatus, setFormStatus] = useState<Member['status']>('가입대기');
  const [formFamilyCode, setFormFamilyCode] = useState<string>('');
  const [formMemo, setFormMemo] = useState('');
  const [formSnsProvider, setFormSnsProvider] = useState<Member['snsProvider']>('none');
  const [formSnsId, setFormSnsId] = useState<string>('');
  const [formProfileImage, setFormProfileImage] = useState('');

  // 신규 가입 폼 추가 필드 상태
  const [formJoinYear, setFormJoinYear] = useState('');
  const [formBirthDate, setFormBirthDate] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formTShirtSize, setFormTShirtSize] = useState<Member['tShirtSize']>('');

  // 동호회 시스템 타이틀 상태 및 로컬 스토리지 연동
  const [systemTitle, setSystemTitle] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('system_club_title');
      return saved || '도봉플러스 클럽 배드민턴 동호회 회원 관리 시스템';
    }
    return '도봉플러스 클럽 배드민턴 동호회 회원 관리 시스템';
  });
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('system_club_title');
      return saved || '도봉플러스 클럽 배드민턴 동호회 회원 관리 시스템';
    }
    return '도봉플러스 클럽 배드민턴 동호회 회원 관리 시스템';
  });

  const handleSaveTitle = () => {
    if (!tempTitle.trim()) return;
    setSystemTitle(tempTitle.trim());
    localStorage.setItem('system_club_title', tempTitle.trim());
    setIsEditingTitle(false);
  };

  // 복사 알림 토글
  const [copiedText, setCopiedText] = useState(false);
  
  // 시뮬레이션 관련 상태
  const [kakaoSimUser, setKakaoSimUser] = useState({
    nickname: '김하준',
    email: 'hajun.kim@daum.net',
    profile_image: 'https://picsum.photos/seed/kakao_hajun/150/150',
    id: 'k_10293847'
  });
  const [googleAdminUser, setGoogleAdminUser] = useState({
    email: 'cheolyong.ryoo@gmail.com',
    name: '유철용(Admin)',
    isLoggedIn: false
  });

  // 납부 연장 모달 관련 상태 (2단계-2 요건구현)
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [extendingMember, setExtendingMember] = useState<Member | null>(null);
  const [depositDate, setDepositDate] = useState('2026-05-25'); // 올 가용한 기준 기점
  const [extendMonths, setExtendMonths] = useState<number>(3); // 기본 3개월 완납 지정
  const [selectedDuesYear, setSelectedDuesYear] = useState<number>(2026); // 회비 현황 보기 연도 기점 (Google Sheet 연동)

  // 복사 핸들러
  const handleCopyDDL = () => {
    navigator.clipboard.writeText(MYSQL_DDL);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // CSV 직접 원문 쓰기(텍스트) 업로드 상태
  const [csvRawText, setCsvRawText] = useState('');
  const [csvUploadError, setCsvUploadError] = useState('');
  const [csvUploadSuccess, setCsvUploadSuccess] = useState('');

  // 파일 업로드 관련 ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 실시간 통계 계산
  const stats = useMemo(() => {
    const total = members.length;
    const active = members.filter(m => m.status === '활동').length;
    const pending = members.filter(m => m.status === '가입대기').length;
    const familyMapped = members.filter(m => m.familyCode !== null).length;
    
    // 이번 달 활동 회원들의 예상 회비 수입 합산
    const expectedRevenue = members
      .filter(m => m.status === '활동')
      .reduce((sum, m) => sum + m.monthlyFee, 0);

    return { total, active, pending, familyMapped, expectedRevenue };
  }, [members]);

  // 가족 코드 그룹 조회
  const familyGroups = useMemo(() => {
    const groups: { [key: string]: Member[] } = {};
    members.forEach(m => {
      if (m.familyCode) {
        if (!groups[m.familyCode]) {
          groups[m.familyCode] = [];
        }
        groups[m.familyCode].push(m);
      }
    });
    return groups;
  }, [members]);

  // 자동 가족코드 리스트 추출
  const uniqueFamilyList = useMemo(() => {
    return Object.keys(familyGroups);
  }, [familyGroups]);

  // 주소 광역/기초 자치단체 파싱 헬퍼
  const extractRegion = useCallback((addr?: string) => {
    if (!addr) return '미기입';
    const trimmed = addr.replace(/\s+/g, ' ').trim();
    const parts = trimmed.split(' ');
    if (parts.length >= 2) {
      return `${parts[0]} ${parts[1]}`;
    }
    return parts[0] || '미기입';
  }, []);

  // 전체 회원 내 고유한 광역/기초 주소 그룹 목록 추출
  const uniqueRegions = useMemo(() => {
    const regions = members.map(m => extractRegion(m.address)).filter(r => r !== '미기입');
    return Array.from(new Set(regions));
  }, [members, extractRegion]);

  // 회원 회비 전용 필터링 목록
  const filteredFeesMembers = useMemo(() => {
    return members.filter(m => {
      const matchSearch = 
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.phone.includes(searchQuery) ||
        (m.familyCode && m.familyCode.toLowerCase().includes(searchQuery.toLowerCase()));
      
      if (!matchSearch) return false;

      // feesPartition: 'all' | 'exec' | 'regular' | 'associate' | 'withdrawn'
      if (feesPartition === 'exec') {
        return m.role !== '일반회원' && m.status !== '탈퇴';
      } else if (feesPartition === 'regular') {
        return m.grade === '정회원' && m.role === '일반회원' && m.status !== '탈퇴';
      } else if (feesPartition === 'associate') {
        return m.grade === '준회원' && m.status !== '탈퇴';
      } else if (feesPartition === 'withdrawn') {
        return m.status === '탈퇴';
      }
      return true;
    });
  }, [members, searchQuery, feesPartition]);

  // 회원 명부관리 전용 필터링 목록 (주소지 필터 추가)
  const filteredRegMembers = useMemo(() => {
    return members.filter(m => {
      const matchSearch = 
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.phone.includes(searchQuery) ||
        (m.familyCode && m.familyCode.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchGrade = filterGrade === 'all' || m.grade === filterGrade;
      const matchRole = filterRole === 'all' || m.role === filterRole;
      const matchStatus = filterStatus === 'all' || m.status === filterStatus;

      // 주소 기준 구별 매칭
      const matchRegion = selectedRegionFilter === 'all' || extractRegion(m.address) === selectedRegionFilter;

      return matchSearch && matchGrade && matchRole && matchStatus && matchRegion;
    });
  }, [members, searchQuery, filterGrade, filterRole, filterStatus, selectedRegionFilter, extractRegion]);

  // 검색 및 필터 필터링 결과 회원
  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const matchSearch = 
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.phone.includes(searchQuery) ||
        (m.familyCode && m.familyCode.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchGrade = filterGrade === 'all' || m.grade === filterGrade;
      const matchRole = filterRole === 'all' || m.role === filterRole;
      const matchStatus = filterStatus === 'all' || m.status === filterStatus;

      return matchSearch && matchGrade && matchRole && matchStatus;
    });
  }, [members, searchQuery, filterGrade, filterRole, filterStatus]);

  // 폼 열기 (신규 등록)
  const handleOpenCreateForm = () => {
    setEditingMember(null);
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormGrade('신입회원');
    setFormRole('일반회원');
    setFormStatus('가입대기');
    setFormFamilyCode('');
    setFormMemo('');
    setFormSnsProvider('none');
    setFormSnsId('');
    setFormProfileImage('https://picsum.photos/seed/' + Math.random() + '/150/150');
    // 신규 추가 필드 초기화
    setFormJoinYear(new Date().getFullYear().toString());
    setFormBirthDate('');
    setFormAddress('');
    setFormTShirtSize('');
    setIsFormOpen(true);
  };

  // 폼 열기 (기존 수정)
  const handleOpenEditForm = (member: Member) => {
    setEditingMember(member);
    setFormName(member.name);
    setFormEmail(member.email);
    setFormPhone(member.phone);
    setFormGrade(member.grade);
    setFormRole(member.role);
    setFormStatus(member.status);
    setFormFamilyCode(member.familyCode || '');
    setFormMemo(member.memo || '');
    setFormSnsProvider(member.snsProvider);
    setFormSnsId(member.snsId || '');
    setFormProfileImage(member.profileImage);
    // 신규 추가 필드 수집
    setFormJoinYear(member.joinYear || member.joinDate?.split('-')[0] || new Date().getFullYear().toString());
    setFormBirthDate(member.birthDate || '');
    setFormAddress(member.address || '');
    setFormTShirtSize(member.tShirtSize || '');
    setIsFormOpen(true);
  };

  // 가족 코드 자동 발급 버튼 클릭
  const handleAutoGenerateFamilyCode = () => {
    const nextCode = generateNextFamilyCode(members);
    setFormFamilyCode(nextCode);
  };

  // 회원 저장 (등록 / 수정)
  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const hasFamily = formFamilyCode.trim() !== '';

    // 신규/기존 데이터 세트 매핑
    const memberId = editingMember ? editingMember.id : 0;
    const targetPayload = {
      id: memberId,
      name: formName,
      email: formEmail,
      phone: formPhone,
      profileImage: formProfileImage || `https://picsum.photos/seed/${formName}/150/150`,
      grade: formGrade,
      role: formRole,
      familyCode: hasFamily ? formFamilyCode.trim() : null,
      status: formStatus,
      snsProvider: formSnsProvider,
      snsId: formSnsId !== '' ? formSnsId : (formSnsProvider !== 'none' ? `sns_${Date.now()}` : null),
      memo: formMemo,
      joinDate: editingMember ? editingMember.joinDate : `${formJoinYear || new Date().getFullYear()}-${new Date().toISOString().split('T')[0].substring(5)}`,
      paymentExpiryDate: editingMember ? editingMember.paymentExpiryDate : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      joinYear: formJoinYear,
      birthDate: formBirthDate,
      address: formAddress,
      tShirtSize: formTShirtSize
    };

    if (isLiveMode) {
      setLoading(true);
      try {
        const res = await fetch(`${liveApiUrl}?action=save_member`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(targetPayload)
        });
        const data = await res.json();
        if (data.success) {
          alert(`[Cafe24 실시간 DB 연동 성공]\n${data.message}`);
          setIsFormOpen(false);
          await fetchMembers();
        } else {
          alert(`오류: ${data.message}`);
        }
      } catch (err: any) {
        alert(`Cafe24 실서버 통신 실패: ${err.message}`);
      } finally {
        setLoading(false);
      }
    } else {
      let updatedList: Member[] = [];
      if (editingMember) {
        // 1. 기존 회원 정보 업데이트 및 수정보완
        updatedList = members.map(m => {
          if (m.id === editingMember.id) {
            return {
              ...m,
              ...targetPayload,
              monthlyFee: 0
            } as Member;
          }
          return m;
        });
      } else {
        // 2. 신규 회원 가입 등록 신청
        const nextId = Math.max(...members.map(m => m.id), 0) + 1;
        const newMember: Member = {
          ...targetPayload,
          id: nextId,
          monthlyFee: 0
        };
        updatedList = [...members, newMember];
      }

      // 가족 정회원 수 N을 전수 셈하여 20,000 * N + 10,000 공식을 일괄 계산 정합 보정 (2단계-1 요건 반영)
      const finalRecalculated = updatedList.map(m => {
        const familyRegularCount = m.familyCode 
          ? updatedList.filter(f => f.familyCode === m.familyCode && f.grade === '정회원' && f.status !== '휴면').length 
          : 0;
        return {
          ...m,
          monthlyFee: calculateMonthlyFee(m.grade, m.role, !!m.familyCode, familyRegularCount)
        };
      });

      setMembers(finalRecalculated);
      localStorage.setItem('dobong_members_data', JSON.stringify(finalRecalculated));
      setIsFormOpen(false);
    }
  };

  // 회원 삭제
  const handleDeleteMember = async (id: number) => {
    if (confirm('해당 동호회 회원 정보를 삭제하시겠습니까? 관련 가족 혜택 연동이 해제될 수 있습니다.')) {
      if (isLiveMode) {
        setLoading(true);
        try {
          const res = await fetch(`${liveApiUrl}?action=delete_member`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          });
          const data = await res.json();
          if (data.success) {
            alert(`[Cafe24 실시간 DB 연동 성공]\n${data.message}`);
            await fetchMembers();
          } else {
            alert(`삭제 실패: ${data.message}`);
          }
        } catch (err: any) {
          alert(`Cafe24 실서버 통신 실패: ${err.message}`);
        } finally {
          setLoading(false);
        }
      } else {
        const remaining = members.filter(m => m.id !== id);
        const finalRecalculated = remaining.map(m => {
          const familyRegularCount = m.familyCode 
            ? remaining.filter(f => f.familyCode === m.familyCode && f.grade === '정회원' && f.status !== '휴면').length 
            : 0;
          return {
            ...m,
            monthlyFee: calculateMonthlyFee(m.grade, m.role, !!m.familyCode, familyRegularCount)
          };
        });
        
        setMembers(finalRecalculated);
        localStorage.setItem('dobong_members_data', JSON.stringify(finalRecalculated));
      }
    }
  };

  // 승인 대기 회원 -> 활동 회원으로 즉시 승인 및 정회원 업그레이드
  const handleApproveMember = async (id: number) => {
    const target = members.find(m => m.id === id);
    if (!target) return;

    if (isLiveMode) {
      setLoading(true);
      try {
        const res = await fetch(`${liveApiUrl}?action=save_member`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...target,
            status: '활동',
            grade: '정회원',
            joinDate: new Date().toISOString().split('T')[0]
          })
        });
        const data = await res.json();
        if (data.success) {
          alert(`[Cafe24 실시간 DB 연동 성공]\n가입대기 회원이 정회원으로 즉시 활동 승인 처리되었습니다.`);
          await fetchMembers();
        } else {
          alert(`승인 오류: ${data.message}`);
        }
      } catch (err: any) {
        alert(`Cafe24 실서버 통신 실패: ${err.message}`);
      } finally {
        setLoading(false);
      }
    } else {
      const updated = members.map(m => {
        if (m.id === id) {
          return {
            ...m,
            status: '활동' as const,
            grade: '정회원' as const,
            joinDate: new Date().toISOString().split('T')[0],
          };
        }
        return m;
      });

      const finalRecalculated = updated.map(m => {
        const familyRegularCount = m.familyCode 
          ? updated.filter(f => f.familyCode === m.familyCode && f.grade === '정회원' && f.status !== '휴면').length 
          : 0;
        return {
          ...m,
          monthlyFee: calculateMonthlyFee(m.grade, m.role, !!m.familyCode, familyRegularCount)
        };
      });

      setMembers(finalRecalculated);
      localStorage.setItem('dobong_members_data', JSON.stringify(finalRecalculated));
    }
  };

  // 모든 가입대기 회원 클릭 한 번으로 일괄 활동 승인
  const handleBatchApproveAll = async () => {
    if (isLiveMode) {
      setLoading(true);
      try {
        const res = await fetch(`${liveApiUrl}?action=batch_approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) {
          alert(`[Cafe24 실시간 DB 연동 성공]\n${data.message}`);
          await fetchMembers();
        } else {
          alert(`일괄 승인 에러: ${data.message}`);
        }
      } catch (err: any) {
        alert(`Cafe24 실서버 통신 실패: ${err.message}`);
      } finally {
        setLoading(false);
      }
    } else {
      const updated = members.map(m => {
        if (m.status === '가입대기') {
          return {
            ...m,
            status: '활동' as const,
            grade: '정회원' as const,
          };
        }
        return m;
      });

      const finalRecalculated = updated.map(m => {
        const familyRegularCount = m.familyCode 
          ? updated.filter(f => f.familyCode === m.familyCode && f.grade === '정회원' && f.status !== '휴면').length 
          : 0;
        return {
          ...m,
          monthlyFee: calculateMonthlyFee(m.grade, m.role, !!m.familyCode, familyRegularCount)
        };
      });

      setMembers(finalRecalculated);
      localStorage.setItem('dobong_members_data', JSON.stringify(finalRecalculated));
      alert('모든 가입대기 신청 회원의 등록 및 활동 승인이 신속히 완료되었습니다. (정회원 등급 전환)');
    }
  };

  // 회비 납부 만료예정일 계산 및 연장 적용 (2단계-2 요건구현)
  const handleExtendPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendingMember) return;

    const numMonths = extendMonths;
    let baseDate = new Date(depositDate);

    if (isLiveMode) {
      setLoading(true);
      try {
        const res = await fetch(`${liveApiUrl}?action=extend_payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: extendingMember.id,
            depositDate,
            months: numMonths
          })
        });
        const data = await res.json();
        if (data.success) {
          setIsExtendModalOpen(false);
          alert(`⚡ [Cafe24 실시간 DB 수납 연정 성공]\n회원명: ${extendingMember.name}\n${data.message}`);
          await fetchMembers();
        } else {
          alert(`수납 연장 실패: ${data.message}`);
        }
      } catch (err: any) {
        alert(`Cafe24 실서버 통신 실패: ${err.message}`);
      } finally {
        setLoading(false);
      }
    } else {
      // 기존 만료일을 확인하여 새 납부 만료(예정)일을 자동으로 순차 계산
      if (extendingMember.paymentExpiryDate) {
        const currentExpiry = new Date(extendingMember.paymentExpiryDate);
        // 기존 만료일이 아직 도래하지 않았고 입금일보다 미래라면 해당 만료일부터 이어 연장
        if (currentExpiry > new Date(depositDate)) {
          baseDate = currentExpiry;
        }
      }

      const newExpiry = new Date(baseDate);
      newExpiry.setMonth(newExpiry.getMonth() + numMonths);

      // 복귀용 날짜 형식 YYYY-MM-DD 변환
      const newExpiryStr = newExpiry.toISOString().split('T')[0];

      const updated = members.map(m => {
        if (m.id === extendingMember.id) {
          return {
            ...m,
            paymentExpiryDate: newExpiryStr,
            memo: (m.memo || '') + ` [수납연장 +${numMonths}개월 (${newExpiryStr})]`
          };
        }
        return m;
      });

      setMembers(updated);
      localStorage.setItem('dobong_members_data', JSON.stringify(updated));
      setIsExtendModalOpen(false);
      alert(`⚡ [실시간 회비 납부 수용 성공]\n회원명: ${extendingMember.name}\n입금확인일: ${depositDate}\n신청연장기한: +${numMonths}개월 현재 완납\n새 납기만료일: ${newExpiryStr}`);
    }
  };

  // 3단계 요건 구현: 구글 시트 기반 월별 납부/면제/미납 판정용 함수 (완벽한 예외방지 가드 포함)
  const getPaymentStatus = (member: Member, year: number, month: number) => {
    if (!member) {
      return 'unpaid';
    }

    if (member.status === '탈퇴') {
      return 'withdrawn';
    }

    if (member.monthlyFee === 0) {
      return 'exempt';
    }

    // 가입월 이전 시점은 '가입 전' 처리
    if (member.joinDate) {
      const joinDateObj = new Date(member.joinDate);
      if (!isNaN(joinDateObj.getTime())) {
        const joinYear = joinDateObj.getFullYear();
        const joinMonth = joinDateObj.getMonth() + 1;

        if (year < joinYear || (year === joinYear && month < joinMonth)) {
          return 'pre-joined';
        }
      }
    }

    if (!member.paymentExpiryDate) {
      return 'unpaid';
    }

    const expiryDateObj = new Date(member.paymentExpiryDate);
    if (isNaN(expiryDateObj.getTime())) {
      return 'unpaid';
    }

    const expiryYear = expiryDateObj.getFullYear();
    const expiryMonth = expiryDateObj.getMonth() + 1;

    if (year < expiryYear) {
      return 'paid';
    } else if (year === expiryYear) {
      return month <= expiryMonth ? 'paid' : 'unpaid';
    } else {
      return 'unpaid';
    }
  };

  // 구글 시트 셀 클릭 시 개별 월 납부/취소 실시간 변경 스위치
  const handleToggleMonthPayment = (memberId: number, targetMonth: number) => {
    const updated = members.map(m => {
      if (m.id === memberId) {
        if (m.status === '탈퇴' || m.monthlyFee === 0) return m;

        const currentStatus = getPaymentStatus(m, selectedDuesYear, targetMonth);
        let newExpiryStr = m.paymentExpiryDate;

        if (currentStatus === 'paid') {
          // 이미 납부된 달 클릭 시: 납기를 바로 전달 말일로 절삭 처리 (납부 취소 효과)
          const prevMonthYear = targetMonth === 1 ? selectedDuesYear - 1 : selectedDuesYear;
          const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1;
          const lastDayOfPrevMonth = new Date(prevMonthYear, prevMonth, 0).getDate();
          const prevMonthStr = String(prevMonth).padStart(2, '0');
          newExpiryStr = `${prevMonthYear}-${prevMonthStr}-${String(lastDayOfPrevMonth).padStart(2, '0')}`;
        } else if (currentStatus === 'unpaid') {
          // 미납된 달 클릭 시: 납기를 해당 달 말일로 연장 처리 (납부 적용 효과)
          const lastDayOfTargetMonth = new Date(selectedDuesYear, targetMonth, 0).getDate();
          const targetMonthStr = String(targetMonth).padStart(2, '0');
          newExpiryStr = `${selectedDuesYear}-${targetMonthStr}-${String(lastDayOfTargetMonth).padStart(2, '0')}`;
        }

        return {
          ...m,
          paymentExpiryDate: newExpiryStr,
          memo: (m.memo || '') + ` [${selectedDuesYear}년 ${targetMonth}월 수납토글 (${newExpiryStr})]`
        };
      }
      return m;
    });

    setMembers(updated);
  };

  // 연납(일시납) 일괄 등록 처리기
  const handleRegisterAnnualDues = (memberId: number) => {
    const updated = members.map(m => {
      if (m.id === memberId) {
        const lastDayStr = `${selectedDuesYear}-12-31`;
        return {
          ...m,
          paymentExpiryDate: lastDayStr,
          memo: (m.memo || '') + ` [${selectedDuesYear}년도 연납완납 일괄등록 (${lastDayStr})]`
        };
      }
      return m;
    });
    setMembers(updated);
  };

  // 외부 공유용 회비 명단 HTML 내보내기 (임원 및 정회원만 포함)
  const handleExportShareableDuesHTML = () => {
    const shareableMembers = members.filter(m => 
      (m.role !== '일반회원' || m.grade === '정회원') && m.status !== '탈퇴'
    );
    
    const htmlContent = generateShareableHTML(systemTitle, shareableMembers);

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'badminton_dues_shareable.html');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV 다운로드 동작 실행
  const handleDownloadCSV = () => {
    if (isLiveMode) {
      window.open(`${liveApiUrl}?action=export_csv`, '_blank');
    } else {
      const csvContent = exportToCSV(members);
      // Excel 한글 인코딩 깨짐 방지 BOM 삽입 (\uFEFF)
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Badminton_Club_Members_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // 템플릿 양식 CSV 다운로드
  const handleDownloadTemplate = () => {
    const template = getSampleCSVTemplate();
    const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'badminton_members_sample_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 직접 CSV 입력 파싱
  const handleApplyCsvText = async () => {
    if (!csvRawText.trim()) {
      setCsvUploadError('분석할 CSV 텍스트 데이터가 비어 있습니다.');
      return;
    }
    try {
      const parsed = parseCSV(csvRawText, members);
      if (parsed.length === 0) {
        setCsvUploadError('올바른 CSV 형식 레코드를 찾지 못했습니다. 칼럼 수가 5개 이상이어야 합니다.');
        return;
      }

      if (isLiveMode) {
        setLoading(true);
        setCsvUploadError('');
        setCsvUploadSuccess('Cafe24 실시간 DB 데이터 일괄 전송을 시작합니다...');
        try {
          let successCount = 0;
          for (const newM of parsed) {
            const existing = members.find(m => m.email.trim() === newM.email.trim());
            const payload = {
              ...newM,
              id: existing ? existing.id : 0
            };
            
            const res = await fetch(`${liveApiUrl}?action=save_member`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
              successCount++;
            }
          }
          await fetchMembers();
          setCsvUploadSuccess(`[Cafe24 실시간 DB 연동 완료] CSV 대량 회원 일괄 전송 성공: 총 ${successCount}명의 회원이 원격 DB에 갱신/등록되었습니다.`);
          setCsvRawText('');
        } catch (err: any) {
          setCsvUploadError(`Cafe24 일괄 등록 과정 중 전송 장애: ${err.message}`);
        } finally {
          setLoading(false);
        }
      } else {
        // 병합 처리 (이메일 중복 제거 포함)
        let duplicateCount = 0;
        const combined = [...members];
        
        parsed.forEach(newM => {
          const hasIdx = combined.findIndex(c => c.email.trim() === newM.email.trim());
          if (hasIdx !== -1) {
            // 중복 이메일은 새 데이터로 덮어쓰기
            combined[hasIdx] = {
              ...newM,
              id: combined[hasIdx].id
            };
            duplicateCount++;
          } else {
            combined.push(newM);
          }
        });

        // 가족회원 할인 보정 계산
        const finalRecalculated = combined.map(m => {
          const familySize = m.familyCode 
            ? combined.filter(f => f.familyCode === m.familyCode).length 
            : 0;
          return {
            ...m,
            monthlyFee: calculateMonthlyFee(m.grade, m.role, familySize >= 1)
          };
        });

        setMembers(finalRecalculated);
        localStorage.setItem('dobong_members_data', JSON.stringify(finalRecalculated));
        setCsvUploadError('');
        setCsvUploadSuccess(`정상적으로 총 ${parsed.length}명의 회원이 로드되었습니다. (중복 이메일 이관 교체: ${duplicateCount}건)`);
        setCsvRawText('');
      }
    } catch (err: any) {
      setCsvUploadError(`데이터 가공 파싱 에러: ${err.message}`);
    }
  };

  // 파일 업로드 핸들러
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCsvRawText(text);
        setCsvUploadSuccess('파일을 성공적으로 업로드하여 입력란에 적재했습니다. 아래 [적용 및 데이터 파싱 병합] 버튼을 클릭해 완료해 주세요!');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  // 카카오 가상회원 간편가입 시뮬레이션
  const handleTriggerKakaoSignup = () => {
    // 1. 해당 필드를 회원 신규 Form에 로드하고, SNS 연동값을 카카오로 지정
    setEditingMember(null);
    setFormName(kakaoSimUser.nickname);
    setFormEmail(kakaoSimUser.email);
    setFormPhone('010-' + Math.floor(1000 + Math.random() * 9000) + '-' + Math.floor(1000 + Math.random() * 9000));
    setFormGrade('신입회원');
    setFormRole('일반회원');
    setFormStatus('가입대기');
    setFormFamilyCode('');
    setFormMemo('카카오 디벨로퍼스 Userinfo API 연동을 통해 카카오 프로필 닉네임 및 이미지, 메일 정보가 안전하게 전달되어 가입 대기 양식을 자동 자동 생성하였습니다.');
    setFormSnsProvider('kakao');
    setFormSnsId(kakaoSimUser.id);
    setFormProfileImage(kakaoSimUser.profile_image);
    setIsFormOpen(true);
    
    // 알림 피드백
    alert(`[가상 카카오 OAuth API 수신 성공]\n이름: ${kakaoSimUser.nickname}\n이메일: ${kakaoSimUser.email}\n프로필 사진을 가입 폼에 바인딩했습니다. 등록을 완료하면 '가입대기' 상태로 동호회 명부에 추가됩니다.`);
  };

  // 구글 관리자 로그인 연동 토글 시뮬레이션
  const handleToggleGoogleAdmin = () => {
    setGoogleAdminUser(prev => {
      const nextState = !prev.isLoggedIn;
      if (nextState) {
        alert(`Google OAuth 인증에 성공하였습니다.\n로그인 계정: ${prev.email}\n${prev.name} 권한으로 관리 세션이 안전하게 체결되었습니다.`);
      } else {
        alert('구글 어드민 세션을 원활히 종료하였습니다.');
      }
      return { ...prev, isLoggedIn: nextState };
    });
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 font-sans text-slate-805 overflow-hidden" id="app-root-container">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 hidden md:flex border-r border-slate-800" id="sidebar-panel">
        <div className="p-5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-1.5 py-0.5 bg-blue-650 text-white text-[9px] font-black rounded uppercase tracking-wider">Shuttlecock v1.0</span>
            <span className="text-[9px] text-emerald-400 font-black bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 animate-pulse">DB ONLINE</span>
          </div>
          <h1 className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
            🏸 셔틀콕 매니저
          </h1>
          <p className="text-[9px] text-slate-500 uppercase tracking-widest font-black">ADMIN WORKSPACE</p>
        </div>
        
        <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto" id="sidebar-nav">
          <div className="px-5 py-1.5 text-[9px] uppercase font-black tracking-widest text-slate-500 selection:bg-transparent">
            명부 및 목록 관리
          </div>
          <button
            onClick={() => setActiveTab('fees')}
            className={`w-full flex items-center px-6 py-2.5 text-xs text-left font-bold transition-all cursor-pointer ${
              activeTab === 'fees'
                ? 'bg-blue-600 text-white border-l-4 border-blue-400'
                : 'text-slate-400 hover:bg-slate-850 hover:text-white border-l-4 border-transparent'
            }`}
          >
            <span className="mr-3 text-sm">💰</span> 회원 회비
          </button>
          
          <button
            onClick={() => setActiveTab('members')}
            className={`w-full flex items-center px-6 py-2.5 text-xs text-left font-bold transition-all cursor-pointer ${
              activeTab === 'members'
                ? 'bg-blue-600 text-white border-l-4 border-blue-400'
                : 'text-slate-400 hover:bg-slate-850 hover:text-white border-l-4 border-transparent'
            }`}
          >
            <span className="mr-3 text-sm">📋</span> 회원 명부관리
          </button>
          
          <button
            onClick={() => setActiveTab('families')}
            className={`w-full flex items-center px-5 py-2.5 text-xs text-left font-bold transition-all cursor-pointer ${
              activeTab === 'families'
                ? 'bg-blue-600 text-white border-l-4 border-blue-400'
                : 'text-slate-400 hover:bg-slate-850 hover:text-white border-l-4 border-transparent'
            }`}
          >
            <span className="mr-3 text-sm">🏠</span> 가족회원 매칭 ({uniqueFamilyList.length})
          </button>
          
          <button
            onClick={() => setActiveTab('csv')}
            className={`w-full flex items-center px-5 py-2.5 text-xs text-left font-bold transition-all cursor-pointer ${
              activeTab === 'csv'
                ? 'bg-blue-600 text-white border-l-4 border-blue-400'
                : 'text-slate-400 hover:bg-slate-850 hover:text-white border-l-4 border-transparent'
            }`}
          >
            <span className="mr-3 text-sm">📤</span> CSV 대량 업/다운
          </button>
          
          <button
            onClick={() => setActiveTab('ddl')}
            className={`w-full flex items-center px-5 py-2.5 text-xs text-left font-bold transition-all cursor-pointer ${
              activeTab === 'ddl'
                ? 'bg-blue-600 text-white border-l-4 border-blue-400'
                : 'text-slate-400 hover:bg-slate-850 hover:text-white border-l-4 border-transparent'
            }`}
          >
            <span className="mr-3 text-sm">⚙️</span> MySQL DDL 설계 구조
          </button>
          
          <button
            onClick={() => setActiveTab('sandbox')}
            className={`w-full flex items-center px-5 py-2.5 text-xs text-left font-bold transition-all cursor-pointer ${
              activeTab === 'sandbox'
                ? 'bg-blue-600 text-white border-l-4 border-blue-400'
                : 'text-slate-400 hover:bg-slate-850 hover:text-white border-l-4 border-transparent'
            }`}
          >
            <span className="mr-3 text-sm">⚡</span> 카카오 OAuth Sandbox
          </button>
        </nav>

        <div className="p-4 bg-slate-950 border-t border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-white text-xs shrink-0">
              {googleAdminUser.isLoggedIn ? 'G' : 'A'}
            </div>
            <div className="text-[10px] overflow-hidden">
              <p className="font-semibold text-slate-200 truncate">
                {googleAdminUser.isLoggedIn ? googleAdminUser.name : '최고관리자 (Google)'}
              </p>
              <p className="text-slate-500 truncate text-[9px]">
                {googleAdminUser.isLoggedIn ? googleAdminUser.email : 'admin@club.com'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden" id="main-content-panel">
        
        {/* Top Header Tools */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0" id="header-tools">
          <div className="flex items-center space-x-3">
            {isEditingTitle ? (
              <div className="flex items-center gap-1.5 animate-fade-in">
                <input
                  type="text"
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48 sm:w-64"
                  placeholder="새 동호회 관리 시스템 제목..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveTitle();
                    } else if (e.key === 'Escape') {
                      setIsEditingTitle(false);
                      setTempTitle(systemTitle);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleSaveTitle}
                  className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg cursor-pointer"
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingTitle(false);
                    setTempTitle(systemTitle);
                  }}
                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-600 text-[10px] font-bold rounded-lg cursor-pointer"
                >
                  취소
                </button>
              </div>
            ) : (
              <h2 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>🏸 {systemTitle}</span>
                <button
                  onClick={() => {
                    setTempTitle(systemTitle);
                    setIsEditingTitle(true);
                  }}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-650 transition-colors cursor-pointer"
                  title="시스템 제목 수정하기"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </h2>
            )}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* 현재 활성 모드 표시 */}
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold rounded border ${
                isLiveMode 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isLiveMode ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                {isLiveMode 
                  ? `실시간 연동: ${liveModeType === 'vercel' ? 'Vercel 서버리스' : 'Cafe24 PHP'}` 
                  : '데모 모드 (로컬)'
                }
              </span>
              
              {/* 로컬 데모 선택 */}
              <button
                onClick={() => {
                  setIsLiveMode(false);
                  localStorage.setItem('cafe24_live_mode', 'false');
                }}
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition-colors border ${
                  !isLiveMode 
                    ? 'bg-slate-700 text-white border-transparent' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                }`}
                title="로컬 웹 브라우저 메모리에만 가상 저장합니다."
                type="button"
              >
                로컬 데모
              </button>

              {/* Cafe24 연동 선택 */}
              <button
                onClick={() => {
                  setIsLiveMode(true);
                  setLiveModeType('cafe24');
                  localStorage.setItem('cafe24_live_mode', 'true');
                  localStorage.setItem('cafe24_live_type', 'cafe24');
                  
                  const currentSaved = localStorage.getItem('cafe24_live_api_url') || '';
                  const initialUrl = currentSaved.includes('vercel') || !currentSaved ? '/api.php' : currentSaved;
                  
                  const promptUrl = prompt('Cafe24 api.php 상용 API 주소를 기입해주십시오:', initialUrl);
                  if (promptUrl !== null) {
                    const finalUrl = promptUrl.trim() || '/api.php';
                    setLiveApiUrl(finalUrl);
                    localStorage.setItem('cafe24_live_api_url', finalUrl);
                  } else {
                    setLiveApiUrl(initialUrl);
                    localStorage.setItem('cafe24_live_api_url', initialUrl);
                  }
                }}
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition-colors border ${
                  isLiveMode && liveModeType === 'cafe24'
                    ? 'bg-amber-500 text-white border-transparent font-extrabold' 
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                }`}
                title="Cafe24 PHP 웹호스팅 서버 MySQL DB로 실시간 연동합니다."
                type="button"
              >
                Cafe24 연동
              </button>

              {/* Vercel 연동 선택 */}
              <button
                onClick={() => {
                  setIsLiveMode(true);
                  setLiveModeType('vercel');
                  localStorage.setItem('cafe24_live_mode', 'true');
                  localStorage.setItem('cafe24_live_type', 'vercel');

                  const currentSaved = localStorage.getItem('cafe24_live_api_url') || '';
                  const initialUrl = currentSaved.includes('api.php') || !currentSaved ? '/api/vercel-db' : currentSaved;

                  const promptUrl = prompt('Vercel API Route 주소를 기입해주십시오 (미기입 시 기본 /api/vercel-db):', initialUrl);
                  if (promptUrl !== null) {
                    const finalUrl = promptUrl.trim() || '/api/vercel-db';
                    setLiveApiUrl(finalUrl);
                    localStorage.setItem('cafe24_live_api_url', finalUrl);
                  } else {
                    setLiveApiUrl(initialUrl);
                    localStorage.setItem('cafe24_live_api_url', initialUrl);
                  }
                }}
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition-colors border ${
                  isLiveMode && liveModeType === 'vercel'
                    ? 'bg-indigo-600 text-white border-transparent font-extrabold' 
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                }`}
                title="Vercel 서버리스 Next.js Route Handlers DB로 실시간 연동합니다."
                type="button"
              >
                Vercel 연동
              </button>

              {isLiveMode && (
                <button
                  onClick={() => {
                    const currentUrl = liveApiUrl;
                    const newUrl = prompt('수정할 새로운 API 주소 경로를 기입하십시오:', currentUrl);
                    if (newUrl !== null) {
                      const finalUrl = newUrl.trim() || (liveModeType === 'vercel' ? '/api/vercel-db' : '/api.php');
                      setLiveApiUrl(finalUrl);
                      localStorage.setItem('cafe24_live_api_url', finalUrl);
                    }
                  }}
                  className="px-1 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded text-[9px] font-mono border border-slate-200"
                  title="현재 연결된 API 주소 수동 제어"
                  type="button"
                >
                  주소셋팅
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadCSV}
              className="px-2.5 py-1.5 border border-slate-300 rounded text-[11px] font-bold text-slate-705 bg-white hover:bg-slate-50 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Download className="w-3 h-3" /> 내보내기
            </button>
            <button
              onClick={() => {
                setActiveTab('csv');
                if (fileInputRef.current) fileInputRef.current.click();
              }}
              className="px-2.5 py-1.5 bg-blue-600 text-white rounded text-[11px] font-bold hover:bg-blue-700 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            >
              <Upload className="w-3 h-3" /> 대량 일괄 업로드
            </button>
          </div>
        </header>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-5 bg-slate-50" id="content-scrollbar">
          
          {/* Quick Stats Summary Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="stats-dashboard">
            
            {/* Stat 1: 전체 회원 */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-[11px] font-bold uppercase tracking-tight">전체 등록 회원</p>
                <p className="text-xl font-black text-slate-900 mt-0.5">{stats.total}명</p>
                <div className="flex items-center gap-1.5 mt-1 text-[9px] font-bold text-slate-400">
                  <span className="text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">활동 {stats.active}</span>
                  <span className="text-purple-650 bg-purple-50 px-1 py-0.5 rounded">승인대기 {stats.pending}</span>
                </div>
              </div>
              <div className="p-2 bg-blue-50 rounded text-blue-600">
                <Users className="w-4 h-4" />
              </div>
            </div>

            {/* Stat 2: 가족 매칭 그룹 */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-[11px] font-bold uppercase tracking-tight">가족회원 그룹</p>
                <p className="text-xl font-black text-slate-900 mt-0.5">{uniqueFamilyList.length}가구</p>
                <div className="flex items-center gap-1 mt-1 text-[9px] font-bold text-slate-400">
                  <Heart className="w-2.5 h-2.5 text-rose-500 fill-rose-500" />
                  <span>{stats.familyMapped}명 실시간 할인 가동</span>
                </div>
              </div>
              <div className="p-2 bg-rose-50 rounded text-rose-500">
                <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
              </div>
            </div>

            {/* Stat 3: 승인 대기 */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs border-l-4 border-l-yellow-450 flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-[11px] font-bold uppercase tracking-tight">승인 대기 (카카오)</p>
                <p className="text-xl font-black text-slate-900 mt-0.5">{stats.pending}명</p>
                <div className="mt-1 text-[9px]">
                  {stats.pending > 0 ? (
                    <button
                      onClick={handleBatchApproveAll}
                      className="text-purple-600 hover:underline font-bold"
                    >
                      모두 활동승인하기 ⚡
                    </button>
                  ) : (
                    <span className="text-slate-400 font-medium">대기자 없음</span>
                  )}
                </div>
              </div>
              <div className="p-2 bg-purple-50 rounded text-purple-600">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>

            {/* Stat 4: 회비 규모 */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs border-l-4 border-l-blue-400 flex items-center justify-between">
              <div>
                <p className="text-slate-550 text-[11px] font-bold uppercase tracking-tight">이번 달 예상 회비</p>
                <p className="text-xl font-black text-slate-900 mt-0.5">₩{stats.expectedRevenue.toLocaleString()}</p>
                <p className="text-[9px] text-slate-400 mt-1 font-bold">20% 패밀리 가산 적용</p>
              </div>
              <div className="p-2 bg-emerald-50 rounded text-emerald-600">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>

          </div>

          {/* Social / Admin Action Warning Alert Bar */}
          <div id="admin-security-alert">
            {googleAdminUser.isLoggedIn ? (
              <div className="flex items-center justify-between bg-sky-50 border border-sky-100 p-3 rounded-lg text-sky-850 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-sky-600" />
                  <span>
                    <strong>구글 어드민 로그인 상태 :</strong> {googleAdminUser.email} (총무 관리자 세션 보유 중)
                  </span>
                </div>
                <button
                  onClick={handleToggleGoogleAdmin}
                  className="text-[10px] font-bold text-sky-800 underline hover:text-sky-950 cursor-pointer"
                >
                  어드민 로그아웃
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white border border-slate-200 p-3 rounded-lg text-slate-700 text-xs gap-3">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span>데모 모드입니다. 관리 세션 로그인 및 카카오 소셜 가입 연계를 그대로 시뮬레이션해 보실 수 있습니다.</span>
                </div>
                <button
                  onClick={handleToggleGoogleAdmin}
                  className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-250 border border-slate-300 text-slate-700 font-bold px-3 py-1 rounded text-[10px] transition-colors cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-rose-500" />
                  <span>구글 이메일 어드민 로그인</span>
                </button>
              </div>
            )}
          </div>

          {/* Mobile Tab Navigation: only displays on mobile screens */}
          <nav className="flex md:hidden bg-white border border-slate-200 p-1 rounded-lg gap-1 overflow-x-auto" id="mobile-tab-navigation">
            {[
              { id: 'fees', label: '회원 회비' },
              { id: 'members', label: '명부관리' },
              { id: 'families', label: '가족 매칭' },
              { id: 'csv', label: 'CSV 대량' },
              { id: 'ddl', label: 'MySQL DDL' },
              { id: 'sandbox', label: '소셜가입' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 min-w-[70px] py-1.5 px-2 text-center text-[11px] font-extrabold rounded-md whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Core Tab Card Panel */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 md:p-5 flex-1" id="tab-content-panel">
            
            {/* TAB: 회원 회비 */}
            {activeTab === 'fees' && (
              <div id="fees-management-view" className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      📊 동호회 회비 및 수납 정산 현황 (구글 시트 연동형 장부)
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      각 회원 및 가족구성원의 직책/가족 연계 할인 상태를 포함한 1~12월 상세 장부입니다.
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    {/* 회비 현황 연도 선택기 */}
                    <div className="flex rounded-lg border border-slate-200 bg-white p-1 gap-0.5 text-xs">
                      {[2024, 2025, 2026, 2027].map((yr) => (
                        <button
                          key={yr}
                          onClick={() => setSelectedDuesYear(yr)}
                          className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                            selectedDuesYear === yr
                              ? 'bg-slate-900 text-white shadow-2xs'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          {yr}년 {yr === 2026 && '⚡'}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={handleExportShareableDuesHTML}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors animate-pulse"
                    >
                      <Download className="w-4 h-4" />
                      <span>명부 내보내기 (HTML)</span>
                    </button>
                  </div>
                </div>

                {/* 실시간 팁 보드 */}
                <div className="bg-indigo-50/50 border border-indigo-100 p-3 rounded-xl flex items-start gap-2 text-xs text-indigo-900">
                  <span className="text-sm">💡</span>
                  <div className="space-y-0.5">
                    <p className="font-bold flex items-center gap-1">회비 실시간 관리 설명서</p>
                    <p className="text-slate-500 leading-relaxed text-[11px]">
                      각 회원의 <strong>1월 ~ 12월 칸(셀)을 클릭</strong>하면 해당 월분 수납이 즉각 토글 <strong>[완납 ↔ 미납]</strong> 처리됩니다. 
                      제일 오른쪽 <strong>비고</strong> 칸에서 연중 12개월 부과액을 한 번에 완납 완료하는 <strong>연납 처리</strong>를 연동 적용할 수 있습니다.
                    </p>
                  </div>
                </div>

                {/* 임원/정회원/준회원/탈퇴회원 파티션 탭 세트 */}
                <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-px">
                  {[
                    { id: 'all', label: `전체 회원 (${members.length}명)` },
                    { id: 'exec', label: `임원 (${members.filter(m => m.role !== '일반회원' && m.status !== '탈퇴').length}명)` },
                    { id: 'regular', label: `정회원(일반) (${members.filter(m => m.grade === '정회원' && m.role === '일반회원' && m.status !== '탈퇴').length}명)` },
                    { id: 'associate', label: `준회원 (${members.filter(m => m.grade === '준회원' && m.status !== '탈퇴').length}명)` },
                    { id: 'withdrawn', label: `탈퇴회원 (${members.filter(m => m.status === '탈퇴').length}명)` }
                  ].map((part) => (
                    <button
                      key={part.id}
                      onClick={() => setFeesPartition(part.id as any)}
                      className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                        feesPartition === part.id
                          ? 'border-indigo-600 text-indigo-600 font-extrabold'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {part.label}
                    </button>
                  ))}
                </div>

                {/* 검색란 */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    placeholder="회원 이름 또는 연락처, 가족 코드로 회비 현황 장부 실시간 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                {/* 구글 스프레드시트 형태 장부 목록 테이블 */}
                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm bg-white">
                  <table className="w-full text-[11px] text-center border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 font-black border-b border-slate-200 text-xs">
                        <th rowSpan={2} className="py-2.5 px-3 text-left font-black border-r border-slate-200">이름</th>
                        <th rowSpan={2} className="py-2.5 px-2 text-center font-black border-r border-slate-200">등급/직책</th>
                        <th rowSpan={2} className="py-2.5 px-2 text-right font-black border-r border-slate-200">정산회비</th>
                        <th colSpan={6} className="py-1.5 px-2 text-center font-black bg-indigo-50/50 text-indigo-850 border-r border-slate-200 border-b border-slate-150">
                          상반기 (1~6월)
                        </th>
                        <th colSpan={6} className="py-1.5 px-2 text-center font-black bg-sky-50/50 text-sky-850 border-r border-slate-200 border-b border-slate-150">
                          하반기 (7~12월)
                        </th>
                        <th rowSpan={2} className="py-2.5 px-3 text-center font-black border-r border-slate-200 min-w-[130px]">비고 (연납 여부)</th>
                        <th rowSpan={2} className="py-2.5 px-2 text-center font-black">납부 연장</th>
                      </tr>
                      <tr className="bg-slate-50 text-slate-650 text-[10px] font-bold border-b border-slate-200">
                        {/* 상반기 */}
                        <th className="py-1 border-r border-slate-150 bg-indigo-50/20 w-11">1월</th>
                        <th className="py-1 border-r border-slate-150 bg-indigo-50/20 w-11">2월</th>
                        <th className="py-1 border-r border-slate-150 bg-indigo-50/20 w-11">3월</th>
                        <th className="py-1 border-r border-slate-150 bg-indigo-50/20 w-11">4월</th>
                        <th className="py-1 border-r border-slate-150 bg-indigo-50/20 w-11">5월</th>
                        <th className="py-1 border-r border-slate-200 bg-indigo-50/20 w-11">6월</th>
                        {/* 하반기 */}
                        <th className="py-1 border-r border-slate-150 bg-sky-50/20 w-11">7월</th>
                        <th className="py-1 border-r border-slate-150 bg-sky-50/20 w-11">8월</th>
                        <th className="py-1 border-r border-slate-150 bg-sky-50/20 w-11">9월</th>
                        <th className="py-1 border-r border-slate-150 bg-sky-50/20 w-11">10월</th>
                        <th className="py-1 border-r border-slate-150 bg-sky-50/20 w-11">11월</th>
                        <th className="py-1 border-r border-slate-200 bg-sky-50/20 w-11">12월</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {filteredFeesMembers.length > 0 ? (
                        filteredFeesMembers.map((member) => {
                          const isPrepaid = member.paymentExpiryDate && member.paymentExpiryDate >= `${selectedDuesYear}-12-31`;
                          
                          return (
                            <tr key={member.id} className="hover:bg-slate-50/40 transition-colors">
                              {/* 이름 */}
                              <td className="py-2 px-3 font-bold text-slate-900 border-r border-slate-150 text-left">
                                <div className="flex items-center gap-2">
                                  <img
                                    src={member.profileImage || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${member.name}`}
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${member.name}`;
                                    }}
                                    className="w-6 h-6 rounded-full object-cover border border-slate-200"
                                    alt=""
                                  />
                                  <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-800">{member.name}</span>
                                    {member.familyCode && (
                                      <span className="text-[9px] text-rose-500 font-extrabold" title={`가족할인대장 (${member.familyCode})`}>👪 가족</span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* 등급 / 직책 */}
                              <td className="py-2 px-2 border-r border-slate-150 text-center">
                                <div className="flex flex-col gap-0.5 justify-center items-center">
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                    member.grade === '정회원' ? 'bg-indigo-50 text-indigo-700 font-extrabold border border-indigo-100' :
                                    member.grade === '준회원' ? 'bg-emerald-50 text-emerald-700 font-extrabold border border-emerald-100' :
                                    'bg-slate-100 text-slate-650'
                                  }`}>
                                    {member.grade}
                                  </span>
                                  {member.role !== '일반회원' && (
                                    <span className="px-1 bg-amber-100 text-amber-800 text-[8px] font-black rounded-sm border border-amber-250">
                                      {member.role}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* 정산 월회비 */}
                              <td className="py-2 px-2 text-right border-r border-slate-150 font-mono font-black text-slate-700">
                                {member.monthlyFee === 0 ? (
                                  <span className="text-emerald-700 bg-emerald-50 px-1 rounded text-[9px] font-semibold border border-emerald-100">免 면제</span>
                                ) : (
                                  <span>₩{(member.monthlyFee / 1000).toFixed(0)}k</span>
                                )}
                              </td>

                              {/* 상반기 1월 ~ 6월 가치 목록 */}
                              {[1, 2, 3, 4, 5, 6].map((mth) => {
                                const status = getPaymentStatus(member, selectedDuesYear, mth);
                                
                                return (
                                  <td 
                                    key={mth} 
                                    className="p-1 border-r border-slate-150 cursor-pointer select-none transition-all duration-100 group"
                                    onClick={() => handleToggleMonthPayment(member.id, mth)}
                                    title={`클릭: 완납/미납 상호 토글\n${member.name} - ${selectedDuesYear}년 ${mth}월`}
                                  >
                                    {status === 'paid' && (
                                      <div className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold py-1.5 rounded text-[10px] flex items-center justify-center gap-0.5 shadow-2xs">
                                        <span>완납</span>
                                      </div>
                                    )}
                                    {status === 'unpaid' && (
                                      <div className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold py-1.5 rounded text-[10px] flex items-center justify-center">
                                        <span>미납</span>
                                      </div>
                                    )}
                                    {status === 'exempt' && (
                                      <div className="bg-slate-100 text-slate-400 font-bold py-1.5 rounded text-[10px] flex items-center justify-center">
                                        <span>면제</span>
                                      </div>
                                    )}
                                    {status === 'pre-joined' && (
                                      <div className="bg-slate-50 text-slate-300 font-medium py-1.5 rounded text-[10px] flex items-center justify-center">
                                        <span>-</span>
                                      </div>
                                    )}
                                    {status === 'withdrawn' && (
                                      <div className="bg-slate-100 text-slate-350 font-medium py-1.5 rounded text-[10px] flex items-center justify-center">
                                        <span>탈퇴</span>
                                      </div>
                                    )}
                                  </td>
                                );
                              })}

                              {/* 하반기 7월 ~ 12월 가치 목록 */}
                              {[7, 8, 9, 10, 11, 12].map((mth) => {
                                const status = getPaymentStatus(member, selectedDuesYear, mth);
                                
                                return (
                                  <td 
                                    key={mth} 
                                    className="p-1 border-r border-slate-150 cursor-pointer select-none transition-all duration-100 group"
                                    onClick={() => handleToggleMonthPayment(member.id, mth)}
                                    title={`클릭: 완납/미납 상호 토글\n${member.name} - ${selectedDuesYear}년 ${mth}월`}
                                  >
                                    {status === 'paid' && (
                                      <div className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold py-1.5 rounded text-[10px] flex items-center justify-center gap-0.5 shadow-2xs">
                                        <span>완납</span>
                                      </div>
                                    )}
                                    {status === 'unpaid' && (
                                      <div className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold py-1.5 rounded text-[10px] flex items-center justify-center">
                                        <span>미납</span>
                                      </div>
                                    )}
                                    {status === 'exempt' && (
                                      <div className="bg-slate-100 text-slate-400 font-bold py-1.5 rounded text-[10px] flex items-center justify-center">
                                        <span>면제</span>
                                      </div>
                                    )}
                                    {status === 'pre-joined' && (
                                      <div className="bg-slate-50 text-slate-300 font-medium py-1.5 rounded text-[10px] flex items-center justify-center">
                                        <span>-</span>
                                      </div>
                                    )}
                                    {status === 'withdrawn' && (
                                      <div className="bg-slate-100 text-slate-350 font-medium py-1.5 rounded text-[10px] flex items-center justify-center">
                                        <span>탈퇴</span>
                                      </div>
                                    )}
                                  </td>
                                );
                              })}

                              {/* 비고: 연납 여부 확인 및 지정 */}
                              <td className="py-2 px-2 border-r border-slate-150 text-center font-bold">
                                {member.status === '탈퇴' ? (
                                  <span className="text-slate-400 text-[10px]">탈퇴 회원</span>
                                ) : member.monthlyFee === 0 ? (
                                  <span className="text-slate-400 text-[10px]">직책 면제</span>
                                ) : isPrepaid ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-full font-black">
                                    👑 연납 완납
                                  </span>
                                ) : (
                                  <div className="flex flex-col items-center justify-center gap-1">
                                    <button
                                      onClick={() => handleRegisterAnnualDues(member.id)}
                                      className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-150 border border-indigo-200 text-indigo-755 rounded text-[9px] font-extrabold cursor-pointer transition-all transition-colors"
                                      title={`${selectedDuesYear}년 전체 12개월 부별 회비를 일괄 자동 연납 상수로 격상`}
                                    >
                                      연납 등록
                                    </button>
                                  </div>
                                )}
                              </td>

                              {/* 납부기한 연장 */}
                              <td className="py-2 px-2">
                                <div className="flex justify-center items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      setExtendingMember(member);
                                      setDepositDate('2026-05-25');
                                      setExtendMonths(3);
                                      setIsExtendModalOpen(true);
                                    }}
                                    className="px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-805 border border-slate-200 rounded-lg text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-all"
                                    title="정확한 입금 지정 연장"
                                  >
                                    <CreditCard className="w-3 h-3 text-slate-400" />
                                    <span>수납+</span>
                                  </button>
                                  <button
                                    onClick={() => handleOpenEditForm(member)}
                                    className="p-1 hover:bg-slate-150 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer transition-all"
                                    title="수정"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={17} className="py-12 text-center text-slate-400">
                            <p className="font-semibold text-sm">해당 회비 분할 필터 조건과 일치하는 회원이 없습니다.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-400 font-semibold p-4 bg-slate-50 rounded-xl border border-slate-150">
                  <p>필터링 검색 결과: {filteredFeesMembers.length}명 조회됨</p>
                  <p className="text-slate-500 font-mono">
                    합계 예측 수액 (해당 년도 기준): ₩{filteredFeesMembers.reduce((acc, cur) => acc + cur.monthlyFee, 0).toLocaleString()} / 월
                  </p>
                </div>
              </div>
            )}

            {/* TAB: 회원 명부관리 (회비 납입 현황 세션 배제) */}
            {activeTab === 'members' && (
              <div id="members-list-view" className="space-y-6">
                
                {/* 주소 기반 구별 퀵 필터 바 */}
                <div className="space-y-2 bg-slate-50 p-4 border border-slate-150 rounded-xl">
                  <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">📍 행정구역 주소 분류 필터 (기초/광역자치단체 기준 자동 분류)</span>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setSelectedRegionFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        selectedRegionFilter === 'all'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      전체 주소 ({members.length}명)
                    </button>
                    {uniqueRegions.map(region => (
                      <button
                        key={region}
                        onClick={() => setSelectedRegionFilter(region)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          selectedRegionFilter === region
                            ? 'bg-blue-600 text-white shadow-2xs border border-transparent'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        {region} ({members.filter(m => extractRegion(m.address) === region).length}명)
                      </button>
                    ))}
                  </div>
                </div>

                {/* 검색 및 제어창 */}
                <div className="flex flex-col lg:flex-row gap-3" id="search-filter-controls">
                  
                  {/* 이름/멜/연락처 검색란 */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                    <input
                      type="text"
                      placeholder="회원의 이름, 연락처, 주소지(특별시/광역/군) 등으로 상세 명부 실시간 검색..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                    />
                  </div>

                  {/* 필터 세트 */}
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={filterGrade}
                      onChange={(e) => setFilterGrade(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="all">전체 등급</option>
                      <option value="정회원">정회원</option>
                      <option value="준회원">준회원</option>
                      <option value="신입회원">신입회원</option>
                      <option value="특별회원">특별회원</option>
                    </select>

                    <select
                      value={filterRole}
                      onChange={(e) => setFilterRole(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="all">전체 직책</option>
                      <option value="회장">회장</option>
                      <option value="총무">총무</option>
                      <option value="감독">감독</option>
                      <option value="일반회원">일반회원</option>
                      <option value="고문">고문</option>
                    </select>

                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="all">전체 상태</option>
                      <option value="활동">활동회원</option>
                      <option value="휴면">휴면중</option>
                      <option value="가입대기">승인대기</option>
                      <option value="탈퇴">탈퇴회원</option>
                    </select>

                    <button
                      onClick={handleOpenCreateForm}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> <span>수동 회원 등록</span>
                    </button>
                  </div>
                </div>

                {/* 테이블 컨테이너 */}
                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs" id="members-list-table">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                        <th className="py-3 px-4 font-black">이름 / 회원등급</th>
                        <th className="py-3 px-4 font-black">가입년도</th>
                        <th className="py-3 px-4 font-black">생년월일</th>
                        <th className="py-3 px-4 font-black">전화번호</th>
                        <th className="py-3 px-4 font-black">거주지 주소</th>
                        <th className="py-3 px-4 font-black">티셔츠 사이즈</th>
                        <th className="py-3 px-4 font-black text-center">동호회 상태</th>
                        <th className="py-3 px-4 font-black text-center">관리옵션</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {filteredRegMembers.length > 0 ? (
                        filteredRegMembers.map((member) => (
                          <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-2.5 px-4 font-bold text-slate-900">
                              <div className="flex items-center gap-3">
                                <img
                                  src={member.profileImage || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${member.name}`}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${member.name}`;
                                  }}
                                  alt=""
                                  className="w-8 h-8 rounded-full object-cover border border-slate-205 bg-slate-100"
                                />
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-extrabold text-slate-900">{member.name}</span>
                                    {member.role !== '일반회원' && (
                                      <span className="px-1 py-0.2 bg-amber-100 text-amber-800 text-[9px] font-black rounded-sm border border-amber-300">
                                        {member.role}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-indigo-600 font-extrabold">{member.grade}</span>
                                    {member.familyCode && (
                                      <span className="text-[10px] text-rose-500 font-extrabold bg-rose-50 px-1 rounded-xs">👪 가족</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 font-semibold text-slate-800">
                              {member.joinYear ? `${member.joinYear}년` : `${member.joinDate.split('-')[0]}년`}
                            </td>
                            <td className="py-2.5 px-4 text-slate-500 font-mono font-bold">
                              {member.birthDate || '-'}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-slate-600">
                              {member.phone}
                            </td>
                            <td className="py-2.5 px-4 max-w-[220px] break-words text-slate-600 font-medium whitespace-pre-wrap">
                              {member.address || <span className="text-slate-300">미등록</span>}
                            </td>
                            <td className="py-2.5 px-4">
                              {member.tShirtSize ? (
                                <span className="px-2 py-0.5 bg-sky-50 text-sky-850 border border-sky-150 rounded text-[10px] font-extrabold whitespace-nowrap">
                                  👕 {member.tShirtSize}
                                </span>
                              ) : (
                                <span className="text-slate-300 text-[10px]">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold whitespace-nowrap ${
                                member.status === '활동' ? 'bg-emerald-100 text-emerald-800' :
                                member.status === '휴면' ? 'bg-slate-100 text-slate-600' :
                                member.status === '탈퇴' ? 'bg-red-50 text-red-700 border border-red-200 font-semibold' :
                                'bg-amber-100 text-amber-800'
                              }`}>
                                {member.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleOpenEditForm(member)}
                                  className="p-1 hover:bg-slate-150 text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer transition-colors"
                                  title="회원 수정"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteMember(member.id)}
                                  className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-650 rounded-lg cursor-pointer transition-colors"
                                  title="회원 제명"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400">
                            <p className="font-semibold text-sm">해당 검색 및 주소지 조건을 충족하는 회원이 없습니다.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 명부 하단 현황 요약 */}
                <div className="mt-4 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-400 font-semibold p-4 bg-slate-50 rounded-xl border border-slate-150">
                  <p>필터링 검색 결과: {filteredRegMembers.length}명 조회됨</p>
                </div>
              </div>
            )}

        {/* TAB 2: 가족회원 ID 매칭기 */}
        {activeTab === 'families' && (
          <div id="family-matcher-view" className="space-y-6">
            
            <div className="bg-indigo-50/50 p-4 border border-indigo-100 rounded-xl text-slate-700">
              <h3 className="text-sm font-bold text-indigo-900 mb-1 flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-indigo-600 fill-indigo-600" />
                가족회원 연계 관리 및 20% 회비 감면 체계
              </h3>
              <p className="text-xs leading-relaxed text-slate-600">
                동일한 가족 코드(<code className="bg-white px-1 text-semibold">FAM-YYYY-XXXX</code>)를 공유하는 동호회 회원들은 기본회비에 <strong>20% 패밀리 가동 할인</strong>을 받게 됩니다.
                코드 발급 연도를 포함한 고유 일련번호가 생성되며, 실시간으로 회비가 재할인 계산되어 통계 데이터에 반영됩니다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* 가족 그룹 목록 카드 */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/30">
                <h4 className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3 flex items-center justify-between">
                  <span>현재 매칭되어 연계 중인 가족 목록</span>
                  <span className="font-mono text-indigo-600">{uniqueFamilyList.length}개 가문 발견</span>
                </h4>

                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                  {uniqueFamilyList.map(famCode => {
                    const famMembers = familyGroups[famCode];
                    // 가상 가족 성명 조합
                    const familyAlias = famMembers.map(m => m.name).join(' * ');
                    
                    return (
                      <div key={famCode} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <span className="bg-rose-50 text-rose-700 py-0.5 px-2.5 rounded-lg text-xs font-bold border border-rose-100 font-mono">
                            {famCode}
                          </span>
                          <span className="text-xs text-rose-500 font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> 훼밀리 20% 할인 중 ({famMembers.length}명)
                          </span>
                        </div>
                        
                        {/* 연결된 유저 세부 카드 */}
                        <div className="space-y-2 mt-3">
                          {famMembers.map(m => (
                            <div key={m.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-xs">
                              <div className="flex items-center gap-2">
                                <img src={m.profileImage} alt={m.name} className="w-6 h-6 rounded-full object-cover" />
                                <div>
                                  <span className="font-bold text-slate-800">{m.name}</span>
                                  <span className="text-[10px] text-slate-400 ml-1.5 font-medium">{m.grade} • {m.role}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-mono font-bold line-through text-slate-300">
                                  ₩{(m.grade === '정회원' ? 30000 : m.grade === '준회원' ? 15000 : 10000).toLocaleString()}
                                </p>
                                <p className="font-mono font-bold text-indigo-600">
                                  ₩{m.monthlyFee.toLocaleString()}원
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {uniqueFamilyList.length === 0 && (
                    <div className="text-center py-10 bg-white border border-dashed border-slate-200 rounded-xl text-slate-400">
                      가족 코드로 매칭된 회원이 없습니다.
                    </div>
                  )}
                </div>
              </div>

              {/* 매칭 시나리오 및 알고리즘 설명 */}
              <div className="border border-slate-200 rounded-xl p-5 space-y-4">
                <h4 className="text-xs uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-emerald-600" />
                  가족회원 자동 연산 및 번호 매칭 규칙 시나리오
                </h4>
                
                <div className="border border-slate-150 p-4 rounded-xl bg-slate-50/50 font-mono text-[11px] text-slate-600 space-y-2">
                  <p className="font-bold text-xs text-slate-800 mb-1 border-b border-slate-200 pb-1">FAM-YYYY-XXXX 산출 로직</p>
                  <div>
                    <span className="text-blue-600">FAM-</span>: 가족(Family) 접두 표식자 고정
                  </div>
                  <div>
                    <span className="text-emerald-600 font-bold">{new Date().getFullYear()}</span>: 올 가입을 지칭하는 연도 데이터 추출
                  </div>
                  <div>
                    <span className="text-indigo-600 font-bold">0003</span>: 해당 연도 생성 그룹의 일련 일련 순번 (자동 sequence 계산)
                  </div>
                </div>

                <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed">
                  <p className="font-semibold text-slate-800">💡 코드 매칭 동작 시나리오 :</p>
                  <ul className="list-disc pl-4 space-y-2">
                    <li>
                      <strong>1. 새로운 가족 유입 시 :</strong> 회원 추가 창에서 &quot;새 가족 코드 발급&quot;을 누르면, 시스템은 중복이 없는 순차적인 유니크 시퀀스를 실시간 산정하여 즉시 부여하고 해당 관계 테이블에 임포트합니다.
                    </li>
                    <li>
                      <strong>2. 기존 가족에 통합 합류 시 :</strong> 다른 부부나 형제 회원의 가족 코드 번호를 입력하거나 복사하여 나의 인적 사항 가족 영역에 대입하여 일치시킴으로써 즉각 매칭됩니다.
                    </li>
                    <li>
                      <strong>3. 할인 및 수납 통제 :</strong> 회비 부과 단계에서 실시간 DB 쿼리를 모방하여 동일 코드를 소지한 사람이 클럽의 정회원 또는 준회원일 시 실시간 20%의 회비를 수납 공제하여 통계를 통합 정리합니다.
                    </li>
                  </ul>
                  <div className="pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={handleOpenCreateForm}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>연습용 가족 회원 등록하기</span>
                    </button>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* TAB 3: 대량 CSV 파일 관리 */}
        {activeTab === 'csv' && (
          <div id="csv-bulk-view" className="space-y-6">
            
            <div className="border-l-4 border-emerald-500 bg-emerald-50 text-slate-700 p-4 rounded-r-xl">
              <h3 className="text-sm font-bold text-emerald-900 mb-1 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                회원 정보 대량 마이그레이션 (CSV 이관 도구)
              </h3>
              <p className="text-xs leading-relaxed text-slate-600">
                기존 장부나 수동 관리 엑셀(Excel) 데이터를 이관할 수 있는 도구입니다. 
                현재 활동 중인 회원 목록을 <strong>Microsoft Excel 호환 완벽 한글(UTF-8 BOM 포함) CSV 파일</strong>로 즉시 내보내거나,
                기존 동호회 자원 파일을 업로드 혹은 직접 수동 복사하여 즉시 명부 원장과 실시간 동기화 병합할 수 있습니다.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* CSV 다운로드 & 다운 필드 세션 */}
              <div className="border border-slate-200 rounded-xl p-5 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">명단 내보내기 및 템플릿 양식 취득</h4>
                <p className="text-xs text-slate-500 leading-normal">
                  현재 활성화된 {members.length}명의 데이터 정합성을 바탕으로 최적화된 CSV 파일을 생성하여 배포 받습니다. 엑셀에서 가공 시 유익합니다.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={handleDownloadCSV}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 font-bold text-white px-4 py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>현재 회원 CSV 다운로드</span>
                  </button>

                  <button
                    onClick={handleDownloadTemplate}
                    className="flex-1 bg-white hover:bg-slate-50 border border-slate-300 font-bold text-slate-700 px-4 py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                    <span>샘플 CSV 양식 다운로드</span>
                  </button>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-150">
                  <p className="text-[11px] font-bold text-slate-400 mb-1.5">이관 업로드 필요 포맷 헤더 규정</p>
                  <code className="text-[10px] text-slate-700 block font-mono bg-white p-2 rounded-md border border-slate-200 overflow-x-auto leading-relaxed">
                    이름,이메일,연락처,회원등급,직책,가족코드,활동상태,가동SNS,가입일자,메모
                  </code>
                  <p className="text-[10px] text-slate-400 mt-1.5 leading-snug">
                    * 회원등급: 정회원, 준회원, 신입회원, 특별회원<br />
                    * 직책: 회장, 총무, 감독, 일반회원, 고문<br />
                    * 활동상태: 활동, 휴면, 가입대기
                  </p>
                </div>
              </div>

              {/* CSV 파싱 드래그 앤 드롭 및 텍스트 직적 병합 */}
              <div className="border border-slate-200 rounded-xl p-5 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>가져오기 (CSV 파일 업로드 및 텍스트 파싱)</span>
                  <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded leading-none">이메일 기준 자동 Merge</span>
                </h4>

                {/* 실제 파일 업로드 버튼 */}
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 bg-slate-50/50 rounded-xl p-6 hover:border-slate-400 transition-colors cursor-pointer relative"
                     onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-xs font-semibold text-slate-700">기존 CSV 파일을 여기에 드롭하거나 클릭하여 선택하세요.</p>
                  <p className="text-[10px] text-slate-400 mt-1">UTF-8 한글 포맷 CSV 전용</p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".csv"
                    className="hidden"
                  />
                </div>

                {/* 텍스트 수동 정사란 */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 block">CSV 형식 데이터 미리보기 또는 직접 복사 후 붙여넣기:</label>
                  <textarea
                    rows={4}
                    value={csvRawText}
                    onChange={(e) => setCsvRawText(e.target.value)}
                    placeholder="이름,이메일,연락처,회원등급,직책,가족코드,활동상태,가동SNS,가입일자,메모 형태로 입력하거나 샘플을 붙여넣으세요..."
                    className="w-full text-[10px] font-mono p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>

                {/* 오류 및 성공 메시지 */}
                {csvUploadError && (
                  <div className="p-3 bg-red-50 text-red-700 border border-red-100 rounded-xl text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{csvUploadError}</span>
                  </div>
                )}
                {csvUploadSuccess && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-xl text-xs flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-600" />
                    <span>{csvUploadSuccess}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 text-xs">
                  {csvRawText && (
                    <button
                      onClick={() => setCsvRawText('')}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-lg font-bold cursor-pointer transition-colors"
                    >
                      초기화
                    </button>
                  )}
                  <button
                    onClick={handleApplyCsvText}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    <span>적용 및 데이터 파싱 병합</span>
                  </button>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* TAB 4: MySQL DDL 및 설계 구조 */}
        {activeTab === 'ddl' && (
          <div id="mysql-ddl-view" className="space-y-6">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-blue-50/50 border border-blue-100 p-4 rounded-xl gap-4">
              <div>
                <h3 className="text-sm font-bold text-blue-900 flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="w-4.5 h-4.5 text-blue-700" />
                  카페24 매니지드 웹호스팅 (Node.js + MySQL 8.x) 호환 DDL 스키마
                </h3>
                <p className="text-xs text-slate-600">
                  실제 카페24 데이터베이스에 접속하여 즉석에서 테이블을 구축할 수 있도록 명확하게 정제 설계된 오리지널 DDL 및 Index 스크립트 모음입니다.
                </p>
              </div>

              <button
                onClick={handleCopyDDL}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-2 rounded-lg text-xs flex items-center gap-1 shadow-xs transition-colors cursor-pointer flex-shrink-0"
              >
                {copiedText ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>복사 완료!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>MySQL DDL 전체 복사</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* DDL 뷰어 */}
              <div className="lg:col-span-7 space-y-2">
                <span className="text-xs font-bold text-slate-400 block uppercase">MySQL table ddl statements</span>
                <div className="relative">
                  <pre className="p-4 bg-slate-900 text-teal-300 rounded-xl text-[10px] font-mono overflow-x-auto leading-relaxed max-h-[480px]">
                    {MYSQL_DDL}
                  </pre>
                  <div className="absolute right-4 top-4 text-xs font-mono font-bold text-slate-500 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">MySQL / MariaDB</div>
                </div>
              </div>

              {/* 테이블 명세 및 외래키 상세 설명 */}
              <div className="lg:col-span-5 space-y-5">
                
                {/* 1 */}
                <div className="p-4 border border-slate-200 rounded-xl space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                    <span className="w-1.5 h-3 bg-rose-500 rounded-xs"></span>
                    핵심 Relational 스키마 특징
                  </h4>
                  <ul className="text-xs text-slate-600 space-y-2.5 list-disc pl-4 leading-normal">
                    <li>
                      <strong>가족 코드 유니크 외래키 수립:</strong> <code>members</code> 테이블의 <code>family_code</code>가 <code>families(family_code)</code>를 참조하여 <strong>실시간 부모 자식 무결성 관계</strong>를 보장합니다. ON DELETE SET NULL, ON UPDATE CASCADE 처리로 안전한 갱신이 약속되어 있습니다.
                    </li>
                    <li>
                      <strong>소셜 로그인 아이디 다중 유니크:</strong> <code>(sns_provider, sns_id)</code> 컬럼 조합에 대해 다중 유니크 키 제약을 두어 동일 계정이 중복 삽입되는 것을 백엔드 & DB 레벨에서 2차 차단합니다.
                    </li>
                    <li>
                      <strong>최적 인덱스(Indexes):</strong> 잦은 회원 검색 대상인 성명, 등급 및 활동 가비지 처리를 대비해 복합 인덱스군을 내장하여 풀 스캔을 탈피하고 서비스 속도를 고수합니다.
                    </li>
                  </ul>
                </div>

                {/* 2 */}
                <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                  <h4 className="text-xs font-bold text-slate-800 mb-2">💡 Cafe24 웹호스팅 Node DB 연결 가이드 (Express 예제)</h4>
                  <p className="text-[11px] text-slate-500 leading-normal mb-3">
                    카페24 Node App 폴더 내의 DB 설정 파일에서 MySQL Pool 객체를 아래와 같이 안전 로드하여 연산합니다.
                  </p>
                  <code className="text-[9px] font-mono text-slate-600 block bg-white p-2 rounded-lg border border-slate-200 overflow-x-auto">
                    {`const mysql = require('mysql2/promise');
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  connectionLimit: 10
});`}
                  </code>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* TAB 5: 로그인 연동 테스트 Sandbox */}
        {activeTab === 'sandbox' && (
          <div id="sandbox-oauth-view" className="space-y-6">
            
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl text-amber-800">
              <h3 className="text-sm font-bold text-amber-900 mb-1 flex items-center gap-1.5">
                <Key className="w-4 h-4 text-amber-700" />
                카카오 / 구글 API 간편 로그인 OAuth 연동 개발 환경 재현 시뮬레이터
              </h3>
              <p className="text-xs leading-relaxed text-amber-800/80">
                실제 카카오 로그인 인증창을 타지 않고도 소셜 API 수신 페이로드를 동조하고 검출하여 가입 신청 화면 및 가입 대기 회원 생성 구조가 어떤 원리로 백엔드에 조달되는지 원클릭으로 가동해 볼 수 있습니다.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* 왼쪽: 카카오 가입 연동 */}
              <div className="border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-amber-700 px-2 py-1 bg-yellow-100 rounded-lg">카카오 유저 정보 수신 Simulator</span>
                  <span className="text-[10px] text-slate-400 font-mono">REST API: /v2/user/me</span>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-3">
                    <img src={kakaoSimUser.profile_image} alt="Kakao Simulation Profile" className="w-12 h-12 rounded-full border border-slate-300" />
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-slate-400 block">카카오 계정 프로필 닉네임 수정 가능</label>
                      <input
                        type="text"
                        value={kakaoSimUser.nickname}
                        onChange={(e) => setKakaoSimUser({ ...kakaoSimUser, nickname: e.target.value })}
                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold w-full focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div>
                      <span className="text-slate-400 block">kakao_user_id</span>
                      <span className="font-bold text-slate-700">{kakaoSimUser.id}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">kakao_email</span>
                      <span className="font-bold text-slate-700">{kakaoSimUser.email}</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-normal">
                  위 모의 카카오 유도 세션을 바탕으로 <strong>카카오 간편 가입</strong>을 클릭하면 OAuth 인가 완료 후 가입 필드가 자동으로 채워진 신규 신입회원 정보작성 양식이 열립니다.
                </p>

                <button
                  onClick={handleTriggerKakaoSignup}
                  className="w-full bg-yellow-150 hover:bg-yellow-200 text-amber-900 font-extrabold px-4 py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer border border-yellow-300"
                >
                  <svg className="w-4 h-4 fill-amber-955" viewBox="0 0 24 24">
                    <path d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.557 1.7 4.785 4.26 6.007-.17.58-.61 2.08-.7 2.39-.1.35.12.35.25.26.1.07 1.63-1.07 2.27-1.52.29.04.59.07.89.07 4.97 0 9-3.186 9-7.115S16.97 3 12 3z" />
                  </svg>
                  <span>카카오로 1초 간편 가입대기 신청 진행하기</span>
                </button>
              </div>

              {/* 오른쪽: 구글 어드민 연동 */}
              <div className="border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-sky-700 px-2 py-1 bg-sky-100 rounded-lg">구글 관리자 OAuth Simulator</span>
                  <span className="text-[10px] text-slate-400 font-mono">Admin Authorization</span>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl space-y-3 font-mono text-[11px] text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>이메일 식별자:</span>
                    <strong className="text-slate-800">{googleAdminUser.email}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                     <span>성명 매칭:</span>
                     <strong className="text-slate-800">{googleAdminUser.name}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                     <span>현재 인가 여부:</span>
                     {googleAdminUser.isLoggedIn ? (
                       <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">PASSED (어드민 총무 인가 완료)</span>
                     ) : (
                       <span className="text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded">DENIED / 세션 없음</span>
                     )}
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  구글 가동 로그인 완료 시, 백엔드는 가동 유저의 이메일 계정 주소가 내부 승인 명부(<code className="bg-white px-1 text-semibold">cheolyong.ryoo@gmail.com</code> 등)에 수렴하는 어드민 일치 정보인지를 사전에 점검하게 통과시킵니다.
                </p>

                <button
                  onClick={handleToggleGoogleAdmin}
                  className={`w-full font-bold px-4 py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    googleAdminUser.isLoggedIn 
                      ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200' 
                      : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-350 shadow-sm'
                  }`}
                >
                  <Lock className="w-4 h-4 text-red-500" />
                  <span>{googleAdminUser.isLoggedIn ? '구글 어드민 세션 종료하기' : '소셜 구글 간편인증 로그인 (관리자 승인)'}</span>
                </button>
              </div>

            </div>

            {/* 하단 개발 가이드 통합 뷰 */}
            <div className="border border-slate-150 p-5 rounded-xl bg-slate-50/50">
              <h4 className="text-xs font-extrabold text-slate-800 mb-2 flex items-center gap-1">
                <Info className="w-4.5 h-4.5 text-indigo-600" />
                카페24 어드민 패스포트 세션 구현 지침 (Node / Express)
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                실 구현 시, 세션 하이제킹 공격을 방어하기 위해 OAuth Access Token을 클라이언트에 방치하지 마시고, 
                서버 세무 Express 쿠키 세션 변수인 <code>req.session.adminUser = userProfile</code>에 저장하여 백엔드 검증 미들웨어 내부에서만 
                관리자 식별 체크를 수행토록 하시는 것을 추천합니다.
              </p>
            </div>

          </div>
        )}

      </div>

      {/* 6. 상세 분석 정보창 (가족ID 발급 시나리오 설명) */}
      <section className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8" id="design-scenarios">
        
        {/* 가족 매칭 규칙 시나리오 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">SCENARIO A</h4>
          <h3 className="text-base font-extrabold text-slate-800 mb-2 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            가족 코드 & 할인 시스템
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            한 동호회에 구성된 가족들은 <strong>최초 연합 시점에 고유 FAM 시드 코드를 할당</strong>받습니다. 
            가족 구성원의 활동 인원이 승인 상태일 때, 해당 코드가 일치하는 모든 사람에게 총무 수납 및 회비 매치 테이블에서 20% 실시간 자동 할인 트리거가 발동하여 최종 회비가 삭감됩니다.
          </p>
        </div>

        {/* 대량 업로드 / 이관 시나리오 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">SCENARIO B</h4>
          <h3 className="text-base font-extrabold text-slate-800 mb-2 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            CSV 파일 대량 이관 및 마이그레이션
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            카페24 Node 호스팅 이관 시 대용량의 회원을 한 명씩 기입하는 부담을 상쇄하기 위해 백엔드 DB의 열 구조와 완전 호환되는 <strong>CSV Bulk 수용 로직</strong>을 탑재함이 핵심입니다. 
            이메일을 유니크 ID로 삼아 중복 시 덮어쓰고, 신설 이메일은 가입대기/승인 회원으로 등록합니다.
          </p>
        </div>

        {/* 카카오 인증 시나리오 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">SCENARIO C</h4>
          <h3 className="text-base font-extrabold text-slate-800 mb-2 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
            카카오&구글 계정 자동 바인딩
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            카카오 로그인 디렉션 결과로 수신받는 고유 토큰 및 SNS 고유 키를 기반으로 프로필 사진과 연락처 성명을 가입 원장과 1:1 결속시킵니다. 
            관리자는 번거롭게 회원들의 프로필 사진을 업로드해 줄 필요 없이, 사용자가 간편 로그인을 함으로써 수려한 도화 정보가 일치 구축됩니다.
          </p>
        </div>

      </section>

      {/* 7. 회원 정보 등록 / 상세 수정 모달 (Immaculate Slideover Panel) */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex justify-end" id="form-modal-overlay">
            
            {/* 반투명 배경 차단 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFormOpen(false)}
              className="absolute inset-0 bg-black"
            />

            {/* 시트 콘텐츠 */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-lg h-full bg-white shadow-2xl flex flex-col z-10"
              id="form-sheet-content"
            >
              
              {/* 시트 헤더 */}
              <div className="p-6 border-b border-slate-150 flex items-center justify-between bg-slate-50">
                <div>
                  <span className="text-[10px] font-bold text-indigo-600 block uppercase tracking-wider">MEMBER RECORD SYSTEM</span>
                  <h3 className="text-lg font-black text-slate-800">
                    {editingMember ? `${editingMember.name} 회원 정보 상세수정` : '신규 배드민턴 회원 수동 온보딩'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 px-2.5 hover:bg-slate-200 text-slate-500 rounded-lg cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 시트 몸통 */}
              <form onSubmit={handleSaveMember} className="flex-1 overflow-y-auto p-6 space-y-4">
                
                {/* 이름 및 프로필 정보 가상 상태 */}
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-150">
                  <div className="relative group">
                    <img
                      src={formProfileImage || 'https://picsum.photos/seed/placeholder/150/150'}
                      alt="프로필 이미지 사진"
                      className="w-16 h-16 rounded-full object-cover border border-slate-300"
                    />
                    <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <span className="text-[9px] text-white font-bold">AUTO PIC</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-1">
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                      {formSnsProvider !== 'none' ? `SNS 연동: ${formSnsProvider}` : '로컬 전용 가입 신청'}
                    </span>
                    <p className="text-xs text-slate-500">
                      실 사용자가 홈페이지 가동 시 소셜 프로필 이미지 헤드가 자동 입력된 가상의 데이터 세션 상태입니다.
                    </p>
                  </div>
                </div>

                {/* 입력: 성명 및 가입년도 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">회원 실명 (성함) <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="예: 홍길동"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full text-sm p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">가입년도 <span className="text-red-500">*</span></label>
                    <select
                      value={formJoinYear}
                      onChange={(e) => setFormJoinYear(e.target.value)}
                      className="w-full text-sm p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {Array.from({ length: 28 }, (_, i) => 2027 - i).map((year) => (
                        <option key={year} value={year.toString()}>{year}년</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 입력: 생년월일 및 연락처 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">생년월일 (생일)</label>
                    <input
                      type="date"
                      value={formBirthDate}
                      onChange={(e) => setFormBirthDate(e.target.value)}
                      className="w-full text-sm p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">연락처 번호 (휴대폰) <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="예: 010-1234-5678"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="w-full text-sm p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>

                {/* 입력: 이메일 */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">이메일 주소 <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    required
                    placeholder="예: name@example.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full text-sm p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>

                {/* 입력: 주소 */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">주소</label>
                  <input
                    type="text"
                    placeholder="예: 서울특별시 도봉구 방학로 123"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    className="w-full text-sm p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* 입력: 티셔츠사이즈 및 회원등급 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">티셔츠 사이즈</label>
                    <select
                      value={formTShirtSize}
                      onChange={(e) => setFormTShirtSize(e.target.value as Member['tShirtSize'])}
                      className="w-full text-sm p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">선택 안함</option>
                      <option value="SS(85)">SS(85)</option>
                      <option value="S(90)">S(90)</option>
                      <option value="M(95)">M(95)</option>
                      <option value="L(100)">L(100)</option>
                      <option value="XL(105)">XL(105)</option>
                      <option value="2XL(110)">2XL(110)</option>
                      <option value="3XL(115)">3XL(115)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">회원 등급</label>
                    <select
                      value={formGrade}
                      onChange={(e) => setFormGrade(e.target.value as Member['grade'])}
                      className="w-full text-sm p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="정회원">정회원 (30,000원)</option>
                      <option value="준회원">준회원 (15,000원)</option>
                      <option value="신입회원">신입회원 (10,000원)</option>
                      <option value="특별회원">특별회원 (가변0원)</option>
                    </select>
                  </div>
                </div>

                {/* 입력: 직책 */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">클럽 내 직책</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as Member['role'])}
                    className="w-full text-sm p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="일반회원">일반회원</option>
                    <option value="회장">회장 (회비 감면)</option>
                    <option value="총무">총무 (회비 감면)</option>
                    <option value="감독">감독 (회비 감면)</option>
                    <option value="고문">고문</option>
                  </select>
                </div>

                {/* 입력: 가족 회원 매칭 연계 코드 */}
                <div className="p-4 bg-rose-50/20 border border-rose-200/50 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-rose-800 flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                      가족 ID 고유 코드 매칭 연계
                    </label>
                    
                    {/* 실시간 시퀀스 자동 생성 단추 */}
                    <button
                      type="button"
                      onClick={handleAutoGenerateFamilyCode}
                      className="bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 font-bold px-2 py-1 rounded text-[10px] cursor-pointer transition-colors"
                    >
                      새 가족코드 발급 ⚡
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="예시: FAM-2026-0001"
                      value={formFamilyCode}
                      onChange={(e) => setFormFamilyCode(e.target.value)}
                      className="flex-1 text-sm p-2.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500 font-mono"
                    />
                    
                    {/* 연합 단추 기입 예시 */}
                    {formFamilyCode && (
                      <button
                        type="button"
                        onClick={() => setFormFamilyCode('')}
                        className="bg-slate-200/50 text-slate-600 px-2.5 rounded-xl text-xs hover:bg-slate-200"
                      >
                        지우기
                      </button>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-400 leading-normal">
                    * 가족 코드를 기입하거나 대표 발급을 받으면 동일 코드를 부착한 다른 회원들과 시스템 내부에서 자동 연결되어 실시간 20% 납부 회비 감면 할인이 이루어집니다.
                  </p>
                </div>

                {/* 입력: 승인 상태 */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">동호회 활동 임무 상태</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['활동', '휴면', '가입대기', '탈퇴'].map((statusOption) => (
                      <button
                        key={statusOption}
                        type="button"
                        onClick={() => setFormStatus(statusOption as Member['status'])}
                        className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                          formStatus === statusOption
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-205 hover:bg-slate-50'
                        }`}
                      >
                        {statusOption}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 실시간 회비 연산 시각화 안내 */}
                <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl font-mono text-[11px] text-indigo-950 space-y-1">
                  <span className="font-extrabold text-xs text-indigo-900 block mb-1">실시간 자동 회비 계산 결과</span>
                  <div className="flex justify-between">
                    <span>선택한 등급 기본액:</span>
                    <span>
                      {formGrade === '정회원' ? '30,000원' :
                       formGrade === '준회원' ? '15,000원' :
                       formGrade === '신입회원' ? '10,000원' : '0원'}
                    </span>
                  </div>
                  <div className="flex justify-between text-amber-700">
                    <span>클럽 직책에 따른 감면률:</span>
                    <span>
                      {formRole === '회장' || formRole === '총무' || formRole === '감독' 
                        ? '100% 감면' 
                        : '감면 대상 없음'}
                    </span>
                  </div>
                  <div className="flex justify-between text-rose-600">
                    <span>가족회원 매칭 코드 가산 할인:</span>
                    <span>{formFamilyCode.trim() !== '' ? '20% 제휴 할인 작동' : '없음'}</span>
                  </div>
                  <div className="border-t border-indigo-200 mt-2 pt-1.5 flex justify-between font-black text-xs text-indigo-900">
                    <span>최종 월 납입 회비 금액:</span>
                    <span>
                      ₩{calculateMonthlyFee(formGrade, formRole, formFamilyCode.trim() !== '').toLocaleString()}원
                    </span>
                  </div>
                </div>

                {/* 입력: 관리자 비고 메모 */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">회원 특이사항 (메모)</label>
                  <textarea
                    rows={2}
                    placeholder="신체 조건, 레슨 이력 및 납부 내역 정산 특이사항 적재 가능..."
                    value={formMemo}
                    onChange={(e) => setFormMemo(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

              </form>

              {/* 시트 하단 버튼 */}
              <div className="p-6 border-t border-slate-150 bg-slate-50 flex gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 bg-white hover:bg-slate-100 text-slate-600 font-bold py-3 px-4 rounded-xl border border-slate-200 transition-colors cursor-pointer text-center"
                >
                  취소 완료
                </button>
                <button
                  onClick={handleSaveMember}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-xs cursor-pointer transition-all text-center"
                >
                  {editingMember ? '수정 사항 적용 저장' : '동호회 신규 회원 등록'}
                </button>
              </div>

            </motion.div>

          </div>
        )}
      </AnimatePresence>

      {/* 8. 웹 아일랜드 푸터 (High Density Compact Style) */}
      <footer className="w-full mt-8 border-t border-slate-200 pt-5 pb-6 text-center text-xs text-slate-400 font-medium leading-relaxed max-w-4xl mx-auto" id="app-footer">
        <p className="mb-1 font-bold text-slate-500">배드민턴 동호회 회원 관리 시스템 • Cafe24 Managed Webhosting Node-MySQL Dedicated Spec.</p>
        <p>
          본 시스템의 데이터는 Cafe24 웹 데이터베이스 릴레이션 스키마와 100% 정합하도록 설계되었습니다.<br />
          소셜 카카오 & 구글 계정 및 CSV 업로드를 통해 고착화된 회원 이관 데이터를 실시간 원장 동기화하여 검토할 수 있습니다.
        </p>
        <p className="mt-2 text-[10px] font-mono text-slate-300">© 2026 Admin Panel Solution. All Rights Reserved.</p>
      </footer>

        </div>

        {/* Humble, clean Status Bar Footer */}
        <footer className="h-8 bg-slate-100 text-slate-500 border-t border-slate-200 text-xs px-6 flex items-center justify-between shrink-0 select-none z-10" id="status-bar-footer">
          <span>연동 서버: Cafe24 Managed 웹호스팅 & MySQL DB Engine</span>
          <span>시스템 작동 상태: 정상 가동 중 (Demo Mode)</span>
        </footer>

      </main>
    </div>
  );
}
