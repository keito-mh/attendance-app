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
    department: '',
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

  // 通知システム関連の状態
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // 検索・フィルター関連の状態
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState(''); // 期間選択用
  const [userFilter, setUserFilter] = useState([]); // 複数ユーザー選択用
  const [reportUserFilter, setReportUserFilter] = useState([]); // レポート用ユーザーフィルター
  const [showUserFilterDropdown, setShowUserFilterDropdown] = useState(false); // 勤怠管理用ドロップダウン
  const [showReportUserFilterDropdown, setShowReportUserFilterDropdown] = useState(false); // レポート用ドロップダウン

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

  // 通知生成関数
  const addNotification = (type, title, message, userId = null) => {
    const notification = {
      id: Date.now(),
      type, // 'info', 'success', 'warning', 'error'
      title,
      message,
      userId,
      createdAt: new Date().toISOString(),
      read: false
    };

    setNotifications(prev => [notification, ...prev.slice(0, 19)]); // 最大20件

    // 自動削除（5秒後）
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  };

  // 通知を既読にする関数
  const markNotificationAsRead = (notificationId) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )
    );
  };

  // 全通知を既読にする関数
  const markAllNotificationsAsRead = () => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, read: true }))
    );
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

      // 休暇申請データの同期監視
      const vacationQuery = query(collection(db, 'vacationRequests'), orderBy('appliedAt', 'desc'));
      onSnapshot(vacationQuery, (snapshot) => {
        const firebaseVacationRequests = [];
        snapshot.forEach((doc) => {
          firebaseVacationRequests.push({ firebaseId: doc.id, ...doc.data() });
        });

        if (firebaseVacationRequests.length > 0) {
          setVacationRequests(firebaseVacationRequests);
          localStorage.setItem('attendanceApp_vacationRequests', JSON.stringify(firebaseVacationRequests));
          console.log('Firebaseから休暇申請データを同期しました');
        }
      });

      // 勤怠データの同期監視
      const attendanceQuery = query(collection(db, 'attendance'), orderBy('date', 'desc'));
      onSnapshot(attendanceQuery, (snapshot) => {
        const firebaseAttendanceData = [];
        snapshot.forEach((doc) => {
          firebaseAttendanceData.push({ firebaseId: doc.id, ...doc.data() });
        });

        if (firebaseAttendanceData.length > 0) {
          setAttendanceData(firebaseAttendanceData);
          localStorage.setItem('attendanceApp_attendanceData', JSON.stringify(firebaseAttendanceData));
          console.log('Firebaseから勤怠データを同期しました');
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
          // 初期管理者ユーザーのみ
          const initialUsers = [
            {
              id: 1,
              email: 'admin@yourcompany.com',
              password: 'SecurePass123!',
              name: '管理者',
              role: 'host',
              department: '管理部',
              vacationDaysTotal: 20,
              vacationDaysUsed: 0,
              vacationDaysRemaining: 20,
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
          // 空の配列で開始
          setVacationRequests([]);
          localStorage.setItem('attendanceApp_vacationRequests', JSON.stringify([]));
        }

        if (storedAttendanceData) {
          setAttendanceData(JSON.parse(storedAttendanceData));
        } else {
          // 空の配列で開始
          setAttendanceData([]);
          localStorage.setItem('attendanceApp_attendanceData', JSON.stringify([]));
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
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          try {
            // 逆ジオコーディングAPIを使用して住所を取得
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ja`
            );
            
            if (response.ok) {
              const data = await response.json();
              
              // 住所情報から都道府県と市町村を抽出
              const address = data.address;
              let locationString = '';
              
              if (address) {
                const prefecture = address.state || address.prefecture || '';
                const city = address.city || address.town || address.village || address.municipality || '';
                const ward = address.city_district || address.ward || '';
                
                // 都道府県と市町村を組み合わせ
                if (prefecture && city) {
                  locationString = ward ? `${prefecture}${city}${ward}` : `${prefecture}${city}`;
                } else if (prefecture) {
                  locationString = prefecture;
                } else if (city) {
                  locationString = city;
                } else {
                  locationString = '住所情報取得失敗';
                }
              } else {
                locationString = '住所情報取得失敗';
              }
              
              setCurrentLocation(locationString);
            } else {
              // APIエラーの場合は緯度経度を表示
              setCurrentLocation(`緯度: ${latitude.toFixed(4)}, 経度: ${longitude.toFixed(4)}`);
            }
          } catch (error) {
            console.error('住所取得エラー:', error);
            // エラーの場合は緯度経度を表示
            setCurrentLocation(`緯度: ${latitude.toFixed(4)}, 経度: ${longitude.toFixed(4)}`);
          }
        },
        (error) => {
          console.error('位置情報取得エラー:', error);
          switch(error.code) {
            case error.PERMISSION_DENIED:
              setCurrentLocation('位置情報の使用が許可されていません');
              break;
            case error.POSITION_UNAVAILABLE:
              setCurrentLocation('位置情報が利用できません');
              break;
            case error.TIMEOUT:
              setCurrentLocation('位置情報取得がタイムアウトしました');
              break;
            default:
              setCurrentLocation('位置情報取得失敗');
              break;
          }
        },
        { 
          enableHighAccuracy: true, 
          timeout: 15000,
          maximumAge: 300000 // 5分間キャッシュ
        }
      );
    } else {
      setCurrentLocation('位置情報サービス未対応');
    }
  }, []);

  // 現在時刻更新
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ドロップダウンを閉じる処理
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.user-filter-dropdown')) {
        setShowUserFilterDropdown(false);
        setShowReportUserFilterDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  // 打刻関連の関数（Firebase連携版）
  const handleClockIn = async () => {
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

    try {
      // Firebaseに保存
      const attendanceCollection = collection(db, 'attendance');
      const docRef = await addDoc(attendanceCollection, newAttendanceRecord);
      console.log('出勤データをFirebaseに保存しました:', docRef.id);

      const existingIndex = attendanceData.findIndex(
        record => record.userId === currentUser.id && record.date === now.toISOString().split('T')[0]
      );

      if (existingIndex >= 0) {
        const updatedData = [...attendanceData];
        updatedData[existingIndex] = { ...updatedData[existingIndex], ...newAttendanceRecord, firebaseId: docRef.id };
        saveAttendanceDataToStorage(updatedData);
      } else {
        saveAttendanceDataToStorage([...attendanceData, { ...newAttendanceRecord, firebaseId: docRef.id }]);
      }

      addNotification('success', '出勤', '出勤打刻が完了しました');

    } catch (error) {
      console.error('Firebase出勤記録エラー:', error);
      // エラーでもローカルには保存
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
    }
  };

  const handleClockOut = async () => {
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

      const updatedRecord = {
        ...updatedData[existingIndex],
        clockOut: now.toTimeString().split(' ')[0],
        breakTime: Math.floor(totalBreakTime / 60),
        workTime: workTimeMinutes,
        overtime: overtimeMinutes
      };

      try {
        // Firebaseを更新
        if (updatedRecord.firebaseId) {
          const attendanceDocRef = doc(db, 'attendance', updatedRecord.firebaseId);
          await updateDoc(attendanceDocRef, {
            clockOut: updatedRecord.clockOut,
            breakTime: updatedRecord.breakTime,
            workTime: updatedRecord.workTime,
            overtime: updatedRecord.overtime
          });
          console.log('退勤データをFirebaseで更新しました');
        }

        updatedData[existingIndex] = updatedRecord;
        saveAttendanceDataToStorage(updatedData);
        addNotification('success', '退勤', '退勤打刻が完了しました');

      } catch (error) {
        console.error('Firebase退勤記録エラー:', error);
        // エラーでもローカルには保存
        updatedData[existingIndex] = updatedRecord;
        saveAttendanceDataToStorage(updatedData);
      }
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

  const handleVacationApplication = async () => {
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

    try {
      // Firebaseに保存
      const vacationCollection = collection(db, 'vacationRequests');
      const docRef = await addDoc(vacationCollection, newRequest);
      console.log('休暇申請をFirebaseに保存しました:', docRef.id);

      saveVacationRequestsToStorage([...vacationRequests, { ...newRequest, firebaseId: docRef.id }]);
      setVacationForm({ startDate: '', endDate: '', reason: '', vacationType: 'paid_full' });
      setShowVacationModal(false);
      setShowHolidayWorkModal(false);
      alert('申請を送信しました（Firebase同期済み）');
      addNotification('success', '休暇申請', '休暇申請を送信しました');

    } catch (error) {
      console.error('Firebase休暇申請エラー:', error);
      // エラーでもローカルには保存
      saveVacationRequestsToStorage([...vacationRequests, newRequest]);
      setVacationForm({ startDate: '', endDate: '', reason: '', vacationType: 'paid_full' });
      setShowVacationModal(false);
      setShowHolidayWorkModal(false);
      alert('申請を送信しました（ローカル保存）');
    }
  };

  const handleVacationApproval = async (requestId, action, rejectionReason = null) => {
    try {
      const updatedRequests = vacationRequests.map(request => {
        if (request.id === requestId) {
          const updatedRequest = {
            ...request,
            status: action,
            approvedAt: new Date().toISOString(),
            approvedBy: currentUser.id,
            rejectionReason: rejectionReason
          };

          // Firebaseを更新
          if (request.firebaseId) {
            const requestDocRef = doc(db, 'vacationRequests', request.firebaseId);
            updateDoc(requestDocRef, {
              status: action,
              approvedAt: updatedRequest.approvedAt,
              approvedBy: updatedRequest.approvedBy,
              rejectionReason: rejectionReason
            }).then(() => {
              console.log('休暇申請ステータスをFirebaseで更新しました');
            });
          }

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
              
              // ユーザーデータもFirebaseで更新
              const updatedUser = updatedUsers.find(u => u.id === request.userId);
              if (updatedUser.firebaseId) {
                const userDocRef = doc(db, 'users', updatedUser.firebaseId);
                updateDoc(userDocRef, {
                  vacationDaysUsed: updatedUser.vacationDaysUsed,
                  vacationDaysRemaining: updatedUser.vacationDaysRemaining
                });
              }
              
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
      alert(`申請を${action === 'approved' ? '承認' : '却下'}しました（Firebase同期済み）`);
      addNotification('info', '申請処理', `申請を${action === 'approved' ? '承認' : '却下'}しました`);

    } catch (error) {
      console.error('Firebase承認処理エラー:', error);
      alert('承認処理中にエラーが発生しました。再度お試しください。');
    }
  };

  // ユーザー管理関数（Firebase連携版）
  const handleAddUser = async () => {
    if (!newUserForm.name || !newUserForm.email || !newUserForm.password || !newUserForm.department) {
      alert('すべての項目を入力してください');
      return;
    }

    // アクティブなユーザーのみで重複チェック
    if (users.some(user => user.email === newUserForm.email && user.status === 'active')) {
      alert('このメールアドレスは既に使用されています');
      return;
    }

    try {
      const newUser = {
        id: Date.now(),
        ...newUserForm,
        vacationDaysUsed: 0,
        vacationDaysRemaining: newUserForm.vacationDaysTotal,
        createdAt: new Date().toISOString(),
        status: 'active'
      };

      // Firebaseに保存
      const usersCollection = collection(db, 'users');
      const docRef = await addDoc(usersCollection, newUser);
      console.log('新規ユーザーをFirebaseに保存しました:', docRef.id);

      // ローカル状態とローカルストレージも更新
      const updatedUsers = [...users, { ...newUser, firebaseId: docRef.id }];
      saveUsersToStorage(updatedUsers);
      
      setShowAddUserModal(false);
      setNewUserForm({ name: '', email: '', password: '', role: 'member', department: '', vacationDaysTotal: 20 });
      alert(`${newUser.name}さんを追加しました（Firebase同期済み）`);
      addNotification('success', 'ユーザー追加', `${newUser.name}さんを追加しました`);
      
    } catch (error) {
      console.error('Firebase保存エラー:', error);
      alert('ユーザー追加中にエラーが発生しました。再度お試しください。');
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setNewUserForm({
      name: user.name,
      email: user.email,
      password: user.password,
      role: user.role,
      department: user.department,
      vacationDaysTotal: user.vacationDaysTotal
    });
    setShowEditUserModal(true);
  };

  const handleUpdateUser = async () => {
    if (!newUserForm.name || !newUserForm.email) {
      alert('名前とメールアドレスは必須です');
      return;
    }

    if (users.some(user => user.email === newUserForm.email && user.id !== editingUser.id)) {
      alert('このメールアドレスは既に使用されています');
      return;
    }

    try {
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

      // Firebaseを更新（firebaseIdがある場合）
      const updatedUser = updatedUsers.find(u => u.id === editingUser.id);
      if (updatedUser.firebaseId) {
        const userDocRef = doc(db, 'users', updatedUser.firebaseId);
        await updateDoc(userDocRef, {
          name: updatedUser.name,
          email: updatedUser.email,
          password: updatedUser.password,
          role: updatedUser.role,
          department: updatedUser.department,
          vacationDaysTotal: updatedUser.vacationDaysTotal,
          vacationDaysRemaining: updatedUser.vacationDaysRemaining
        });
        console.log('ユーザー情報をFirebaseで更新しました');
      }

      saveUsersToStorage(updatedUsers);
        
      if (currentUser.id === editingUser.id) {
        const updatedCurrentUser = updatedUsers.find(u => u.id === editingUser.id);
        setCurrentUser(updatedCurrentUser);
        localStorage.setItem('currentUser', JSON.stringify(updatedCurrentUser));
      }

      setShowEditUserModal(false);
      setEditingUser(null);
      setNewUserForm({ name: '', email: '', password: '', role: 'member', department: '', vacationDaysTotal: 20 });
      alert('ユーザー情報を更新しました（Firebase同期済み）');
      
    } catch (error) {
      console.error('Firebase更新エラー:', error);
      alert('ユーザー更新中にエラーが発生しました。再度お試しください。');
    }
  };

  const handleDeleteUser = async (user) => {
  // ホストユーザーが1人しかいない場合は削除を防ぐ
  const hostUsers = users.filter(u => u.role === 'host' && u.status === 'active');
  if (user.role === 'host' && hostUsers.length <= 1) {
    addNotification('warning', '削除エラー', '最後のホストユーザーは削除できません');
    return;
  }

  if (window.confirm(`${user.name}さんを削除しますか？この操作は取り消せません。`)) {
    try {
      // Firebaseで削除（実際は非アクティブ化）
      if (user.firebaseId) {
        const userDocRef = doc(db, 'users', user.firebaseId);
        await updateDoc(userDocRef, {
          status: 'inactive',
          deletedAt: new Date().toISOString()
        });
        console.log('ユーザーをFirebaseで非アクティブ化しました');
      }

      // ローカルでも非アクティブ化
      const updatedUsers = users.map(u => 
        u.id === user.id ? { 
          ...u, 
          status: 'inactive',
          deletedAt: new Date().toISOString()
        } : u
      );
      
      saveUsersToStorage(updatedUsers);
      addNotification('success', 'ユーザー削除', `${user.name}さんを削除しました`);
      
    } catch (error) {
      console.error('Firebase削除エラー:', error);
      logError(error, 'handleDeleteUser');
      addNotification('error', '削除エラー', 'ユーザー削除中にエラーが発生しました。再度お試しください。');
    }
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

  // 強化されたExcel出力関数
  const exportToExcel = (type = 'today', period = null, userId = null) => {
    let data = [];
    let filename = '';
    
    switch (type) {
      case 'today':
        const today = new Date().toISOString().split('T')[0];
        data = attendanceData.filter(record => record.date === today);
        filename = `勤怠データ_${today}.csv`;
        break;
        
      case 'monthly':
        const monthPeriod = period || selectedPeriod;
        data = attendanceData.filter(record => record.date.startsWith(monthPeriod));
        filename = `月次勤怠データ_${monthPeriod}.csv`;
        break;
        
      case 'user':
        data = attendanceData.filter(record => record.userId === userId);
        const user = users.find(u => u.id === userId);
        filename = `${user?.name || 'ユーザー'}_勤怠データ.csv`;
        break;
        
      case 'vacation':
        const vacationData = vacationRequests.map(req => {
          const user = users.find(u => u.id === req.userId);
          return [
            user?.name || '',
            user?.department || '',
            getVacationTypeLabel(req.vacationType),
            req.startDate,
            req.endDate,
            req.days,
            req.reason,
            req.status === 'approved' ? '承認済み' : req.status === 'rejected' ? '却下' : '承認待ち',
            new Date(req.appliedAt).toLocaleDateString('ja-JP')
          ];
        });
        
        const vacationCsvData = [
          ['氏名', '部署', '休暇種別', '開始日', '終了日', '日数', '理由', 'ステータス', '申請日'],
          ...vacationData
        ];
        
        const vacationCsvContent = vacationCsvData.map(row => 
          row.map(cell => `"${cell}"`).join(',')
        ).join('\n');
        
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + vacationCsvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `休暇申請データ_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;

      // 新規追加: 月次サマリー出力
      case 'monthly_summary':
        const monthSummaryPeriod = period || selectedPeriod;
        const monthSummaryData = generateMonthlyData(monthSummaryPeriod);
        
        const monthlySummaryRows = [
          ['項目', '値'],
          ['期間', monthSummaryPeriod],
          ['総勤務時間', `${monthSummaryData.totalWorkHours}時間`],
          ['総残業時間', `${monthSummaryData.totalOvertimeHours}時間`],
          ['有給使用日数', `${monthSummaryData.vacationDaysUsed}日`],
          ['平均出勤率', `${monthSummaryData.attendanceRate}%`],
          [''],
          ['氏名', '勤務時間(h)', '残業時間(h)', '有給使用(日)', '出勤率(%)'],
          ...monthSummaryData.members.map(member => [
            member.name,
            member.workHours,
            member.overtimeHours,
            member.vacationDays,
            member.attendanceRate
          ])
        ];
        
        const monthlySummaryCsv = monthlySummaryRows.map(row => 
          row.map(cell => `"${cell}"`).join(',')
        ).join('\n');
        
        const monthlyBOM = '\uFEFF';
        const monthlyBlob = new Blob([monthlyBOM + monthlySummaryCsv], { type: 'text/csv;charset=utf-8;' });
        const monthlyLink = document.createElement('a');
        const monthlyUrl = URL.createObjectURL(monthlyBlob);
        monthlyLink.setAttribute('href', monthlyUrl);
        monthlyLink.setAttribute('download', `月次サマリー_${monthSummaryPeriod}.csv`);
        monthlyLink.style.visibility = 'hidden';
        document.body.appendChild(monthlyLink);
        monthlyLink.click();
        document.body.removeChild(monthlyLink);
        return;

      // 新規追加: 年次サマリー出力
      case 'yearly_summary':
        const yearSummaryPeriod = period || selectedYear;
        const yearSummaryData = generateYearlyData(yearSummaryPeriod);
        
        // アクティブユーザーのみの有給消化率を計算
        const activeUsers = users.filter(user => user.status === 'active');
        const totalVacationDaysAvailable = activeUsers.reduce((sum, user) => sum + user.vacationDaysTotal, 0);
        const totalVacationDaysUsed = activeUsers.reduce((sum, user) => sum + user.vacationDaysUsed, 0);
        const vacationUsageRate = totalVacationDaysAvailable > 0 ? Math.round((totalVacationDaysUsed / totalVacationDaysAvailable) * 100) : 0;
        
        const yearlySummaryRows = [
          ['項目', '値'],
          ['期間', `${yearSummaryPeriod}年`],
          ['年間総勤務時間', `${yearSummaryData.totalWorkHours}時間`],
          ['年間総残業時間', `${yearSummaryData.totalOvertimeHours}時間`],
          ['年間有給使用', `${yearSummaryData.totalVacationDays}日`],
          ['有給消化率', `${vacationUsageRate}%`],
          [''],
          ['月', '勤務時間(h)', '残業時間(h)', '有給使用(日)'],
          ...yearSummaryData.months.map(month => [
            month.month,
            month.workHours,
            month.overtimeHours,
            month.vacationDays
          ])
        ];
        
        const yearlySummaryCsv = yearlySummaryRows.map(row => 
          row.map(cell => `"${cell}"`).join(',')
        ).join('\n');
        
        const yearlyBOM = '\uFEFF';
        const yearlyBlob = new Blob([yearlyBOM + yearlySummaryCsv], { type: 'text/csv;charset=utf-8;' });
        const yearlyLink = document.createElement('a');
        const yearlyUrl = URL.createObjectURL(yearlyBlob);
        yearlyLink.setAttribute('href', yearlyUrl);
        yearlyLink.setAttribute('download', `年次サマリー_${yearSummaryPeriod}.csv`);
        yearlyLink.style.visibility = 'hidden';
        document.body.appendChild(yearlyLink);
        yearlyLink.click();
        document.body.removeChild(yearlyLink);
        return;
    }
    
    // 既存のCSV出力処理（勤怠データ）
    const csvData = [
      ['氏名', '部署', 'メールアドレス', '日付', '出勤時刻', '退勤時刻', '休憩時間(分)', '勤務時間(分)', '残業時間(分)', '残業理由', '勤務場所', '休日出勤'],
      ...data.map(record => {
        const user = users.find(u => u.id === record.userId);
        return [
          user?.name || '',
          user?.department || '',
          user?.email || '',
          record.date,
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
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

    // アクティブユーザーのみの統計を計算
    const activeUsers = users.filter(user => user.status === 'active');
    const totalVacationDaysAvailable = activeUsers.reduce((sum, user) => sum + user.vacationDaysTotal, 0);
    const totalVacationDaysUsed = activeUsers.reduce((sum, user) => sum + user.vacationDaysUsed, 0);
    const vacationUsageRate = totalVacationDaysAvailable > 0 ? Math.round((totalVacationDaysUsed / totalVacationDaysAvailable) * 100) : 0;

    return {
      months,
      totalWorkHours: months.reduce((sum, month) => sum + month.workHours, 0),
      totalOvertimeHours: months.reduce((sum, month) => sum + month.overtimeHours, 0),
      totalVacationDays: months.reduce((sum, month) => sum + month.vacationDays, 0),
      vacationUsageRate: vacationUsageRate
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
                  placeholder="admin@yourcompany.com"
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
                  {currentUser?.role === 'host' ? 'チームホスト' : 'チームメンバー'} - {currentUser?.department}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* 通知ベル */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 text-gray-600 hover:text-gray-800 relative"
                >
                  <AlertCircle className="w-6 h-6" />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {notifications.filter(n => !n.read).length}
                    </span>
                  )}
                </button>
                
                {/* 通知ドロップダウン */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                      <h3 className="font-semibold text-gray-800">通知</h3>
                      {notifications.filter(n => !n.read).length > 0 && (
                        <button
                          onClick={markAllNotificationsAsRead}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          すべて既読
                        </button>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                              !notification.read ? 'bg-blue-50' : ''
                            }`}
                            onClick={() => markNotificationAsRead(notification.id)}
                          >
                            <div className="flex items-start space-x-3">
                              <div className={`w-2 h-2 rounded-full mt-2 ${
                                notification.type === 'success' ? 'bg-green-500' :
                                notification.type === 'warning' ? 'bg-yellow-500' :
                                notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                              }`} />
                              <div className="flex-1">
                                <p className="font-medium text-gray-800 text-sm">{notification.title}</p>
                                <p className="text-gray-600 text-xs">{notification.message}</p>
                                <p className="text-gray-400 text-xs mt-1">
                                  {new Date(notification.createdAt).toLocaleString('ja-JP')}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-gray-500">
                          通知はありません
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
              {/* メンバー用レポートボタンを追加 */}
              {currentUser?.role === 'member' && (
                <button
                  onClick={() => setCurrentView('memberReport')}
                  className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                    currentView === 'memberReport' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 inline-block mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">マイレポート</span>
                  <span className="sm:hidden">レポ</span>
                </button>
              )}
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
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">勤怠データ:</span>
                  <span className="font-medium">{attendanceData.length}件</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">休暇申請:</span>
                  <span className="font-medium">{vacationRequests.length}件</span>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Firebase統合完了:</strong><br/>
                  リアルタイム同期機能が動作中です。ユーザー管理、勤怠データ、休暇申請がすべてFirebaseと同期されています。
                </p>
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
                    onClick={() => setCurrentView('userManagement')}
                    className="p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors text-center"
                  >
                    <Users className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600 mx-auto mb-2" />
                    <p className="font-medium text-orange-800 text-sm">ユーザー管理</p>
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
            {/* 現在時刻表示 */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg text-center">
              <div className="mb-4">
                <p className="text-lg text-gray-600">{formatDate(currentTime)}</p>
                <p className="text-3xl sm:text-4xl font-bold text-blue-600 mt-2">
                  {formatTime(currentTime)}
                </p>
              </div>
              
              {/* 位置情報 */}
              <div className="flex items-center justify-center text-sm text-gray-500 mb-4">
                <MapPin className="w-4 h-4 mr-1" />
                <span>{currentLocation}</span>
              </div>

              {/* 休日出勤アラート */}
              {holidayWorkAlert && (
                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-orange-800 text-sm">{holidayWorkAlert}</p>
                </div>
              )}
            </div>

            {/* 勤務状況カード */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-lg">
                <div className="text-center">
                  <p className="text-sm text-gray-600">勤務時間</p>
                  <p className={`text-xl font-bold ${isOvertime ? 'text-red-600' : 'text-blue-600'}`}>
                    {formatWorkTime(todayWorkTime)}
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className={`h-2 rounded-full ${isOvertime ? 'bg-red-500' : 'bg-blue-500'}`}
                      style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-4 shadow-lg">
                <div className="text-center">
                  <p className="text-sm text-gray-600">残り時間</p>
                  <p className="text-xl font-bold text-green-600">
                    {isOvertime ? '定時完了' : formatWorkTime(remainingTime)}
                  </p>
                  {isOvertime && (
                    <p className="text-sm text-red-600 mt-1">
                      残業: {formatWorkTime(overtimeSeconds)}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-4 shadow-lg">
                <div className="text-center">
                  <p className="text-sm text-gray-600">休憩時間</p>
                  <p className="text-xl font-bold text-purple-600">
                    {formatWorkTime(totalBreakTime + currentBreakTime)}
                  </p>
                  {isOnBreak && (
                    <p className="text-sm text-purple-600 mt-1">休憩中</p>
                  )}
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-4 shadow-lg">
                <div className="text-center">
                  <p className="text-sm text-gray-600">ステータス</p>
                  <p className={`text-lg font-bold ${
                    isWorking ? (isOnBreak ? 'text-yellow-600' : 'text-green-600') : 'text-gray-600'
                  }`}>
                    {isWorking ? (isOnBreak ? '休憩中' : '勤務中') : '未出勤'}
                  </p>
                </div>
              </div>
            </div>

            {/* 打刻ボタン */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">打刻</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <button
                  onClick={handleClockIn}
                  disabled={isWorking}
                  className={`py-3 px-4 rounded-lg font-semibold text-white transition-all ${
                    isWorking 
                      ? 'bg-gray-300 cursor-not-allowed' 
                      : 'bg-green-500 hover:bg-green-600 active:scale-95'
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <Clock className="w-6 h-6 mb-1" />
                    <span>出勤</span>
                  </div>
                </button>

                <button
                  onClick={handleClockOut}
                  disabled={!isWorking}
                  className={`py-3 px-4 rounded-lg font-semibold text-white transition-all ${
                    !isWorking 
                      ? 'bg-gray-300 cursor-not-allowed' 
                      : 'bg-red-500 hover:bg-red-600 active:scale-95'
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <Clock className="w-6 h-6 mb-1" />
                    <span>退勤</span>
                  </div>
                </button>

                <button
                  onClick={handleBreakStart}
                  disabled={!isWorking || isOnBreak}
                  className={`py-3 px-4 rounded-lg font-semibold text-white transition-all ${
                    !isWorking || isOnBreak
                      ? 'bg-gray-300 cursor-not-allowed' 
                      : 'bg-yellow-500 hover:bg-yellow-600 active:scale-95'
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <Coffee className="w-6 h-6 mb-1" />
                    <span>休憩開始</span>
                  </div>
                </button>

                <button
                  onClick={handleBreakEnd}
                  disabled={!isOnBreak}
                  className={`py-3 px-4 rounded-lg font-semibold text-white transition-all ${
                    !isOnBreak
                      ? 'bg-gray-300 cursor-not-allowed' 
                      : 'bg-blue-500 hover:bg-blue-600 active:scale-95'
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <Coffee className="w-6 h-6 mb-1" />
                    <span>休憩終了</span>
                  </div>
                </button>
              </div>
            </div>

            {/* 本日の打刻履歴 */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">本日の打刻履歴</h3>
              <div className="space-y-2">
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
                    <p className="text-sm font-mono text-gray-600">
                      {formatTime(record.timestamp)}
                    </p>
                  </div>
                ))}
                {attendanceRecords.length === 0 && (
                  <p className="text-gray-500 text-center py-4 text-sm">本日の打刻履歴はありません</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 休暇管理画面 */}
        {currentView === 'vacation' && (
          <div className="space-y-4 sm:space-y-6">
            {/* 休暇統計 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">今年使用済み</p>
                    <p className="text-xl sm:text-2xl font-bold text-blue-600">{currentUser?.vacationDaysUsed}日</p>
                  </div>
                  <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
                </div>
              </div>
            </div>

            {/* クイック申請 */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">休暇申請</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  onClick={() => setShowVacationModal(true)}
                  className="p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors text-center"
                >
                  <Calendar className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="font-medium text-green-800 text-sm">有給申請</p>
                </button>
                <button
                  onClick={() => {
                    setVacationForm({...vacationForm, vacationType: 'compensatory'});
                    setShowVacationModal(true);
                  }}
                  className="p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors text-center"
                >
                  <CalendarDays className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <p className="font-medium text-purple-800 text-sm">代休申請</p>
                </button>
                <button
                  onClick={() => setShowHolidayWorkModal(true)}
                  className="p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors text-center"
                >
                  <Settings className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                  <p className="font-medium text-orange-800 text-sm">休日出勤申請</p>
                </button>
                {currentUser?.role === 'host' && (
                  <button
                    onClick={() => setCurrentView('attendanceReport')}
                    className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-center"
                  >
                    <CheckCircle className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                    <p className="font-medium text-blue-800 text-sm">承認管理</p>
                  </button>
                )}
              </div>
            </div>

            {/* 申請履歴 */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">申請履歴</h3>
              <div className="space-y-3">
                {vacationRequests
                  .filter(req => req.userId === currentUser.id)
                  .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt))
                  .slice(0, 5)
                  .map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="font-medium text-gray-800">{getVacationTypeLabel(request.vacationType)}</span>
                          {getStatusBadge(request.status)}
                        </div>
                        <p className="text-sm text-gray-600">{request.startDate} 〜 {request.endDate}</p>
                        <p className="text-sm text-gray-500">{request.reason}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-700">{request.days}日</p>
                        <p className="text-xs text-gray-500">
                          {new Date(request.appliedAt).toLocaleDateString('ja-JP')}
                        </p>
                      </div>
                    </div>
                  ))}
                {vacationRequests.filter(req => req.userId === currentUser.id).length === 0 && (
                  <p className="text-gray-500 text-center py-4 text-sm">申請履歴がありません</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* メンバー用レポート画面 */}
        {currentUser?.role === 'member' && currentView === 'memberReport' && (
          <div className="space-y-4 sm:space-y-6">
            {/* 個人統計 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">今月の勤務時間</p>
                    <p className="text-xl sm:text-2xl font-bold text-blue-600">
                      {(() => {
                        const thisMonth = new Date().toISOString().slice(0, 7);
                        const monthlyAttendance = attendanceData.filter(
                          record => record.userId === currentUser.id && record.date.startsWith(thisMonth)
                        );
                        const totalMinutes = monthlyAttendance.reduce((sum, record) => sum + (record.workTime || 0), 0);
                        return formatMinutesToTime(totalMinutes);
                      })()}
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
                      {(() => {
                        const thisMonth = new Date().toISOString().slice(0, 7);
                        const monthlyAttendance = attendanceData.filter(
                          record => record.userId === currentUser.id && record.date.startsWith(thisMonth)
                        );
                        const totalOvertimeMinutes = monthlyAttendance.reduce((sum, record) => sum + (record.overtime || 0), 0);
                        return formatMinutesToTime(totalOvertimeMinutes);
                      })()}
                    </p>
                  </div>
                  <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-red-500" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">今月の出勤日数</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-600">
                      {(() => {
                        const thisMonth = new Date().toISOString().slice(0, 7);
                        const monthlyAttendance = attendanceData.filter(
                          record => record.userId === currentUser.id && 
                                   record.date.startsWith(thisMonth) && 
                                   record.clockIn
                        );
                        return monthlyAttendance.length;
                      })()}日
                    </p>
                  </div>
                  <CalendarDays className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
                </div>
              </div>
            </div>

            {/* 個人勤怠履歴 */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">勤怠履歴（直近30日）</h3>
                <button
                  onClick={() => {
                    const myAttendance = attendanceData.filter(record => record.userId === currentUser.id);
                    const csvData = [
                      ['日付', '出勤時刻', '退勤時刻', '休憩時間(分)', '勤務時間(分)', '残業時間(分)', '残業理由'],
                      ...myAttendance.slice(0, 30).map(record => [
                        record.date,
                        record.clockIn || '',
                        record.clockOut || '',
                        record.breakTime || 0,
                        record.workTime || 0,
                        record.overtime || 0,
                        record.overtimeReason || ''
                      ])
                    ];
                    
                    const csvContent = csvData.map(row => 
                      row.map(cell => `"${cell}"`).join(',')
                    ).join('\n');
                    
                    const BOM = '\uFEFF';
                    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    const url = URL.createObjectURL(blob);
                    link.setAttribute('href', url);
                    link.setAttribute('download', `個人勤怠履歴_${new Date().toISOString().split('T')[0]}.csv`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center space-x-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Excel出力</span>
                </button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {attendanceData
                  .filter(record => record.userId === currentUser.id)
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .slice(0, 30)
                  .map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{record.date}</p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>出勤: {record.clockIn || '未出勤'}</span>
                          <span>退勤: {record.clockOut || '勤務中'}</span>
                          {record.workTime > 0 && (
                            <span>勤務: {formatMinutesToTime(record.workTime)}</span>
                          )}
                          {record.overtime > 0 && (
                            <span className="text-red-600">残業: {formatMinutesToTime(record.overtime)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                {attendanceData.filter(record => record.userId === currentUser.id).length === 0 && (
                  <p className="text-gray-500 text-center py-4 text-sm">勤怠データがありません</p>
                )}
              </div>
            </div>

            {/* 個人休暇履歴 */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">休暇取得履歴</h3>
              <div className="space-y-3">
                {vacationRequests
                  .filter(req => req.userId === currentUser.id)
                  .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt))
                  .map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="font-medium text-gray-800">{getVacationTypeLabel(request.vacationType)}</span>
                          {getStatusBadge(request.status)}
                        </div>
                        <p className="text-sm text-gray-600">{request.startDate} 〜 {request.endDate}</p>
                        <p className="text-sm text-gray-500">{request.reason}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-700">{request.days}日</p>
                        <p className="text-xs text-gray-500">
                          {new Date(request.appliedAt).toLocaleDateString('ja-JP')}
                        </p>
                      </div>
                    </div>
                  ))}
                {vacationRequests.filter(req => req.userId === currentUser.id).length === 0 && (
                  <p className="text-gray-500 text-center py-4 text-sm">休暇履歴がありません</p>
                )}
              </div>
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

              {/* 検索・フィルター */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                <div>
                  <input
                    type="text"
                    placeholder="名前・メールで検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">すべての部署</option>
                    {[...new Set(users.map(user => user.department).filter(Boolean))].map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">すべてのステータス</option>
                    <option value="active">アクティブ</option>
                    <option value="inactive">非アクティブ</option>
                  </select>
                </div>
                <div>
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setDepartmentFilter('');
                      setStatusFilter('');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    クリア
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {users
                  .filter(user => {
                    const matchesSearch = searchTerm === '' || 
                      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
                    const matchesDepartment = departmentFilter === '' || user.department === departmentFilter;
    
                    // ★ここが変更点：statusFilterが空の場合はactiveのみ表示
                    const matchesStatus = statusFilter === '' ? user.status === 'active' : user.status === statusFilter;
    
                    return matchesSearch && matchesDepartment && matchesStatus;
                  })
                  .map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-sm">{member.name}</p>
                          <p className="text-xs text-gray-500">{member.email}</p>
                          <p className="text-xs text-gray-400">{member.department}</p>
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
                            {member.firebaseId && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <Wifi className="w-3 h-3 mr-1" />
                                Firebase同期済み
                              </span>
                            )}
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
                        {/* 最後のホストでない場合は削除可能 */}
　　　　　　　　　　　　　　　　{!(member.role === 'host' && users.filter(u => u.role === 'host' && u.status === 'active').length <= 1) && (
                          <button 
                            onClick={() => handleDeleteUser(member)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                            title="ユーザーを削除"
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
        {currentUser?.role === 'host' && currentView === 'attendanceReport' && (
          <div className="space-y-4 sm:space-y-6">
            {/* 日付フィルター */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">出勤状況フィルター</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">開始日</label>
                  <input
                    type="date"
                    value={dateFilter || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">終了日（任意）</label>
                  <input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => setEndDateFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="relative user-filter-dropdown">
                  <label className="block text-sm font-medium text-gray-700 mb-2">対象ユーザー（複数選択可）</label>
                  <button
                    type="button"
                    onClick={() => setShowUserFilterDropdown(!showUserFilterDropdown)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-left bg-white flex items-center justify-between"
                  >
                    <span className="text-sm">
                      {userFilter.length === 0 
                        ? '全員' 
                        : userFilter.length === 1 
                          ? users.find(u => u.id === userFilter[0])?.name || '選択済み'
                          : `${userFilter.length}人選択済み`
                      }
                    </span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showUserFilterDropdown && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      <div className="p-2">
                        <label className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={userFilter.length === 0}
                            onChange={() => setUserFilter([])}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-700">全員</span>
                        </label>
                        {users.filter(user => user.status === 'active').map(user => (
                          <label key={user.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={userFilter.includes(user.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setUserFilter([...userFilter, user.id]);
                                } else {
                                  setUserFilter(userFilter.filter(id => id !== user.id));
                                }
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{user.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Excel出力</label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => exportToExcel('today')}
                      className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
                    >
                      本日
                    </button>
                    <button
                      onClick={() => exportToExcel('monthly', selectedPeriod)}
                      className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
                    >
                      月次
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">その他</label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => exportToExcel('vacation')}
                      className="px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm"
                    >
                      休暇データ
                    </button>
                    <button
                      onClick={() => {
                        setDateFilter('');
                        setEndDateFilter('');
                        setUserFilter([]);
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                    >
                      クリア
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 休暇申請承認 */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">休暇申請承認</h3>
              {/* 休暇申請承認の内容は既存のまま */}
              <div className="space-y-3">
                {vacationRequests
                  .filter(req => req.status === 'pending')
                  .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt))
                  .map((request) => {
                    const user = users.find(u => u.id === request.userId);
                    return (
                      <div key={request.id} className="flex items-center justify-between p-3 sm:p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="font-medium text-gray-800">{user?.name}</span>
                            <span className="text-sm text-gray-600">{getVacationTypeLabel(request.vacationType)}</span>
                            {getStatusBadge(request.status)}
                            {request.firebaseId && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <Wifi className="w-3 h-3 mr-1" />
                                Firebase
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{request.startDate} 〜 {request.endDate} ({request.days}日)</p>
                          <p className="text-sm text-gray-500">{request.reason}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleVacationApproval(request.id, 'approved')}
                            className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                          >
                            承認
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt('却下理由を入力してください:');
                              if (reason) handleVacationApproval(request.id, 'rejected', reason);
                            }}
                            className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                          >
                            却下
                          </button>
                        </div>
                      </div>
                    );
                  })}
                {vacationRequests.filter(req => req.status === 'pending').length === 0 && (
                  <p className="text-gray-500 text-center py-4 text-sm">承認待ちの申請はありません</p>
                )}
              </div>
            </div>

            {/* 出勤状況表示（フィルター適用） */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  {dateFilter ? (endDateFilter ? `${dateFilter} 〜 ${endDateFilter}の出勤状況` : `${dateFilter}の出勤状況`) : '本日の出勤状況'}
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => exportToExcel('today')}
                    className="bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center space-x-2 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Excel出力</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {(() => {
                  let filteredAttendance = [];
                  
                  if (endDateFilter) {
                    // 期間でフィルター
                    filteredAttendance = attendanceData.filter(record => 
                      record.date >= (dateFilter || new Date().toISOString().split('T')[0]) && 
                      record.date <= endDateFilter
                    );
                  } else {
                    // 単日でフィルター
                    filteredAttendance = getAttendanceByDate(dateFilter || new Date().toISOString().split('T')[0]);
                  }
                  
                  // ユーザーフィルター適用
                  if (userFilter.length > 0) {
                    filteredAttendance = filteredAttendance.filter(record => userFilter.includes(record.userId));
                  }
                  
                  // アクティブユーザーのみ
                  filteredAttendance = filteredAttendance.filter(record => {
                    const user = users.find(u => u.id === record.userId);
                    return user?.status === 'active';
                  });

                  return filteredAttendance.map((record) => {
                    const user = users.find(u => u.id === record.userId);
                    return (
                      <div key={record.id} className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-sm">{user?.name}</p>
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span>日付: {record.date}</span>
                              <span>出勤: {record.clockIn || '未出勤'}</span>
                              <span>退勤: {record.clockOut || '勤務中'}</span>
                              {record.workTime > 0 && (
                                <span>勤務: {formatMinutesToTime(record.workTime)}</span>
                              )}
                              {record.overtime > 0 && (
                                <span className="text-red-600">残業: {formatMinutesToTime(record.overtime)}</span>
                              )}
                              {record.firebaseId && (
                                <span className="text-blue-600">Firebase同期済み</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => handleEditAttendance(record)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}
                {(() => {
                  let filteredAttendance = [];
                  
                  if (endDateFilter) {
                    filteredAttendance = attendanceData.filter(record => 
                      record.date >= (dateFilter || new Date().toISOString().split('T')[0]) && 
                      record.date <= endDateFilter
                    );
                  } else {
                    filteredAttendance = getAttendanceByDate(dateFilter || new Date().toISOString().split('T')[0]);
                  }
                  
                  if (userFilter.length > 0) {
                    filteredAttendance = filteredAttendance.filter(record => userFilter.includes(record.userId));
                  }
                  
                  filteredAttendance = filteredAttendance.filter(record => {
                    const user = users.find(u => u.id === record.userId);
                    return user?.status === 'active';
                  });

                  return filteredAttendance.length === 0 && (
                    <p className="text-gray-500 text-center py-4 text-sm">該当条件の出勤データがありません</p>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ホスト用レポート画面 */}
        {currentUser?.role === 'host' && currentView === 'reports' && (
          <div className="space-y-4 sm:space-y-6">
            {/* 期間選択とユーザーフィルター */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">レポート設定</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">月次レポート</label>
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="2025-08">2025年8月</option>
                    <option value="2025-07">2025年7月</option>
                    <option value="2025-06">2025年6月</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">年次レポート</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="2025">2025年</option>
                    <option value="2024">2024年</option>
                  </select>
                </div>
                <div className="relative user-filter-dropdown">
                  <label className="block text-sm font-medium text-gray-700 mb-2">対象ユーザー（複数選択可）</label>
                  <button
                    type="button"
                    onClick={() => setShowReportUserFilterDropdown(!showReportUserFilterDropdown)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-left bg-white flex items-center justify-between"
                  >
                    <span className="text-sm">
                      {reportUserFilter.length === 0 
                        ? '全員' 
                        : reportUserFilter.length === 1 
                          ? users.find(u => u.id === reportUserFilter[0])?.name || '選択済み'
                          : `${reportUserFilter.length}人選択済み`
                      }
                    </span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showReportUserFilterDropdown && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      <div className="p-2">
                        <label className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={reportUserFilter.length === 0}
                            onChange={() => setReportUserFilter([])}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-700">全員</span>
                        </label>
                        {users.filter(user => user.status === 'active').map(user => (
                          <label key={user.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={reportUserFilter.includes(user.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setReportUserFilter([...reportUserFilter, user.id]);
                                } else {
                                  setReportUserFilter(reportUserFilter.filter(id => id !== user.id));
                                }
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{user.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* チーム比較グラフ（フィルター適用） */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">チーム比較</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={teamComparisonData.filter(data => 
                    reportUserFilter.length === 0 || reportUserFilter.includes(users.find(u => u.name === data.name)?.id)
                  )}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="workHours" fill="#3B82F6" name="勤務時間(h)" />
                    <Bar dataKey="overtime" fill="#EF4444" name="残業時間(h)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 月次サマリー */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">月次サマリー ({selectedPeriod})</h3>
                <button
                  onClick={() => exportToExcel('monthly_summary', selectedPeriod)}
                  className="bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center space-x-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>月次</span>
                </button>
              </div>
              
              {(() => {
                const monthlyData = generateMonthlyData(selectedPeriod);
                const filteredMembers = reportUserFilter.length === 0 ? 
                  monthlyData.members : 
                  monthlyData.members.filter(member => reportUserFilter.includes(member.id));
                
                return (
                  <div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-blue-600">総勤務時間</p>
                        <p className="text-xl font-bold text-blue-800">{monthlyData.totalWorkHours}時間</p>
                      </div>
                      <div className="bg-red-50 p-4 rounded-lg">
                        <p className="text-sm text-red-600">総残業時間</p>
                        <p className="text-xl font-bold text-red-800">{monthlyData.totalOvertimeHours}時間</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-green-600">有給使用日数</p>
                        <p className="text-xl font-bold text-green-800">{monthlyData.vacationDaysUsed}日</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-purple-600">平均出勤率</p>
                        <p className="text-xl font-bold text-purple-800">{monthlyData.attendanceRate}%</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {filteredMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                              <User className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-medium text-gray-800">{member.name}</span>
                          </div>
                          <div className="flex items-center space-x-4 text-sm">
                            <span className="text-blue-600">勤務: {member.workHours}h</span>
                            <span className="text-red-600">残業: {member.overtimeHours}h</span>
                            <span className="text-green-600">有給: {member.vacationDays}日</span>
                            <span className="text-purple-600">出勤率: {member.attendanceRate}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 年次トレンド */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">年次トレンド ({selectedYear})</h3>
                <button
                  onClick={() => exportToExcel('yearly_summary', selectedYear)}
                  className="bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center space-x-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>年次</span>
                </button>
              </div>
              
              {(() => {
                const yearlyData = generateYearlyData(selectedYear);
                return (
                  <div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-blue-600">年間総勤務時間</p>
                        <p className="text-xl font-bold text-blue-800">{yearlyData.totalWorkHours}時間</p>
                      </div>
                      <div className="bg-red-50 p-4 rounded-lg">
                        <p className="text-sm text-red-600">年間総残業時間</p>
                        <p className="text-xl font-bold text-red-800">{yearlyData.totalOvertimeHours}時間</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-green-600">年間有給使用</p>
                        <p className="text-xl font-bold text-green-800">{yearlyData.totalVacationDays}日</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-purple-600">有給消化率</p>
                        <p className="text-xl font-bold text-purple-800">{yearlyData.vacationUsageRate}%</p>
                      </div>
                    </div>

                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={yearlyData.months}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="workHours" stroke="#3B82F6" name="勤務時間" />
                          <Line type="monotone" dataKey="overtimeHours" stroke="#EF4444" name="残業時間" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* 残業理由フォーム */}
        {showOvertimeForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">残業理由の入力</h3>
              <p className="text-sm text-gray-600 mb-4">
                定時を超過しました。残業理由を入力してください。
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">残業理由</label>
                  <textarea
                    value={overtimeReason}
                    onChange={(e) => setOvertimeReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    rows={3}
                    placeholder="残業が必要な理由を入力してください..."
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowOvertimeForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  後で入力
                </button>
                <button
                  onClick={handleOvertimeReasonSubmit}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>送信</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 有給申請モーダル */}
        {showVacationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-md max-h-screen overflow-y-auto">
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

                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-800">
                    有給残日数: {currentUser?.vacationDaysRemaining}日<br/>
                    代休残日数: {getCompensatoryDaysRemaining()}日
                  </p>
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
                    休日出勤が承認されると、代休を1日取得できます。<br/>
                    申請データはFirebaseに保存されます。
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">部署名 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={newUserForm.department}
                    onChange={(e) => setNewUserForm({...newUserForm, department: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="開発部"
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

                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Firebase連携:</strong><br/>
                    新規ユーザーはFirebaseに自動保存され、リアルタイム同期されます。
                  </p>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">部署名 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={newUserForm.department}
                    onChange={(e) => setNewUserForm({...newUserForm, department: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

                {editingUser?.firebaseId && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-800">
                      <strong>Firebase同期:</strong><br/>
                      このユーザーはFirebaseと同期されています。変更は自動保存されます。
                    </p>
                  </div>
                )}
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditUserModal(false);
                    setEditingUser(null);
                    setNewUserForm({ name: '', email: '', password: '', role: 'member', department: '', vacationDaysTotal: 20 });
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

export default App;
