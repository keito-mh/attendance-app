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
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

const App = () => {
  // 現在のユーザーと表示画面
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState('synced'); // synced, syncing, offline

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

  // データベース状態
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

  // オンライン状態監視
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Firebase データ保存関数
  const saveToFirebase = async (collectionName, data) => {
    if (!isOnline) {
      // オフライン時はローカルストレージに保存
      localStorage.setItem(`attendanceApp_${collectionName}`, JSON.stringify(data));
      setSyncStatus('offline');
      return;
    }

    try {
      setSyncStatus('syncing');
      await setDoc(doc(db, 'attendanceApp', collectionName), { data });
      setSyncStatus('synced');
    } catch (error) {
      console.error(`Firebase保存エラー (${collectionName}):`, error);
      // フォールバック：ローカルストレージに保存
      localStorage.setItem(`attendanceApp_${collectionName}`, JSON.stringify(data));
      setSyncStatus('offline');
    }
  };

  // Firebase データ読み込み関数
  const loadFromFirebase = async (collectionName) => {
    try {
      const docRef = doc(db, 'attendanceApp', collectionName);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data().data;
      } else {
        return null;
      }
    } catch (error) {
      console.error(`Firebase読み込みエラー (${collectionName}):`, error);
      // フォールバック：ローカルストレージから読み込み
      const stored = localStorage.getItem(`attendanceApp_${collectionName}`);
      return stored ? JSON.parse(stored) : null;
    }
  };

  // リアルタイム同期設定
  useEffect(() => {
    if (!isOnline) return;

    const unsubscribeUsers = onSnapshot(
      doc(db, 'attendanceApp', 'users'),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data().data;
          setUsers(data);
          localStorage.setItem('attendanceApp_users', JSON.stringify(data));
        }
      },
      (error) => {
        console.error('リアルタイム同期エラー (users):', error);
      }
    );

    const unsubscribeVacationRequests = onSnapshot(
      doc(db, 'attendanceApp', 'vacationRequests'),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data().data;
          setVacationRequests(data);
          localStorage.setItem('attendanceApp_vacationRequests', JSON.stringify(data));
        }
      },
      (error) => {
        console.error('リアルタイム同期エラー (vacationRequests):', error);
      }
    );

    const unsubscribeAttendanceData = onSnapshot(
      doc(db, 'attendanceApp', 'attendanceData'),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data().data;
          setAttendanceData(data);
          localStorage.setItem('attendanceApp_attendanceData', JSON.stringify(data));
        }
      },
      (error) => {
        console.error('リアルタイム同期エラー (attendanceData):', error);
      }
    );

    return () => {
      unsubscribeUsers();
      unsubscribeVacationRequests();
      unsubscribeAttendanceData();
    };
  }, [isOnline]);

  // 初期データ読み込み
  useEffect(() => {
    const initializeData = async () => {
      setSyncStatus('syncing');

      // ユーザーデータ読み込み
      let usersData = await loadFromFirebase('users');
      if (!usersData) {
        usersData = [
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
        await saveToFirebase('users', usersData);
      }
      setUsers(usersData);

      // 休暇申請データ読み込み
      let vacationData = await loadFromFirebase('vacationRequests');
      if (!vacationData) {
        vacationData = [];
        await saveToFirebase('vacationRequests', vacationData);
      }
      setVacationRequests(vacationData);

      // 勤怠データ読み込み
      let attendanceDataLoaded = await loadFromFirebase('attendanceData');
      if (!attendanceDataLoaded) {
        attendanceDataLoaded = [];
        await saveToFirebase('attendanceData', attendanceDataLoaded);
      }
      setAttendanceData(attendanceDataLoaded);

      // ログイン状態確認
      const loggedInUser = localStorage.getItem('currentUser');
      if (loggedInUser) {
        setCurrentUser(JSON.parse(loggedInUser));
        setCurrentView('dashboard');
      }

      setSyncStatus('synced');
    };

    initializeData();
  }, []);

  // オフライン時の同期処理
  useEffect(() => {
    if (isOnline && syncStatus === 'offline') {
      const syncOfflineData = async () => {
        setSyncStatus('syncing');

        // ローカルストレージのデータをFirebaseに同期
        const localUsers = localStorage.getItem('attendanceApp_users');
        const localVacationRequests = localStorage.getItem('attendanceApp_vacationRequests');
        const localAttendanceData = localStorage.getItem('attendanceApp_attendanceData');

        if (localUsers) {
          await saveToFirebase('users', JSON.parse(localUsers));
        }
        if (localVacationRequests) {
          await saveToFirebase('vacationRequests', JSON.parse(localVacationRequests));
        }
        if (localAttendanceData) {
          await saveToFirebase('attendanceData', JSON.parse(localAttendanceData));
        }

        setSyncStatus('synced');
      };

      syncOfflineData();
    }
  }, [isOnline, syncStatus]);

  // データ保存関数（Firebase対応版）
  const saveUsersToStorage = async (newUsers) => {
    setUsers(newUsers);
    await saveToFirebase('users', newUsers);
  };

  const saveVacationRequestsToStorage = async (newRequests) => {
    setVacationRequests(newRequests);
    await saveToFirebase('vacationRequests', newRequests);
  };

  const saveAttendanceDataToStorage = async (newAttendanceData) => {
    setAttendanceData(newAttendanceData);
    await saveToFirebase('attendanceData', newAttendanceData);
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

  // 同期ステータス表示
  const getSyncStatusIcon = () => {
    if (!isOnline) {
      return <WifiOff className="w-4 h-4 text-red-500" />;
    }
    switch (syncStatus) {
      case 'syncing':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'synced':
        return <Wifi className="w-4 h-4 text-green-500" />;
      case 'offline':
        return <WifiOff className="w-4 h-4 text-orange-500" />;
      default:
        return <Wifi className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSyncStatusText = () => {
    if (!isOnline) return 'オフライン';
    switch (syncStatus) {
      case 'syncing': return '同期中...';
      case 'synced': return '同期済み';
      case 'offline': return 'オフライン';
      default: return '';
    }
  };

  // ログイン画面
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

            {/* 同期ステータス */}
            <div className="flex items-center justify-center space-x-2 mt-3">
              {getSyncStatusIcon()}
              <span className="text-xs text-gray-500">{getSyncStatusText()}</span>
            </div>
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
              disabled={users.length === 0}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-50"
            >
              {users.length === 0 ? 'データ読み込み中...' : 'ログイン'}
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

  // メイン画面（簡易版ダッシュボード）
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
            <div className="flex items-center space-x-3">
              {/* 同期ステータス */}
              <div className="flex items-center space-x-2">
                {getSyncStatusIcon()}
                <span className="text-xs text-gray-500 hidden sm:inline">{getSyncStatusText()}</span>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-2 sm:px-4 sm:py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>

        {/* 概要カード */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">今日の勤務時間</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-600">00:00:00</p>
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

        {/* Firebase同期テスト */}
        <div className="mt-6 bg-white rounded-2xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Firebase同期テスト
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">ユーザー数:</span>
              <span className="font-medium">{users.length}人</span>
            </div>
            <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">休暇申請数:</span>
              <span className="font-medium">{vacationRequests.length}件</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">勤怠記録数:</span>
              <span className="font-medium">{attendanceData.length}件</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">同期状態:</span>
              <div className="flex items-center space-x-2">
                {getSyncStatusIcon()}
                <span className="text-sm font-medium">{getSyncStatusText()}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Firebase同期が有効です！</strong><br/>
              PCとスマホでデータが自動的に同期されます。
              {!isOnline && ' (現在オフライン - オンライン復帰時に自動同期されます)'}
            </p>
          </div>
        </div>

        {/* テスト用ボタン */}
        <div className="mt-6 bg-white rounded-2xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">同期テスト</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={async () => {
                const testUser = {
                  id: Date.now(),
                  email: `test${Date.now()}@company.com`,
                  password: 'password123',
                  name: `テストユーザー${Date.now()}`,
                  role: 'member',
                  team: '開発チーム',
                  vacationDaysTotal: 20,
                  vacationDaysUsed: 0,
                  vacationDaysRemaining: 20,
                  createdAt: new Date().toISOString(),
                  status: 'active'
                };
                const newUsers = [...users, testUser];
                await saveUsersToStorage(newUsers);
                alert('テストユーザーを追加しました！他の端末で確認してください。');
              }}
              className="p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors text-center"
            >
              <Plus className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <p className="font-medium text-green-800 text-sm">テストユーザー追加</p>
            </button>

            <button
              onClick={async () => {
                const testRequest = {
                  id: Date.now(),
                  userId: currentUser.id,
                  startDate: new Date().toISOString().split('T')[0],
                  endDate: new Date().toISOString().split('T')[0],
                  days: 1,
                  vacationType: 'paid_full',
                  reason: '同期テスト用申請',
                  status: 'pending',
                  appliedAt: new Date().toISOString(),
                  approvedAt: null,
                  approvedBy: null
                };
                const newRequests = [...vacationRequests, testRequest];
                await saveVacationRequestsToStorage(newRequests);
                alert('テスト休暇申請を追加しました！他の端末で確認してください。');
              }}
              className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-center"
            >
              <Calendar className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <p className="font-medium text-blue-800 text-sm">テスト休暇申請</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;

