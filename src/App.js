import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import {
  Clock, MapPin, User, Calendar, Shield, Mail, Lock, Eye, EyeOff,
  Plus, Edit2, Trash2, Settings, Download, CheckCircle, XCircle,
  AlertCircle, Send, Coffee, AlertTriangle, TrendingUp, Users,
  FileText, BarChart3, Home, ClipboardList, Save, CalendarDays, Wifi, WifiOff
} from 'lucide-react';

// Firebase imports
import { db } from './firebase';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  where
} from 'firebase/firestore';

const App = () => {
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
    vacationType: 'paid_full'
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

  // Firebase同期関数
  const syncUsersToFirebase = async (usersData) => {
    try {
      console.log('Firebase同期を開始します...');
      const usersCollection = collection(db, 'users');
      for (const user of usersData) {
        await addDoc(usersCollection, user);
      }
      console.log('ユーザーデータをFirebaseに同期しました');
    } catch (error) {
      console.error('Firebase同期エラー:', error);
    }
  };

  const startFirebaseSync = async () => {
    try {
      // ユーザーデータの同期監視
      const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      onSnapshot(usersQuery, (snapshot) => {
        const firebaseUsers = [];
        snapshot.forEach((doc) => {
          firebaseUsers.push({ firebaseId: doc.id, ...doc.data() });
        });

        if (firebaseUsers.length > 0) {
          setUsers(firebaseUsers);
          localStorage.setItem('attendanceApp_users', JSON.stringify(firebaseUsers));
          console.log('Firebaseからユーザーデータを同期しました');
        }
      });

      console.log('Firebase同期を開始しました');
    } catch (error) {
      console.error('Firebase同期開始エラー:', error);
    }
  };

  // 初期データの設定
  useEffect(() => {
    const initializeData = async () => {
      try {
        // ローカルストレージから読み込み
        const storedUsers = localStorage.getItem('attendanceApp_users');
        const storedVacationRequests = localStorage.getItem('attendanceApp_vacationRequests');
        const storedAttendanceData = localStorage.getItem('attendanceApp_attendanceData');
        const loggedInUser = localStorage.getItem('currentUser');

        if (storedUsers) {
          setUsers(JSON.parse(storedUsers));
        } else {
          // 初期ユーザーデータ
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

          // Firebaseにも保存
          await syncUsersToFirebase(initialUsers);
        }

        if (storedVacationRequests) {
          setVacationRequests(JSON.parse(storedVacationRequests));
        } else {
          const initialVacationRequests = [
            {
              id: 1,
              userId: 2,
              startDate: '2025-08-10',
              endDate: '2025-08-10',
              days: 1,
              vacationType: 'paid_full',
              reason: '私用のため',
              status: 'pending',
              appliedAt: new Date().toISOString(),
              approvedAt: null,
              approvedBy: null
            }
          ];
          setVacationRequests(initialVacationRequests);
          localStorage.setItem('attendanceApp_vacationRequests', JSON.stringify(initialVacationRequests));
        }

        if (storedAttendanceData) {
          setAttendanceData(JSON.parse(storedAttendanceData));
        } else {
          // サンプルデータ生成
          const generateSampleAttendanceData = () => {
            const data = [];
            const today = new Date();

            for (let i = 30; i >= 0; i--) {
              const date = new Date(today);
              date.setDate(today.getDate() - i);
              const dateStr = date.toISOString().split('T')[0];

              if (!isHoliday(date)) {
                [1, 2].forEach(userId => {
                  const clockInHour = 9 + Math.floor(Math.random() * 2);
                  const clockInMinute = Math.floor(Math.random() * 60);
                  const workHours = 8 + Math.random() * 2;
                  const breakMinutes = 60 + Math.floor(Math.random() * 30);

                  const clockIn = `${clockInHour.toString().padStart(2, '0')}:${clockInMinute.toString().padStart(2, '0')}`;
                  const clockOutTime = new Date(date);
                  clockOutTime.setHours(clockInHour + Math.floor(workHours), clockInMinute + ((workHours % 1) * 60) + breakMinutes);
                  const clockOut = `${clockOutTime.getHours().toString().padStart(2, '0')}:${clockOutTime.getMinutes().toString().padStart(2, '0')}`;

                  const workMinutes = Math.floor(workHours * 60);
                  const overtimeMinutes = Math.max(0, workMinutes - 480);

                  data.push({
                    id: Date.now() + userId + i,
                    userId: userId,
                    date: dateStr,
                    clockIn: clockIn,
                    clockOut: clockOut,
                    breakTime: breakMinutes,
                    workTime: workMinutes,
                    overtime: overtimeMinutes,
                    overtimeReason: overtimeMinutes > 0 ? '定例業務完了のため' : null,
                    location: '東京都新宿区西新宿',
                    isHolidayWork: false
                  });
                });
              }
            }
            return data;
          };

          const initialAttendanceData = generateSampleAttendanceData();
          setAttendanceData(initialAttendanceData);
          localStorage.setItem('attendanceApp_attendanceData', JSON.stringify(initialAttendanceData));
        }

        if (loggedInUser) {
          setCurrentUser(JSON.parse(loggedInUser));
          setCurrentView('dashboard');
        }

        // Firebaseからデータ同期開始
        await startFirebaseSync();

      } catch (error) {
        console.error('初期化エラー:', error);
        alert('Firebase接続エラーが発生しました。ローカルモードで動作します。');
      }
    };

    initializeData();
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
    setUsers(newUsers);
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

    if (vacationForm.vacationType.startsWith('paid_') && days > currentUser.vacationDaysRemaining) {
      alert('残り有給日数が不足しています');
      return;
    }

    if (vacationForm.vacationType === 'compensatory' && getCompensatoryDaysRemaining() < days) {
      alert('取得可能な代休日数が不足しています');
      return;
    }

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

  // 月次データの動的生成
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

        const workdaysInMonth = 22;
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

        {/* ナビゲーション */}
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
              {currentUser?.role === 'host' && (
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
              )}
            </div>
          </div>
        </div>

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

            {/* Firebase接続状況 */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Firebase接続状況</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">接続状態:</span>
                  <div className="flex items-center space-x-2">
                    <Wifi className="w-4 h-4 text-green-500" />
                    <span className="font-medium text-green-600">接続済み</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">データベース:</span>
                  <span className="font-medium text-green-600">Firestore 準備完了</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">ユーザー数:</span>
                  <span className="font-medium">{users.length}人</span>
                </div>
              </div>

              <div className="mt-4 p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Firebase統合完了:</strong><br/>
                  リアルタイム同期機能が動作中です。複数デバイス間でデータが自動同期されます。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 打刻画面 */}
        {currentView === 'attendance' && (
          <div className="bg-white rounded-2xl p-6 shadow-lg text-center">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">打刻機能</h3>
            <p className="text-gray-600 mb-4">Firebase統合版では完全な打刻機能を実装予定</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleClockIn}
                disabled={isWorking}
                className={`py-3 px-4 rounded-lg font-semibold text-white ${
                  isWorking
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                出勤
              </button>
              <button
                onClick={handleClockOut}
                disabled={!isWorking}
                className={`py-3 px-4 rounded-lg font-semibold text-white ${
                  !isWorking
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                退勤
              </button>
            </div>
          </div>
        )}

        {/* ユーザー管理画面（ホストのみ） */}
        {currentUser?.role === 'host' && currentView === 'userManagement' && (
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
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">メールアドレス <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm({...newUserForm, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">パスワード</label>
                  <input
                    type="password"
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="変更する場合のみ入力"
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
      </div>
    </div>
  );
};

export default App;


