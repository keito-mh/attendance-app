import React, { useState, useEffect } from 'react';
import { 
  Clock, MapPin, User, Calendar, Shield, Mail, Lock, Eye, EyeOff, 
  Plus, Edit2, Trash2, Download, CheckCircle, XCircle, 
  AlertCircle, Send, Coffee, TrendingUp, Users, 
  BarChart3, Home, ClipboardList, Save, CalendarDays, Wifi, WifiOff
} from 'lucide-react';

const App = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [users, setUsers] = useState([]);
  const [vacationRequests, setVacationRequests] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

  useEffect(() => {
    const initializeData = () => {
      const storedUsers = localStorage.getItem('attendanceApp_users');
      
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

      const loggedInUser = localStorage.getItem('currentUser');
      if (loggedInUser) {
        setCurrentUser(JSON.parse(loggedInUser));
        setCurrentView('dashboard');
      }
    };

    initializeData();
  }, []);

  const handleLogin = () => {
    const user = users.find(u => u.email === loginForm.email);
    if (user && user.password === loginForm.password && user.status === 'active') {
      setCurrentUser(user);
      localStorage.setItem('currentUser', JSON.stringify(user));
      setCurrentView('dashboard');
      setLoginForm({ email: '', password: '' });
    } else {
      alert('メールアドレスまたはパスワードが間違っています');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    setCurrentView('login');
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
              <label className="block text-sm font-medium text-gray-700 mb-2">メールアドレス</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">パスワード</label>
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
                <p className="text-xl sm:text-2xl font-bold text-purple-600">0日</p>
              </div>
              <CalendarDays className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500" />
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-2xl p-6 shadow-lg text-center">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">システム正常動作中</h3>
          <p className="text-gray-600 mb-4">
            基本機能が動作しています。Firebase同期機能は後で追加予定です。
          </p>
          <div className="flex items-center justify-center space-x-2">
            <Wifi className="w-5 h-5 text-green-500" />
            <span className="text-green-600 font-medium">接続OK</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
