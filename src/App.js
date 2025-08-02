import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { 
  Clock, MapPin, User, Calendar, Shield, Mail, Lock, Eye, EyeOff, 
  Plus, Edit2, Trash2, Settings, Download, CheckCircle, XCircle, 
  AlertCircle, Send, Coffee, AlertTriangle, TrendingUp, Users, 
  FileText, BarChart3, Home, ClipboardList, Save, CalendarDays
} from 'lucide-react';

const IntegratedAttendanceApp = () => {
  // 現在のユーザーと表示画面
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('login');
  const [showPassword, setShowPassword] = useState(false);

  // 打刻関連の状態
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isWorking, setIsWorking] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [workStartTime, setWorkStartTime] = useState(null);
  const [breakStartTime, setBreakStartTime] = useState(null);
  const [todayWorkTime, setTodayWorkTime] = useState(0);
  const [totalBreakTime, setTotalBreakTime] = useState(0);
  const [currentBreakTime, setCurrentBreakTime] = useState(0);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [showOvertimeForm, setShowOvertimeForm] = useState(false);
  const [overtimeReason, setOvertimeReason] = useState('');
  const [overtimeReasonSubmitted, setOvertimeReasonSubmitted] = useState(false);
  const [currentLocation, setCurrentLocation] = useState('位置情報取得中...');
  const [holidayWorkAlert, setHolidayWorkAlert] = useState('');

  // 休暇・代休関連の状態
  const [showVacationModal, setShowVacationModal] = useState(false);
  const [showHolidayWorkModal, setShowHolidayWorkModal] = useState(false);
  const [vacationForm, setVacationForm] = useState({
    startDate: '',
    endDate: '',
    reason: '',
    vacationType: 'paid_full' // paid_full, paid_morning, paid_afternoon, compensatory, holiday_work
  });

  // ユーザー管理関連の状態
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showAttendanceEditModal, setShowAttendanceEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingAttendance, setEditingAttendance] = useState(null);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'member',
    team: '開発チーム',
    vacationDaysTotal: 20
  });

  // レポート関連の状態
  const [selectedPeriod, setSelectedPeriod] = useState('2025-08');
  const [selectedYear, setSelectedYear] = useState('2025');
  const [attendanceAlerts, setAttendanceAlerts] = useState([]);

  // ログインフォーム
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: ''
  });

  // データベース代わりのローカルストレージ管理
  const [users, setUsers] = useState([]);
  const [vacationRequests, setVacationRequests] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);

  // 祝日データ（2025年）
  const holidays = [
    '2025-01-01', '2025-01-13', '2025-02-11', '2025-02-23', '2025-03-20',
    '2025-04-29', '2025-05-03', '2025-05-04', '2025-05-05', '2025-07-21',
    '2025-08-11', '2025-09-15', '2025-09-23', '2025-10-13', '2025-11-03',
    '2025-11-23', '2025-12-23'
  ];

  // 休日判定関数
  const isHoliday = (date) => {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const dayOfWeek = new Date(dateStr).getDay();
    return dayOfWeek === 0 || dayOfWeek === 6 || holidays.includes(dateStr);
  };

  // 今日の休暇状態を取得
  const getTodayVacationStatus = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayVacation = vacationRequests.find(
      req => req.userId === currentUser?.id && 
             req.status === 'approved' &&
             req.startDate <= today && 
             req.endDate >= today
    );
    
    return {
      hasVacation: !!todayVacation,
      vacationType: todayVacation?.vacationType || null,
      isHalfDay: todayVacation?.vacationType?.includes('morning') || todayVacation?.vacationType?.includes('afternoon')
    };
  };

  // 今日の休日出勤許可状態を取得
  const getTodayHolidayWorkStatus = () => {
    const today = new Date().toISOString().split('T')[0];
    const holidayWork = vacationRequests.find(
      req => req.userId === currentUser?.id && 
             req.vacationType === 'holiday_work' &&
             req.status === 'approved' &&
             req.startDate === today
    );
    return !!holidayWork;
  };

  // 代休残日数を計算
  const getCompensatoryDaysRemaining = () => {
    if (!currentUser) return 0;
    const approvedHolidayWork = vacationRequests.filter(
      req => req.userId === currentUser.id && 
             req.vacationType === 'holiday_work' && 
             req.status === 'approved'
    ).length;
    
    const usedCompensatory = vacationRequests.filter(
      req => req.userId === currentUser.id && 
             req.vacationType === 'compensatory' && 
             req.status === 'approved'
    ).length;
    
    return approvedHolidayWork - usedCompensatory;
  };

  // 初期データの設定
  useEffect(() => {
    const storedUsers = localStorage.getItem('attendanceApp_users');
    const storedVacationRequests = localStorage.getItem('attendanceApp_vacationRequests');
    const storedAttendanceData = localStorage.getItem('attendanceApp_attendanceData');
    const loggedInUser = localStorage.getItem('currentUser');

    if (storedUsers) {
      setUsers(JSON.parse(storedUsers));
    } else {
      const initialUsers = [
        {
          id: 1,
          email: 'host@company.com',
          password: 'password123',
          name: '管理者 太郎',
          role: 'host',
          team: '開発チーム',
          vacationDaysTotal: 20,
          vacationDaysUsed: 8,
          vacationDaysRemaining: 12,
          createdAt: new Date().toISOString(),
          status: 'active'
        },
        {
          id: 2,
          email: 'tanaka@company.com',
          password: 'password123',
          name: '田中 太郎',
          role: 'member',
          team: '開発チーム',
          vacationDaysTotal: 20,
          vacationDaysUsed: 5,
          vacationDaysRemaining: 15,
          createdAt: new Date().toISOString(),
          status: 'active'
        }
      ];
      setUsers(initialUsers);
      localStorage.setItem('attendanceApp_users', JSON.stringify(initialUsers));
    }

    if (storedVacationRequests) {
      setVacationRequests(JSON.parse(storedVacationRequests));
    } else {
      const initialVacationRequests = [];
      setVacationRequests(initialVacationRequests);
      localStorage.setItem('attendanceApp_vacationRequests', JSON.stringify(initialVacationRequests));
    }

    if (storedAttendanceData) {
      setAttendanceData(JSON.parse(storedAttendanceData));
    } else {
      const initialAttendanceData = [];
      setAttendanceData(initialAttendanceData);
      localStorage.setItem('attendanceApp_attendanceData', JSON.stringify(initialAttendanceData));
    }

    if (loggedInUser) {
      setCurrentUser(JSON.parse(loggedInUser));
      setCurrentView('dashboard');
    }
  }, []);

  // 打刻漏れアラート生成（月曜日にチェック）
  useEffect(() => {
    if (currentUser?.role === 'host' && new Date().getDay() === 1) {
      generateAttendanceAlerts();
    }
  }, [currentUser, attendanceData, vacationRequests]);

  const generateAttendanceAlerts = () => {
    const lastWeek = [];
    const today = new Date();
    
    // 先週の平日を取得
    for (let i = 7; i >= 1; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      if (!isHoliday(date)) {
        lastWeek.push(date.toISOString().split('T')[0]);
      }
    }
    
    const alerts = [];
    users.filter(user => user.role === 'member' && user.status === 'active').forEach(user => {
      lastWeek.forEach(date => {
        // 休暇申請がない日をチェック
        const hasVacation = vacationRequests.some(
          req => req.userId === user.id && 
                 req.status === 'approved' &&
                 req.startDate <= date && 
                 req.endDate >= date
        );
        
        if (!hasVacation) {
          const attendance = attendanceData.find(
            record => record.userId === user.id && record.date === date
          );
          
          if (!attendance || !attendance.clockIn) {
            alerts.push({
              id: `${user.id}-${date}`,
              userId: user.id,
              userName: user.name,
              date: date,
              type: 'missing_clockin'
            });
          }
        }
      });
    });
    
    setAttendanceAlerts(alerts);
  };

  // データ保存関数
  const saveUsersToStorage = (newUsers) => {
    localStorage.setItem('attendanceApp_users', JSON.stringify(newUsers));
  };

  const saveVacationRequestsToStorage = (newRequests) => {
    setVacationRequests(newRequests);
    localStorage.setItem('attendanceApp_vacationRequests', JSON.stringify(newRequests));
  };

  const saveAttendanceDataToStorage = (newAttendanceData) => {
    setAttendanceData(newAttendanceData);
    localStorage.setItem('attendanceApp_attendanceData', JSON.stringify(newAttendanceData));
  };

  // 位置情報取得
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation(`東京都新宿区西新宿 (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
        },
        () => setCurrentLocation('位置情報取得失敗'),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // 現在時刻更新
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 休日出勤チェック
  useEffect(() => {
    if (isHoliday(new Date()) && currentUser) {
      const hasPermission = getTodayHolidayWorkStatus();
      if (!hasPermission) {
        setHolidayWorkAlert('本日は休日です。休日出勤には事前申請が必要です。');
      } else {
        setHolidayWorkAlert('');
      }
    } else {
      setHolidayWorkAlert('');
    }
  }, [currentUser, vacationRequests]);

  // 勤務時間計算
  useEffect(() => {
    if (isWorking && workStartTime && !isOnBreak) {
      const timer = setInterval(() => {
        const now = new Date();
        const totalElapsed = Math.floor((now - workStartTime) / 1000);
        const effectiveWorkTime = totalElapsed - totalBreakTime - currentBreakTime;
        setTodayWorkTime(Math.max(0, effectiveWorkTime));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isWorking, workStartTime, isOnBreak, totalBreakTime, currentBreakTime]);

  // 現在の休憩時間をリアルタイムで更新
  useEffect(() => {
    if (isOnBreak && breakStartTime) {
      const timer = setInterval(() => {
        const now = new Date();
        const breakElapsed = Math.floor((now - breakStartTime) / 1000);
        setCurrentBreakTime(breakElapsed);
      }, 1000);
      return () => clearInterval(timer);
    } else if (!isOnBreak) {
      setCurrentBreakTime(0);
    }
  }, [isOnBreak, breakStartTime]);

  // 残業フォーム表示チェック
  useEffect(() => {
    const todayVacation = getTodayVacationStatus();
    const standardWorkTime = todayVacation.isHalfDay ? 4 * 3600 : 8 * 3600;
    if (isWorking && todayWorkTime > standardWorkTime && !overtimeReasonSubmitted && !showOvertimeForm) {
      setShowOvertimeForm(true);
    }
  }, [todayWorkTime, isWorking, overtimeReasonSubmitted, showOvertimeForm]);

  // ログイン処理
  const handleLogin = () => {
    const user = users.find(u => u.email === loginForm.email);
    if (user && user.password === loginForm.password && user.status === 'active') {
      setCurrentUser(user);
      localStorage.setItem('currentUser', JSON.stringify(user));
      setCurrentView('dashboard');
      setLoginForm({ email: '', password: '' });
    } else {
      alert('メールアドレスまたはパスワードが間違っているか、アカウントが無効です');
    }
  };

  // ログアウト処理
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    setCurrentView('login');
    setIsWorking(false);
    setIsOnBreak(false);
    setTodayWorkTime(0);
    setTotalBreakTime(0);
    setCurrentBreakTime(0);
    setAttendanceRecords([]);
  };

  // 打刻関連の関数
  const handleClockIn = () => {
    // 休日チェック
    if (isHoliday(new Date()) && !getTodayHolidayWorkStatus()) {
      alert('休日出勤には事前申請が必要です。休日管理から申請してください。');
      return;
    }

    const now = new Date();
    setIsWorking(true);
    setWorkStartTime(now);
    setTotalBreakTime(0);
    setOvertimeReasonSubmitted(false);
    
    const record = {
      id: Date.now(),
      type: 'clock-in',
      timestamp: now,
      location: currentLocation
    };
    setAttendanceRecords(prev => [record, ...prev]);

    const newAttendanceRecord = {
      id: Date.now(),
      userId: currentUser.id,
      date: now.toISOString().split('T')[0],
      clockIn: now.toTimeString().split(' ')[0],
      clockOut: null,
      breakTime: 0,
      workTime: 0,
      overtime: 0,
      overtimeReason: null,
      location: currentLocation,
      isHolidayWork: isHoliday(now)
    };

    const existingIndex = attendanceData.findIndex(
      record => record.userId === currentUser.id && record.date === now.toISOString().split('T')[0]
    );

    if (existingIndex >= 0) {
      const updatedData = [...attendanceData];
      updatedData[existingIndex] = { ...updatedData[existingIndex], ...newAttendanceRecord };
      saveAttendanceDataToStorage(updatedData);
    } else {
      saveAttendanceDataToStorage([...attendanceData, newAttendanceRecord]);
    }
  };

  const handleClockOut = () => {
    const now = new Date();
    setIsWorking(false);
    setIsOnBreak(false);
    
    const record = {
      id: Date.now(),
      type: 'clock-out',
      timestamp: now,
      location: currentLocation
    };
    setAttendanceRecords(prev => [record, ...prev]);

    const today = now.toISOString().split('T')[0];
    const existingIndex = attendanceData.findIndex(
      record => record.userId === currentUser.id && record.date === today
    );

    if (existingIndex >= 0) {
      const updatedData = [...attendanceData];
      const workTimeMinutes = Math.floor(todayWorkTime / 60);
      const todayVacation = getTodayVacationStatus();
      const overtimeMinutes = Math.max(0, workTimeMinutes - (todayVacation.isHalfDay ? 240 : 480));
      
      updatedData[existingIndex] = {
        ...updatedData[existingIndex],
        clockOut: now.toTimeString().split(' ')[0],
        breakTime: Math.floor(totalBreakTime / 60),
        workTime: workTimeMinutes,
        overtime: overtimeMinutes
      };
      saveAttendanceDataToStorage(updatedData);
    }
  };

  const handleBreakStart = () => {
    const now = new Date();
    setIsOnBreak(true);
    setBreakStartTime(now);
    
    const record = {
      id: Date.now(),
      type: 'break-start',
      timestamp: now,
      location: currentLocation
    };
    setAttendanceRecords(prev => [record, ...prev]);
  };

  const handleBreakEnd = () => {
    const now = new Date();
    setIsOnBreak(false);
    
    if (breakStartTime) {
      const breakDuration = Math.floor((now - breakStartTime) / 1000);
      setTotalBreakTime(prev => prev + breakDuration);
    }
    
    const record = {
      id: Date.now(),
      type: 'break-end',
      timestamp: now,
      location: currentLocation
    };
    setAttendanceRecords(prev => [record, ...prev]);
  };

  const handleOvertimeReasonSubmit = () => {
    if (overtimeReason.trim()) {
      setOvertimeReasonSubmitted(true);
      setShowOvertimeForm(false);
      
      const today = new Date().toISOString().split('T')[0];
      const existingIndex = attendanceData.findIndex(
        record => record.userId === currentUser.id && record.date === today
      );

      if (existingIndex >= 0) {
        const updatedData = [...attendanceData];
        updatedData[existingIndex] = {
          ...updatedData[existingIndex],
          overtimeReason: overtimeReason
        };
        saveAttendanceDataToStorage(updatedData);
      }

      setOvertimeReason('');
      alert('残業理由がホストに送信されました');
    }
  };

  // 休暇・代休関連の関数
  const calculateDays = (startDate, endDate, vacationType) => {
    if (vacationType.includes('morning') || vacationType.includes('afternoon')) {
      return 0.5;
    }
    if (vacationType === 'compensatory' || vacationType === 'holiday_work') {
      return 1;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDiff = end.getTime() - start.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
  };

  const handleVacationApplication = () => {
    if (!vacationForm.startDate || !vacationForm.reason.trim()) {
      alert('すべての項目を入力してください');
      return;
    }

    const endDate = (vacationForm.vacationType.includes('morning') || 
                    vacationForm.vacationType.includes('afternoon') ||
                    vacationForm.vacationType === 'compensatory' ||
                    vacationForm.vacationType === 'holiday_work') 
      ? vacationForm.startDate 
      : vacationForm.endDate;

    if (!endDate && vacationForm.vacationType.startsWith('paid_full')) {
      alert('終了日を入力してください');
      return;
    }

    const days = calculateDays(vacationForm.startDate, endDate, vacationForm.vacationType);
    
    // 有給の場合の残日数チェック
    if (vacationForm.vacationType.startsWith('paid_') && days > currentUser.vacationDaysRemaining) {
      alert('残り有給日数が不足しています');
      return;
    }

    // 代休の場合の残日数チェック
    if (vacationForm.vacationType === 'compensatory' && getCompensatoryDaysRemaining() < days) {
      alert('取得可能な代休日数が不足しています');
      return;
    }

    // 休日出勤の場合は休日チェック
    if (vacationForm.vacationType === 'holiday_work' && !isHoliday(vacationForm.startDate)) {
      alert('休日出勤申請は休日のみ可能です');
      return;
    }

    const newRequest = {
      id: Date.now(),
      userId: currentUser.id,
      startDate: vacationForm.startDate,
      endDate: endDate,
      days: days,
      vacationType: vacationForm.vacationType,
      reason: vacationForm.reason,
      status: 'pending',
      appliedAt: new Date().toISOString(),
      approvedAt: null,
      approvedBy: null
    };

    saveVacationRequestsToStorage([...vacationRequests, newRequest]);
    setVacationForm({ startDate: '', endDate: '', reason: '', vacationType: 'paid_full' });
    setShowVacationModal(false);
    setShowHolidayWorkModal(false);
    alert('申請を送信しました');
  };

  const handleVacationApproval = (requestId, action, rejectionReason = null) => {
    const updatedRequests = vacationRequests.map(request => {
      if (request.id === requestId) {
        const updatedRequest = {
          ...request,
          status: action,
          approvedAt: new Date().toISOString(),
          approvedBy: currentUser.id,
          rejectionReason: rejectionReason
        };

        if (action === 'approved') {
          const requestUser = users.find(u => u.id === request.userId);
          if (requestUser && request.vacationType.startsWith('paid_')) {
            const updatedUsers = users.map(user => {
              if (user.id === request.userId) {
                return {
                  ...user,
                  vacationDaysUsed: user.vacationDaysUsed + request.days,
                  vacationDaysRemaining: user.vacationDaysRemaining - request.days
                };
              }
              return user;
            });
            saveUsersToStorage(updatedUsers);
            setUsers(updatedUsers);
            
            if (currentUser.id === request.userId) {
              const updatedCurrentUser = updatedUsers.find(u => u.id === request.userId);
              setCurrentUser(updatedCurrentUser);
              localStorage.setItem('currentUser', JSON.stringify(updatedCurrentUser));
            }
          }
        }

        return updatedRequest;
      }
      return request;
    });

    saveVacationRequestsToStorage(updatedRequests);
    alert(`申請を${action === 'approved' ? '承認' : '却下'}しました`);
  };

  // ユーザー管理関数
  const handleAddUser = () => {
    if (!newUserForm.name || !newUserForm.email || !newUserForm.password) {
      alert('すべての項目を入力してください');
      return;
    }

    if (users.some(user => user.email === newUserForm.email)) {
      alert('このメールアドレスは既に使用されています');
      return;
    }

    const newUser = {
      id: Date.now(),
      ...newUserForm,
      vacationDaysUsed: 0,
      vacationDaysRemaining: newUserForm.vacationDaysTotal,
      createdAt: new Date().toISOString(),
      status: 'active'
    };

    const updatedUsers = [...users, newUser];
    saveUsersToStorage(updatedUsers);
    setUsers(updatedUsers);
    
    setShowAddUserModal(false);
    setNewUserForm({ name: '', email: '', password: '', role: 'member', team: '開発チーム', vacationDaysTotal: 20 });
    alert(`${newUser.name}さんを追加しました`);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setNewUserForm({
      name: user.name,
      email: user.email,
      password: user.password,
      role: user.role,
      team: user.team,
      vacationDaysTotal: user.vacationDaysTotal
    });
    setShowEditUserModal(true);
  };

  const handleUpdateUser = () => {
    if (!newUserForm.name || !newUserForm.email) {
      alert('名前とメールアドレスは必須です');
      return;
    }

    if (users.some(user => user.email === newUserForm.email && user.id !== editingUser.id)) {
      alert('このメールアドレスは既に使用されています');
      return;
    }

    const updatedUsers = users.map(user => {
      if (user.id === editingUser.id) {
        const vacationDaysChange = newUserForm.vacationDaysTotal - user.vacationDaysTotal;
        return {
          ...user,
          ...newUserForm,
          vacationDaysRemaining: user.vacationDaysRemaining + vacationDaysChange
        };
      }
      return user;
    });

    saveUsersToStorage(updatedUsers);
    setUsers(updatedUsers);
      
    if (currentUser.id === editingUser.id) {
      const updatedCurrentUser = updatedUsers.find(u => u.id === editingUser.id);
      setCurrentUser(updatedCurrentUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedCurrentUser));
    }

    setShowEditUserModal(false);
    setEditingUser(null);
    setNewUserForm({ name: '', email: '', password: '', role: 'member', team: '開発チーム', vacationDaysTotal: 20 });
    alert('ユーザー情報を更新しました');
  };

  const handleDeleteUser = (user) => {
    if (user.role === 'host') {
      alert('ホストユーザーは削除できません');
      return;
    }

    if (window.confirm(`${user.name}さんを削除しますか？この操作は取り消せません。`)) {
      const updatedUsers = users.map(u => 
        u.id === user.id ? { ...u, status: 'inactive' } : u
      );
      saveUsersToStorage(updatedUsers);
      setUsers(updatedUsers);
      alert(`${user.name}さんを削除しました`);
    }
  };

  // 勤怠データ編集
  const handleEditAttendance = (record) => {
    setEditingAttendance({
      ...record,
      clockIn: record.clockIn || '',
      clockOut: record.clockOut || '',
      breakTime: record.breakTime || 0,
      overtimeReason: record.overtimeReason || ''
    });
    setShowAttendanceEditModal(true);
  };

  const handleUpdateAttendance = () => {
    const updatedData = attendanceData.map(record => {
      if (record.id === editingAttendance.id) {
        const clockInTime = editingAttendance.clockIn ? new Date(`2000-01-01T${editingAttendance.clockIn}`) : null;
        const clockOutTime = editingAttendance.clockOut ? new Date(`2000-01-01T${editingAttendance.clockOut}`) : null;
        
        let workTime = 0;
        if (clockInTime && clockOutTime) {
          workTime = Math.max(0, (clockOutTime - clockInTime) / (1000 * 60) - editingAttendance.breakTime);
        }
        
        const overtime = Math.max(0, workTime - 480);
        
        return {
          ...record,
          clockIn: editingAttendance.clockIn,
          clockOut: editingAttendance.clockOut,
          breakTime: editingAttendance.breakTime,
          workTime: workTime,
          overtime: overtime,
          overtimeReason: editingAttendance.overtimeReason
        };
      }
      return record;
    });
    
    saveAttendanceDataToStorage(updatedData);
    setShowAttendanceEditModal(false);
    setEditingAttendance(null);
    alert('勤怠データを更新しました');
  };

  // Excel出力関数
  const exportToExcel = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = attendanceData.filter(record => record.date === today);
    
    const csvData = [
      ['氏名', 'メールアドレス', '出勤時刻', '退勤時刻', '休憩時間(分)', '勤務時間(分)', '残業時間(分)', '残業理由', '勤務場所', '休日出勤'],
      ...todayAttendance.map(record => {
        const user = users.find(u => u.id === record.userId);
        return [
          user?.name || '',
          user?.email || '',
          record.clockIn || '',
          record.clockOut || '',
          record.breakTime || 0,
          record.workTime || 0,
          record.overtime || 0,
          record.overtimeReason || '',
          record.location || '',
          record.isHolidayWork ? '○' : ''
        ];
      })
    ];

    const csvContent = csvData.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
    
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `勤怠データ_${today}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportReport = (type, period) => {
    alert(`${type === 'monthly' ? '月次' : '年次'}レポート（${period}）をエクスポートしました`);
  };

  // ユーティリティ関数
  const formatTime = (date) => {
    return date.toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  const formatWorkTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatMinutesToTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  const getVacationTypeLabel = (vacationType) => {
    const typeLabels = {
      paid_full: '有給全日',
      paid_morning: '有給午前半休',
      paid_afternoon: '有給午後半休',
      compensatory: '代休',
      holiday_work: '休日出勤'
    };
    return typeLabels[vacationType] || '有給全日';
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle, text: '承認待ち' },
      approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle, text: '承認済み' },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle, text: '却下' }
    };
    
    const config = statusConfig[status];
    const IconComponent = config.icon;
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <IconComponent className="w-3 h-3 mr-1" />
        {config.text}
      </span>
    );
  };

  const getAttendanceByDate = (date) => {
    return attendanceData
      .filter(record => record.date === date)
      .map(record => ({
        ...record,
        user: users.find(u => u.id === record.userId)
      }));
  };

  // 勤務時間計算
  const todayVacation = getTodayVacationStatus();
  const standardWorkTime = todayVacation.isHalfDay ? 4 * 3600 : 8 * 3600;
  const isOvertime = todayWorkTime > standardWorkTime;
  const remainingTime = Math.max(0, standardWorkTime - todayWorkTime);
  const overtimeSeconds = Math.max(0, todayWorkTime - standardWorkTime);
  const progressPercentage = Math.min(100, (todayWorkTime / standardWorkTime) * 100);

  // チャート用データ
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
  const teamComparisonData = React.useMemo(() => {
    return users
      .filter(user => user.role === 'member' && user.status === 'active')
      .map(user => {
        const userAttendance = attendanceData.filter(record => record.userId === user.id);
        const totalWorkHours = userAttendance.reduce((sum, record) => sum + (record.workTime || 0), 0) / 60;
        const totalOvertime = userAttendance.reduce((sum, record) => sum + (record.overtime || 0), 0) / 60;
        
        return {
          name: user.name,
          workHours: Math.round(totalWorkHours),
          overtime: Math.round(totalOvertime),
          vacation: user.vacationDaysUsed,
          efficiency: Math.round(Math.random() * 20 + 80)
        };
      });
  }, [users, attendanceData]);

  // 月次データの動的生成（平日のみ出勤率計算）
  const generateMonthlyData = (period) => {
    const monthAttendance = attendanceData.filter(record => record.date.startsWith(period));
    const totalWorkHours = monthAttendance.reduce((sum, record) => sum + (record.workTime || 0), 0);
    const totalOvertimeHours = monthAttendance.reduce((sum, record) => sum + (record.overtime || 0), 0);
    
    const members = users
      .filter(user => user.role === 'member' && user.status === 'active')
      .map(user => {
        const userMonthAttendance = monthAttendance.filter(record => record.userId === user.id);
        const workHours = userMonthAttendance.reduce((sum, record) => sum + (record.workTime || 0), 0) / 60;
        const overtimeHours = userMonthAttendance.reduce((sum, record) => sum + (record.overtime || 0), 0) / 60;
        
        // 平日のみの出勤率計算
        const workdaysInMonth = 22; // 概算
        const attendedWorkdays = userMonthAttendance.filter(record => !record.isHolidayWork).length;
        const attendanceRate = workdaysInMonth > 0 ? Math.round((attendedWorkdays / workdaysInMonth) * 100) : 0;
        
        return {
          id: user.id,
          name: user.name,
          workHours: Math.round(workHours),
          overtimeHours: Math.round(overtimeHours),
          vacationDays: user.vacationDaysUsed,
          attendanceRate: attendanceRate
        };
      });

    return {
      totalWorkHours: Math.round(totalWorkHours),
      totalOvertimeHours: Math.round(totalOvertimeHours),
      vacationDaysUsed: members.reduce((sum, member) => sum + member.vacationDays, 0),
      attendanceRate: members.length > 0 ? Math.round(members.reduce((sum, member) => sum + member.attendanceRate, 0) / members.length) : 0,
      members
    };
  };

  // 年次データの動的生成
  const generateYearlyData = (year) => {
    const months = [
      { month: '1月', workHours: 168, overtimeHours: 12, vacationDays: 3 },
      { month: '2月', workHours: 152, overtimeHours: 8, vacationDays: 4 },
      { month: '3月', workHours: 176, overtimeHours: 15, vacationDays: 2 },
      { month: '4月', workHours: 160, overtimeHours: 6, vacationDays: 5 },
      { month: '5月', workHours: 144, overtimeHours: 4, vacationDays: 8 },
      { month: '6月', workHours: 168, overtimeHours: 18, vacationDays: 3 },
      { month: '7月', workHours: 172, overtimeHours: 22, vacationDays: 6 },
      { month: '8月', workHours: 162, overtimeHours: 12, vacationDays: 8 }
    ];

    return {
      months,
      totalWorkHours: months.reduce((sum, month) => sum + month.workHours, 0),
      totalOvertimeHours: months.reduce((sum, month) => sum + month.overtimeHours, 0),
      totalVacationDays: months.reduce((sum, month) => sum + month.vacationDays, 0)
    };
  };

  if (currentView === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-8">
        <div className="max-w-sm mx-auto bg-white rounded-2xl shadow-2xl p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-800">勤怠管理システム</h1>
            <p className="text-gray-500 mt-2 text-sm">ログインしてください</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                メールアドレス
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="your-email@company.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                パスワード
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                  className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="パスワードを入力"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              onClick={handleLogin}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-200"
            >
              ログイン
            </button>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 text-center">
              <strong>デモ用ログイン情報:</strong><br/>
              管理者: host@company.com<br/>
              メンバー: tanaka@company.com<br/>
              パスワード: password123
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* ヘッダー */}
        <div className="bg-white shadow-lg rounded-b-3xl p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-gray-800 text-sm sm:text-base">{currentUser?.name}</h2>
                <p className="text-xs sm:text-sm text-gray-500">
                  {currentUser?.role === 'host' ? 'チームホスト' : 'チームメンバー'} - {currentUser?.team}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-2 sm:px-4 sm:py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
            >
              ログアウト
            </button>
          </div>
        </div>

        {/* メインナビゲーション */}
        <div className="mb-4 sm:mb-6">
          <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-lg">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                  currentView === 'dashboard' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Home className="w-4 h-4 inline-block mr-1 sm:mr-2" />
                <span className="hidden sm:inline">ダッシュボード</span>
                <span className="sm:hidden">ホーム</span>
              </button>
              <button
                onClick={() => setCurrentView('attendance')}
                className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                  currentView === 'attendance' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Clock className="w-4 h-4 inline-block mr-1 sm:mr-2" />
                打刻
              </button>
              <button
                onClick={() => setCurrentView('vacation')}
                className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                  currentView === 'vacation' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Calendar className="w-4 h-4 inline-block mr-1 sm:mr-2" />
                <span className="hidden sm:inline">休日管理</span>
                <span className="sm:hidden">休日</span>
              </button>
              {currentUser?.role === 'host' && (
                <>
                  <button
                    onClick={() => setCurrentView('userManagement')}
                    className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                      currentView === 'userManagement' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Users className="w-4 h-4 inline-block mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">ユーザー管理</span>
                    <span className="sm:hidden">ユーザー</span>
                  </button>
                  <button
                    onClick={() => setCurrentView('attendanceReport')}
                    className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                      currentView === 'attendanceReport' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <ClipboardList className="w-4 h-4 inline-block mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">勤怠管理</span>
                    <span className="sm:hidden">勤怠</span>
                  </button>
                  <button
                    onClick={() => setCurrentView('reports')}
                    className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                      currentView === 'reports' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4 inline-block mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">レポート</span>
                    <span className="sm:hidden">レポ</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 打刻漏れアラート（管理者のみ） */}
        {currentUser?.role === 'host' && attendanceAlerts.length > 0 && (
          <div className="mb-4 sm:mb-6">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 shadow-lg">
              <div className="flex items-center mb-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                <h3 className="font-semibold text-red-800">打刻漏れアラート</h3>
              </div>
              <div className="space-y-2">
                {attendanceAlerts.slice(0, 5).map(alert => (
                  <div key={alert.id} className="flex items-center justify-between p-2 bg-white rounded-lg">
                    <div>
                      <span className="font-medium text-red-800">{alert.userName}</span>
                      <span className="text-sm text-red-600 ml-2">
                        {new Date(alert.date).toLocaleDateString('ja-JP')} 打刻なし
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const user = users.find(u => u.id === alert.userId);
                        const newRecord = {
                          id: Date.now(),
                          userId: alert.userId,
                          date: alert.date,
                          clockIn: '',
                          clockOut: '',
                          breakTime: 0,
                          workTime: 0,
                          overtime: 0,
                          overtimeReason: '',
                          location: '管理者による追加',
                          isHolidayWork: false
                        };
                        setEditingAttendance(newRecord);
                        setShowAttendanceEditModal(true);
                      }}
                      className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                    >
                      修正
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ダッシュボード */}
        {currentView === 'dashboard' && (
          <div className="space-y-4 sm:space-y-6">
            {/* 概要カード */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">今日の勤務時間</p>
                    <p className={`text-xl sm:text-2xl font-bold ${isOvertime ? 'text-red-600' : 'text-blue-600'}`}>
                      {formatWorkTime(todayWorkTime)}
                    </p>
                  </div>
                  <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">有給残日数</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-600">{currentUser?.vacationDaysRemaining}日</p>
                  </div>
                  <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">代休残日数</p>
                    <p className="text-xl sm:text-2xl font-bold text-purple-600">{getCompensatoryDaysRemaining()}日</p>
                  </div>
                  <CalendarDays className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500" />
                </div>
              </div>
            </div>

            {/* クイックアクション */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">クイックアクション</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <button
                  onClick={() => setCurrentView('attendance')}
                  className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-center"
                >
                  <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 mx-auto mb-2" />
                  <p className="font-medium text-blue-800 text-sm">打刻</p>
                </button>
                <button
                  onClick={() => setShowVacationModal(true)}
                  className="p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors text-center"
                >
                  <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 mx-auto mb-2" />
                  <p className="font-medium text-green-800 text-sm">有給申請</p>
                </button>
                <button
                  onClick={() => setShowHolidayWorkModal(true)}
                  className="p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors text-center"
                >
                  <CalendarDays className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600 mx-auto mb-2" />
                  <p className="font-medium text-purple-800 text-sm">休日出勤</p>
                </button>
                {currentUser?.role === 'host' && (
                  <button
                    onClick={() => setCurrentView('reports')}
                    className="p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors text-center"
                  >
                    <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600 mx-auto mb-2" />
                    <p className="font-medium text-orange-800 text-sm">レポート</p>
                  </button>
                )}
              </div>
            </div>

            {/* 最近のアクティビティ */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">最近のアクティビティ</h3>
              <div className="space-y-3">
                {attendanceRecords.slice(0, 3).map((record) => (
                  <div key={record.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-3 h-3 rounded-full ${
                      record.type === 'clock-in' ? 'bg-green-500' : 
                      record.type === 'clock-out' ? 'bg-red-500' :
                      record.type === 'break-start' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`} />
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 text-sm">
                        {record.type === 'clock-in' ? '出勤' : 
                         record.type === 'clock-out' ? '退勤' :
                         record.type === 'break-start' ? '休憩開始' : '休憩終了'}
                      </p>
                      <p className="text-xs text-gray-500">{formatTime(record.timestamp)}</p>
                    </div>
                  </div>
                ))}
                {attendanceRecords.length === 0 && (
                  <p className="text-gray-500 text-center py-4 text-sm">アクティビティがありません</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 打刻画面 */}
        {currentView === 'attendance' && (
          <div className="space-y-4 sm:space-y-6">
            {/* 休日出勤アラート */}
            {holidayWorkAlert && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 shadow-lg">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                  <p className="text-sm font-medium text-orange-800">{holidayWorkAlert}</p>
                </div>
              </div>
            )}

            {/* 半休通知 */}
            {todayVacation.hasVacation && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 shadow-lg">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-orange-600" />
                  <p className="text-sm font-medium text-orange-800">
                    本日は{getVacationTypeLabel(todayVacation.vacationType)}です
                  </p>
                </div>
                {todayVacation.isHalfDay && (
                  <p className="text-xs text-orange-600 mt-1">
                    勤務時間: 4時間 | 休憩: なし | 4時間超過で残業扱い
                  </p>
                )}
              </div>
            )}

            {/* 勤務状況 */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  本日の勤務時間
                  {todayVacation.isHalfDay && (
                    <span className="ml-2 text-sm text-orange-600 font-normal">(半休日)</span>
                  )}
                </h3>
                <p className={`text-2xl sm:text-3xl font-bold ${isOvertime ? 'text-red-600' : 'text-blue-600'}`}>
                  {formatWorkTime(todayWorkTime)}
                </p>
                <div className="flex justify-center space-x-4 mt-2 text-sm">
                  {!isOvertime ? (
                    <p className="text-gray-500">
                      残り: {formatWorkTime(remainingTime)}
                    </p>
                  ) : (
                    <p className="text-red-500 font-medium">
                      残業: {formatWorkTime(overtimeSeconds)}
                    </p>
                  )}
                  <p className="text-gray-500">
                    休憩: {formatWorkTime(totalBreakTime + currentBreakTime)}
                    {isOnBreak && (
                      <span className="ml-1 text-yellow-600 font-medium">
                        (+{formatWorkTime(currentBreakTime)})
                      </span>
                    )}
                  </p>
                </div>
                {isOnBreak && (
                  <div className="mt-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                      休憩中 ({formatWorkTime(currentBreakTime)})
                    </span>
                  </div>
                )}
                {isOvertime && !isOnBreak && overtimeReasonSubmitted && (
                  <div className="mt-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                      残業中
                    </span>
                  </div>
                )}
              </div>
              
              {/* プログレスバー */}
              <div className="w-full bg-gray-200 rounded-full h-3 mb-4 relative overflow-hidden">
                <div 
                  className={`h-3 rounded-full transition-all duration-300 ${
                    isOvertime 
                      ? 'bg-gradient-to-r from-red-500 to-red-600' 
                      : 'bg-gradient-to-r from-blue-500 to-blue-600'
                  }`}
                  style={{ width: `${Math.min(100, progressPercentage)}%` }}
                />
              </div>
              
              <div className="flex justify-between text-sm text-gray-600">
                <span>0時間</span>
                <span className={isOvertime ? 'text-red-600 font-medium' : ''}>
                  {todayVacation.isHalfDay ? '4時間' : '8時間'}
                </span>
                {isOvertime && (
                  <span className="text-red-600 font-medium">
                    {Math.ceil(todayWorkTime / 3600)}時間
                  </span>
                )}
              </div>
            </div>

            {/* 打刻ボタン */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={handleClockIn}
                  disabled={isWorking || (isHoliday(new Date()) && !getTodayHolidayWorkStatus())}
                  className={`py-3 sm:py-4 px-4 rounded-xl font-semibold text-white transition-all duration-200 text-sm sm:text-base ${
                    isWorking || (isHoliday(new Date()) && !getTodayHolidayWorkStatus())
                      ? 'bg-gray-300 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 active:scale-95'
                  }`}
                >
                  <Clock className="w-4 h-4 inline-block mr-2" />
                  出勤
                </button>
                
                <button
                  onClick={handleClockOut}
                  disabled={!isWorking}
                  className={`py-3 sm:py-4 px-4 rounded-xl font-semibold text-white transition-all duration-200 text-sm sm:text-base ${
                    !isWorking 
                      ? 'bg-gray-300 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 active:scale-95'
                  }`}
                >
                  <Clock className="w-4 h-4 inline-block mr-2" />
                  退勤
                </button>
              </div>

              {!todayVacation.isHalfDay && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleBreakStart}
                    disabled={!isWorking || isOnBreak}
                    className={`py-3 sm:py-4 px-4 rounded-xl font-semibold text-white transition-all duration-200 text-sm sm:text-base ${
                      !isWorking || isOnBreak
                        ? 'bg-gray-300 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 active:scale-95'
                    }`}
                  >
                    <Coffee className="w-4 h-4 inline-block mr-2" />
                    休憩
                  </button>
                  
                  <button
                    onClick={handleBreakEnd}
                    disabled={!isOnBreak}
                    className={`py-3 sm:py-4 px-4 rounded-xl font-semibold text-white transition-all duration-200 text-sm sm:text-base ${
                      !isOnBreak
                        ? 'bg-gray-300 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 active:scale-95'
                    }`}
                  >
                    <Clock className="w-4 h-4 inline-block mr-2" />
                    休憩戻る
                  </button>
                </div>
              )}

              {todayVacation.isHalfDay && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <div className="flex items-center justify-center space-x-2 text-gray-500">
                    <Coffee className="w-4 h-4" />
                    <span className="text-sm font-medium">半休日のため休憩機能は無効です</span>
                  </div>
                </div>
              )}
              
              <div className="mt-4 flex items-center justify-center text-sm text-gray-500">
                <MapPin className="w-4 h-4 mr-1" />
                <span className="truncate max-w-xs">{currentLocation}</span>
              </div>
            </div>

            {/* 打刻履歴 */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">本日の打刻履歴</h3>
              
              {attendanceRecords.length === 0 ? (
                <p className="text-gray-500 text-center py-4 text-sm">まだ打刻がありません</p>
              ) : (
                <div className="space-y-3">
                  {attendanceRecords.map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          record.type === 'clock-in' ? 'bg-green-500' : 
                          record.type === 'clock-out' ? 'bg-red-500' :
                          record.type === 'break-start' ? 'bg-yellow-500' : 'bg-blue-500'
                        }`} />
                        <div>
                          <p className="font-medium text-gray-800 text-sm">
                            {record.type === 'clock-in' ? '出勤' : 
                             record.type === 'clock-out' ? '退勤' :
                             record.type === 'break-start' ? '休憩開始' : '休憩終了'}
                          </p>
                          <p className="text-xs text-gray-500">{record.location}</p>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-gray-800">
                        {formatTime(record.timestamp)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 休日管理画面 */}
        {currentView === 'vacation' && (
          <div className="space-y-4 sm:space-y-6">
            {/* 休暇残日数 */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">休暇残日数</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <p className="text-xl sm:text-2xl font-bold text-blue-600">{currentUser?.vacationDaysTotal}</p>
                  <p className="text-sm text-gray-600">年間有給</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg text-center">
                  <p className="text-xl sm:text-2xl font-bold text-red-600">{currentUser?.vacationDaysUsed}</p>
                  <p className="text-sm text-gray-600">有給使用済</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <p className="text-xl sm:text-2xl font-bold text-green-600">{currentUser?.vacationDaysRemaining}</p>
                  <p className="text-sm text-gray-600">有給残り</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg text-center">
                  <p className="text-xl sm:text-2xl font-bold text-purple-600">{getCompensatoryDaysRemaining()}</p>
                  <p className="text-sm text-gray-600">代休残り</p>
                </div>
              </div>
            </div>

            {/* 申請ボタン */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">休暇申請</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowVacationModal(true)}
                    className="bg-green-500 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center space-x-2 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>有給申請</span>
                  </button>
                  <button
                    onClick={() => setShowHolidayWorkModal(true)}
                    className="bg-purple-500 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg hover:bg-purple-600 transition-colors flex items-center space-x-2 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>休日出勤</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {vacationRequests
                  .filter(request => request.userId === currentUser?.id)
                  .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt))
                  .map((request) => (
                  <div key={request.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="font-medium text-gray-800 text-sm">
                          {new Date(request.startDate).toLocaleDateString('ja-JP')}
                          {request.startDate !== request.endDate && ` 〜 ${new Date(request.endDate).toLocaleDateString('ja-JP')}`}
                        </span>
                        <span className="text-sm text-gray-600">
                          ({request.days}日間・{getVacationTypeLabel(request.vacationType)})
                        </span>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{request.reason}</p>
                    <p className="text-xs text-gray-500">
                      申請日: {new Date(request.appliedAt).toLocaleDateString('ja-JP')}
                    </p>
                    {request.status === 'rejected' && request.rejectionReason && (
                      <div className="mt-2 p-2 bg-red-50 rounded border-l-4 border-red-200">
                        <p className="text-sm text-red-800">
                          <strong>却下理由:</strong> {request.rejectionReason}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 承認管理（ホストのみ） */}
            {currentUser?.role === 'host' && (
              <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">承認待ち申請</h3>
                
                <div className="space-y-4">
                  {vacationRequests
                    .filter(request => request.status === 'pending')
                    .map((request) => {
                      const user = users.find(u => u.id === request.userId);
                      return (
                        <div key={request.id} className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                                <User className="w-4 h-4 text-white" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-800">{user?.name}</p>
                                <p className="text-sm text-gray-600">
                                  {new Date(request.startDate).toLocaleDateString('ja-JP')}
                                  {request.startDate !== request.endDate && ` 〜 ${new Date(request.endDate).toLocaleDateString('ja-JP')}`}
                                  ({request.days}日間・{getVacationTypeLabel(request.vacationType)})
                                </p>
                              </div>
                            </div>
                            {getStatusBadge(request.status)}
                          </div>
                          
                          <p className="text-sm text-gray-700 mb-3">
                            <strong>理由:</strong> {request.reason}
                          </p>
                          
                          <div className="flex space-x-3">
                            <button
                              onClick={() => handleVacationApproval(request.id, 'approved')}
                              className="flex-1 bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center space-x-2 text-sm"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>承認</span>
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt('却下理由を入力してください:');
                                if (reason) {
                                  handleVacationApproval(request.id, 'rejected', reason);
                                }
                              }}
                              className="flex-1 bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center space-x-2 text-sm"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>却下</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  
                  {vacationRequests.filter(request => request.status === 'pending').length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-500 text-sm">承認待ちの申請はありません</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ユーザー管理画面（ホストのみ） */}
        {currentView === 'userManagement' && currentUser?.role === 'host' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">ユーザー管理</h3>
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="bg-green-500 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center space-x-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>新規追加</span>
                </button>
              </div>

              <div className="space-y-3">
                {users.filter(user => user.team === currentUser.team && user.status === 'active').map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{member.name}</p>
                        <p className="text-xs text-gray-500">{member.email}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            member.role === 'host' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {member.role === 'host' ? 'ホスト' : 'メンバー'}
                          </span>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            有給残: {member.vacationDaysRemaining}日
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => handleEditUser(member)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {member.role !== 'host' && (
                        <button 
                          onClick={() => handleDeleteUser(member)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 勤怠管理画面（ホストのみ） */}
        {currentView === 'attendanceReport' && currentUser?.role === 'host' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">本日の勤怠状況</h3>
                  <p className="text-sm text-gray-500">{formatDate(new Date())}</p>
                </div>
                <button
                  onClick={exportToExcel}
                  className="bg-green-500 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center space-x-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Excel出力</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 p-3 sm:p-4 rounded-lg text-center">
                  <p className="text-xl sm:text-2xl font-bold text-blue-600">
                    {getAttendanceByDate(new Date().toISOString().split('T')[0]).length}
                  </p>
                  <p className="text-sm text-gray-600">出勤者数</p>
                </div>
                <div className="bg-red-50 p-3 sm:p-4 rounded-lg text-center">
                  <p className="text-xl sm:text-2xl font-bold text-red-600">
                    {getAttendanceByDate(new Date().toISOString().split('T')[0])
                      .filter(record => record.overtime > 0).length}
                  </p>
                  <p className="text-sm text-gray-600">残業者数</p>
                </div>
                <div className="bg-yellow-50 p-3 sm:p-4 rounded-lg text-center">
                  <p className="text-xl sm:text-2xl font-bold text-yellow-600">
                    {Math.round(getAttendanceByDate(new Date().toISOString().split('T')[0])
                      .reduce((sum, record) => sum + (record.workTime || 0), 0) / 60)}
                  </p>
                  <p className="text-sm text-gray-600">総勤務時間</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="pb-3 text-sm font-medium text-gray-600">氏名</th>
                      <th className="pb-3 text-sm font-medium text-gray-600">出勤</th>
                      <th className="pb-3 text-sm font-medium text-gray-600">退勤</th>
                      <th className="pb-3 text-sm font-medium text-gray-600">休憩</th>
                      <th className="pb-3 text-sm font-medium text-gray-600">勤務時間</th>
                      <th className="pb-3 text-sm font-medium text-gray-600">残業</th>
                      <th className="pb-3 text-sm font-medium text-gray-600">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getAttendanceByDate(new Date().toISOString().split('T')[0]).map((record) => (
                      <tr key={record.id} className="border-b border-gray-100">
                        <td className="py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-500 rounded-full flex items-center justify-center">
                              <User className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-800 text-sm">{record.user?.name}</p>
                              <p className="text-xs text-gray-500">{record.user?.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 text-sm text-gray-600">{record.clockIn || '-'}</td>
                        <td className="py-4 text-sm text-gray-600">{record.clockOut || '-'}</td>
                        <td className="py-4 text-sm text-gray-600">{formatMinutesToTime(record.breakTime || 0)}</td>
                        <td className="py-4">
                          <span className={`text-sm font-medium ${
                            (record.workTime || 0) >= 480 ? 'text-green-600' : 'text-yellow-600'
                          }`}>
                            {formatMinutesToTime(record.workTime || 0)}
                          </span>
                        </td>
                        <td className="py-4">
                          {(record.overtime || 0) > 0 ? (
                            <div>
                              <span className="text-sm font-medium text-red-600">
                                {formatMinutesToTime(record.overtime)}
                              </span>
                              {record.overtimeReason && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {record.overtimeReason}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-4">
                          <button
                            onClick={() => handleEditAttendance(record)}
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {getAttendanceByDate(new Date().toISOString().split('T')[0]).length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm">本日の勤怠データがありません</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* レポート画面（ホストのみ） */}
        {currentView === 'reports' && currentUser?.role === 'host' && (
          <div className="space-y-4 sm:space-y-6">
            {/* KPI カード */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">今月の総勤務時間</p>
                    <p className="text-xl sm:text-2xl font-bold text-blue-600">
                      {generateMonthlyData(selectedPeriod).totalWorkHours}h
                    </p>
                  </div>
                  <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">今月の残業時間</p>
                    <p className="text-xl sm:text-2xl font-bold text-red-600">
                      {generateMonthlyData(selectedPeriod).totalOvertimeHours}h
                    </p>
                  </div>
                  <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-red-500" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">今月の有給取得</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-600">
                      {generateMonthlyData(selectedPeriod).vacationDaysUsed}日
                    </p>
                  </div>
                  <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">出勤率</p>
                    <p className="text-xl sm:text-2xl font-bold text-purple-600">
                      {generateMonthlyData(selectedPeriod).attendanceRate}%
                    </p>
                  </div>
                  <Users className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500" />
                </div>
              </div>
            </div>

            {/* 月次レポート */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 space-y-2 sm:space-y-0">
                <div className="flex items-center space-x-4">
                  <h3 className="text-lg font-semibold text-gray-800">月次レポート</h3>
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="2025-08">2025年8月</option>
                    <option value="2025-07">2025年7月</option>
                    <option value="2025-06">2025年6月</option>
                  </select>
                </div>
                <button
                  onClick={() => exportReport('monthly', selectedPeriod)}
                  className="bg-green-500 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg hover:bg-green-600 flex items-center space-x-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>エクスポート</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="pb-3 text-sm font-medium text-gray-600">氏名</th>
                      <th className="pb-3 text-sm font-medium text-gray-600">勤務時間</th>
                      <th className="pb-3 text-sm font-medium text-gray-600">残業時間</th>
                      <th className="pb-3 text-sm font-medium text-gray-600">有給取得</th>
                      <th className="pb-3 text-sm font-medium text-gray-600">出勤率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generateMonthlyData(selectedPeriod).members.map((member) => (
                      <tr key={member.id} className="border-b border-gray-100">
                        <td className="py-4 font-medium text-gray-800 text-sm">{member.name}</td>
                        <td className="py-4 text-gray-600 text-sm">{member.workHours}h</td>
                        <td className="py-4">
                          <span className={`font-medium text-sm ${member.overtimeHours > 15 ? 'text-red-600' : 'text-gray-600'}`}>
                            {member.overtimeHours}h
                          </span>
                        </td>
                        <td className="py-4 text-gray-600 text-sm">{member.vacationDays}日</td>
                        <td className="py-4">
                          <span className={`font-medium text-sm ${member.attendanceRate < 95 ? 'text-red-600' : 'text-green-600'}`}>
                            {member.attendanceRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 年次推移グラフ - スマホでは縦積み */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">年次勤務時間推移</h3>
              <div className="h-64 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={generateYearlyData(selectedYear).months}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="workHours" stroke="#3B82F6" strokeWidth={2} name="勤務時間" />
                    <Line type="monotone" dataKey="overtimeHours" stroke="#EF4444" strokeWidth={2} name="残業時間" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* チーム分析 - スマホでは縦積み */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">メンバー別勤務時間比較</h3>
                <div className="h-64 sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={teamComparisonData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="workHours" fill="#3B82F6" name="勤務時間" />
                      <Bar dataKey="overtime" fill="#EF4444" name="残業時間" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">有給取得状況</h3>
                <div className="h-64 sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={teamComparisonData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({name, value}) => `${name}: ${value}日`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="vacation"
                      >
                        {teamComparisonData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 残業理由フォーム */}
        {showOvertimeForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 sm:p-6 shadow-lg max-w-md w-full">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-red-800 mb-2">残業理由の入力</h3>
                <p className="text-sm text-red-600">
                  {todayVacation.isHalfDay ? '4時間' : '8時間'}を超過しました。残業理由を入力してください。
                </p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-red-700 mb-2">
                    残業理由 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={overtimeReason}
                    onChange={(e) => setOvertimeReason(e.target.value)}
                    placeholder="残業が必要な理由を入力してください..."
                    className="w-full p-3 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                    rows={3}
                    maxLength={200}
                  />
                  <p className="text-xs text-red-500 mt-1">
                    {overtimeReason.length}/200文字
                  </p>
                </div>
                
                <button
                  onClick={handleOvertimeReasonSubmit}
                  disabled={!overtimeReason.trim()}
                  className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all duration-200 ${
                    overtimeReason.trim()
                      ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 active:scale-95'
                      : 'bg-gray-300 cursor-not-allowed'
                  }`}
                >
                  ホストに送信
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 有給申請モーダル */}
        {showVacationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">有給申請</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">有給タイプ</label>
                  <select
                    value={vacationForm.vacationType}
                    onChange={(e) => setVacationForm({...vacationForm, vacationType: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="paid_full">有給全日</option>
                    <option value="paid_morning">有給午前半休</option>
                    <option value="paid_afternoon">有給午後半休</option>
                    <option value="compensatory">代休</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {vacationForm.vacationType === 'paid_full' ? '開始日' : '取得日'}
                  </label>
                  <input
                    type="date"
                    value={vacationForm.startDate}
                    onChange={(e) => setVacationForm({...vacationForm, startDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                {vacationForm.vacationType === 'paid_full' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">終了日</label>
                    <input
                      type="date"
                      value={vacationForm.endDate}
                      onChange={(e) => setVacationForm({...vacationForm, endDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                )}

                {vacationForm.startDate && (vacationForm.vacationType !== 'paid_full' || vacationForm.endDate) && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      申請日数: {calculateDays(
                        vacationForm.startDate, 
                        vacationForm.vacationType === 'paid_full' ? vacationForm.endDate : vacationForm.startDate,
                        vacationForm.vacationType
                      )}日 ({getVacationTypeLabel(vacationForm.vacationType)})
                    </p>
                    {(vacationForm.vacationType === 'paid_morning' || vacationForm.vacationType === 'paid_afternoon') && (
                      <p className="text-xs text-blue-600 mt-1">
                        ※ 半休日は勤務時間4時間、休憩なし、4時間超過で残業扱いとなります
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">理由</label>
                  <textarea
                    value={vacationForm.reason}
                    onChange={(e) => setVacationForm({...vacationForm, reason: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                    rows={3}
                    placeholder="有給取得の理由を入力してください..."
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowVacationModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleVacationApplication}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center justify-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>申請</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 休日出勤申請モーダル */}
        {showHolidayWorkModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">休日出勤申請</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">出勤日</label>
                  <input
                    type="date"
                    value={vacationForm.startDate}
                    onChange={(e) => setVacationForm({...vacationForm, startDate: e.target.value, vacationType: 'holiday_work'})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  {vacationForm.startDate && !isHoliday(vacationForm.startDate) && (
                    <p className="text-xs text-red-500 mt-1">選択された日付は休日ではありません</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">理由</label>
                  <textarea
                    value={vacationForm.reason}
                    onChange={(e) => setVacationForm({...vacationForm, reason: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                    rows={3}
                    placeholder="休日出勤が必要な理由を入力してください..."
                  />
                </div>

                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-sm text-purple-800">
                    休日出勤が承認されると、代休を1日取得できます。
                  </p>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowHolidayWorkModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleVacationApplication}
                  className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center justify-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>申請</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 新規ユーザー追加モーダル */}
        {showAddUserModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-md max-h-screen overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">新規ユーザー追加</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">名前 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={newUserForm.name}
                    onChange={(e) => setNewUserForm({...newUserForm, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="田中 太郎"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">メールアドレス <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm({...newUserForm, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="tanaka@company.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">パスワード <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="パスワードを入力"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">役割</label>
                  <select
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm({...newUserForm, role: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="member">メンバー</option>
                    <option value="host">ホスト</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">チーム</label>
                  <input
                    type="text"
                    value={newUserForm.team}
                    onChange={(e) => setNewUserForm({...newUserForm, team: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="開発チーム"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">年間有給日数</label>
                  <input
                    type="number"
                    value={newUserForm.vacationDaysTotal}
                    onChange={(e) => setNewUserForm({...newUserForm, vacationDaysTotal: parseInt(e.target.value) || 20})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                    max="40"
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowAddUserModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddUser}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>追加</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ユーザー編集モーダル */}
        {showEditUserModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-md max-h-screen overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">ユーザー編集</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">名前 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={newUserForm.name}
                    onChange={(e) => setNewUserForm({...newUserForm, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="田中 太郎"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">メールアドレス <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm({...newUserForm, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="tanaka@company.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">パスワード</label>
                  <input
                    type="password"
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="パスワードを入力（変更する場合のみ）"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">役割</label>
                  <select
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm({...newUserForm, role: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={editingUser?.role === 'host' && currentUser?.id === editingUser?.id}
                  >
                    <option value="member">メンバー</option>
                    <option value="host">ホスト</option>
                  </select>
                  {editingUser?.role === 'host' && currentUser?.id === editingUser?.id && (
                    <p className="text-xs text-gray-500 mt-1">自分のホスト権限は変更できません</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">チーム</label>
                  <input
                    type="text"
                    value={newUserForm.team}
                    onChange={(e) => setNewUserForm({...newUserForm, team: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="開発チーム"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">年間有給日数</label>
                  <input
                    type="number"
                    value={newUserForm.vacationDaysTotal}
                    onChange={(e) => setNewUserForm({...newUserForm, vacationDaysTotal: parseInt(e.target.value) || 20})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                    max="40"
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditUserModal(false);
                    setEditingUser(null);
                    setNewUserForm({ name: '', email: '', password: '', role: 'member', team: '開発チーム', vacationDaysTotal: 20 });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleUpdateUser}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>更新</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 勤怠編集モーダル */}
        {showAttendanceEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">勤怠データ編集</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">出勤時刻</label>
                  <input
                    type="time"
                    value={editingAttendance?.clockIn || ''}
                    onChange={(e) => setEditingAttendance({...editingAttendance, clockIn: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">退勤時刻</label>
                  <input
                    type="time"
                    value={editingAttendance?.clockOut || ''}
                    onChange={(e) => setEditingAttendance({...editingAttendance, clockOut: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">休憩時間（分）</label>
                  <input
                    type="number"
                    value={editingAttendance?.breakTime || 0}
                    onChange={(e) => setEditingAttendance({...editingAttendance, breakTime: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">残業理由</label>
                  <textarea
                    value={editingAttendance?.overtimeReason || ''}
                    onChange={(e) => setEditingAttendance({...editingAttendance, overtimeReason: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    rows={3}
                    placeholder="残業理由を入力してください..."
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowAttendanceEditModal(false);
                    setEditingAttendance(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleUpdateAttendance}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>更新</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntegratedAttendanceApp;
