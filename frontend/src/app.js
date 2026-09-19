import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Layout, Result, Button, message, Modal, Form, Input, Alert } from 'antd';
import Login from './pages/Login';
import MainLayout from './components/MainLayout';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingComponent from './components/LoadingComponent';
import PrivateRoute from './components/PrivateRoute';
import ThemeOverlay from './components/ThemeOverlay';
import { changePassword, getProfile } from './services/api';
import './App.css';

const { Content } = Layout;

// 懒加载页面组件
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Products = lazy(() => import('./pages/Products'));
const SalesOrder = lazy(() => import('./pages/SalesOrder'));
const Customers = lazy(() => import('./pages/Customers'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Purchase = lazy(() => import('./pages/Purchase'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Finance = lazy(() => import('./pages/Finance'));
const Reports = lazy(() => import('./pages/Reports'));
const System = lazy(() => import('./pages/System'));
const Diagnostics = lazy(() => import('./pages/Diagnostics'));
const Data = lazy(() => import('./pages/Data'));
const PrintView = lazy(() => import('./pages/PrintView'));
const Warehouses = lazy(() => import('./pages/Warehouses'));
const AIAnalysis = lazy(() => import('./pages/AIAnalysis'));

function AppContent() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [developerMode, setDeveloperMode] = useState(false);
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [forceChangeError, setForceChangeError] = useState('');
  const [passwordForm] = Form.useForm();

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === '1');
  const [themeTransition, setThemeTransition] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const initSession = async () => {
      try {
        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');

        if (!token) {
          setLoading(false);
          return;
        }

        const profile = await getProfile();
        setUser(profile.user || (savedUser ? JSON.parse(savedUser) : null));
        setRequirePasswordChange(localStorage.getItem('requirePasswordChange') === '1');
        setDeveloperMode(localStorage.getItem('developerMode') === '1');
      } catch (err) {
        console.error('恢复用户状态失败:', err);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setError('登录状态已失效，请重新登录');
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, []);

  const handleLogin = (userData, options = {}) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    const needChange = Boolean(options.requirePasswordChange);
    setRequirePasswordChange(needChange);
    if (needChange) {
      localStorage.setItem('requirePasswordChange', '1');
    } else {
      localStorage.removeItem('requirePasswordChange');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('requirePasswordChange');
    setUser(null);
    setRequirePasswordChange(false);
    message.success('已退出登录');
  };

  const handleToggleDeveloperMode = (nextEnabled) => {
    setDeveloperMode(nextEnabled);
    if (nextEnabled) {
      localStorage.setItem('developerMode', '1');
      message.success('已进入开发者模式，可查看高级诊断与审计信息');
    } else {
      localStorage.removeItem('developerMode');
      message.success('已切换回用户模式');
    }
  };

  const handleToggleDarkMode = useCallback((buttonRect) => {
    const x = buttonRect.left + buttonRect.width / 2;
    const y = buttonRect.top + buttonRect.height / 2;
    setThemeTransition({ x, y, toDark: !darkMode });
  }, [darkMode]);

  const handleApplyTheme = useCallback(() => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', newMode ? '1' : '0');
  }, [darkMode]);

  const handleClearTransition = useCallback(() => {
    setThemeTransition(null);
  }, []);

  // 关闭默认密码提示：清除标记，本次登录内不再出现
  const handleDismissPasswordNotice = () => {
    localStorage.removeItem('requirePasswordChange');
    setRequirePasswordChange(false);
  };

  const handleForceChangePassword = async () => {
    try {
      setForceChangeError('');
      const values = await passwordForm.validateFields();
      setChangingPassword(true);
      await changePassword({
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });
      localStorage.removeItem('requirePasswordChange');
      setRequirePasswordChange(false);
      passwordForm.resetFields();
      message.success('密码修改成功，请重新登录');
      handleLogout();
    } catch (err) {
      if (err?.errorFields) {
        return;
      }
      setForceChangeError(err?.response?.data?.error || '修改密码失败，请稍后重试');
    } finally {
      setChangingPassword(false);
    }
  };

  const lightThemeConfig = {
    token: {
      colorPrimary: '#4f46e5',
      colorInfo: '#0d9488',
      colorSuccess: '#059669',
      colorWarning: '#d97706',
      colorError: '#e11d48',
      borderRadius: 10,
      borderRadiusLG: 14,
      colorBgLayout: '#f3f2ef',
      colorBgContainer: '#ffffff',
      colorBgElevated: '#ffffff',
      colorText: '#1b1b22',
      colorTextSecondary: '#6b6b75',
      colorTextTertiary: '#94949e',
      colorBorder: '#e6e4df',
      colorBorderSecondary: '#d4d2cc',
      fontFamily: '"Inter", "SF Pro Display", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif',
      fontSize: 14,
      lineHeight: 1.5,
      controlHeight: 38,
      paddingContentHorizontal: 20,
      paddingContentVertical: 16,
    },
    components: {
      Card: {
        borderRadiusLG: 16,
        paddingLG: 24,
      },
      Table: {
        headerBg: '#f7f6f3',
        headerColor: '#6b6b75',
        rowHoverBg: 'rgba(79, 70, 229, 0.03)',
        borderColor: '#e6e4df',
      },
      Button: {
        controlHeight: 38,
        borderRadius: 8,
        primaryShadow: '0 2px 8px rgba(79, 70, 229, 0.25)',
      },
      Menu: {
        itemBorderRadius: 8,
        itemMarginInline: 8,
        itemHeight: 40,
      },
      Input: {
        borderRadius: 8,
        controlHeight: 38,
      },
      Tag: {
        borderRadiusSM: 6,
      },
    },
  };

  const darkThemeConfig = {
    token: {
      colorPrimary: '#818cf8',
      colorInfo: '#2dd4bf',
      colorSuccess: '#34d399',
      colorWarning: '#fbbf24',
      colorError: '#fb7185',
      borderRadius: 10,
      borderRadiusLG: 14,
      colorBgLayout: '#161618',
      colorBgContainer: '#1f1f22',
      colorBgElevated: '#28282c',
      colorText: '#ededf0',
      colorTextSecondary: '#8e8e96',
      colorTextTertiary: '#5e5e66',
      colorBorder: '#2c2c30',
      colorBorderSecondary: '#34343a',
      fontSize: 14,
      lineHeight: 1.5,
      controlHeight: 38,
      paddingContentHorizontal: 20,
      paddingContentVertical: 16,
    },
    components: {
      Card: {
        borderRadiusLG: 16,
        paddingLG: 24,
      },
      Table: {
        headerBg: '#1a1a1d',
        headerColor: '#8e8e96',
        rowHoverBg: 'rgba(129, 140, 248, 0.05)',
        borderColor: '#2c2c30',
      },
      Button: {
        controlHeight: 38,
        borderRadius: 8,
        primaryShadow: '0 2px 8px rgba(129, 140, 248, 0.2)',
      },
      Menu: {
        itemBorderRadius: 8,
        itemMarginInline: 8,
        itemHeight: 40,
      },
      Input: {
        borderRadius: 8,
        controlHeight: 38,
      },
    },
  };

  if (loading) {
    return <LoadingComponent text="正在初始化财务管理系统..." />;
  }

  if (error) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Content style={{ padding: '50px 24px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Result
            status="warning"
            title="初始化失败"
            subTitle={error}
            extra={[
              <Button key="retry" type="primary" onClick={() => window.location.reload()}>
                重新加载
              </Button>,
              <Button key="login" onClick={() => {
                localStorage.clear();
                window.location.href = '/login';
              }}>
                重新登录
              </Button>,
            ]}
          />
        </Content>
      </Layout>
    );
  }

  return (
    <ConfigProvider theme={darkMode ? darkThemeConfig : lightThemeConfig}>
      {themeTransition ? (
        <ThemeOverlay
          x={themeTransition.x}
          y={themeTransition.y}
          toDark={themeTransition.toDark}
          onApply={handleApplyTheme}
          onDone={handleClearTransition}
        />
      ) : null}
      <Routes>
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login onLogin={handleLogin} darkMode={darkMode} />
            )
          }
        />
        <Route
          path="/*"
          element={
            <PrivateRoute user={user}>
              <>
                <MainLayout
                  user={user}
                  onLogout={handleLogout}
                  developerMode={developerMode}
                  darkMode={darkMode}
                  onToggleDarkMode={handleToggleDarkMode}
                >
                  <Suspense fallback={<LoadingComponent text="正在加载财务管理系统..." />}>
                    <Routes>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/products" element={<Products />} />
                      <Route path="/sales" element={<SalesOrder />} />
                      <Route path="/customers" element={<Customers />} />
                      <Route path="/suppliers" element={<Suppliers />} />
                      <Route path="/purchase" element={<Purchase />} />
                      <Route path="/inventory" element={<Inventory />} />
                      <Route path="/warehouses" element={<Warehouses />} />
                      <Route path="/finance" element={<Finance />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route
                        path="/settings"
                        element={
                          <System
                            developerMode={developerMode}
                            onToggleDeveloperMode={handleToggleDeveloperMode}
                          />
                        }
                      />
                      <Route
                        path="/diagnostics"
                        element={developerMode ? <Diagnostics /> : <Navigate to="/dashboard" replace />}
                      />
                      <Route path="/data" element={<Data developerMode={developerMode} />} />
                      <Route path="/print/:type/:id" element={<PrintView />} />
                      <Route path="/ai-analysis" element={<AIAnalysis />} />
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </Suspense>
                </MainLayout>
                <Modal
                  open={requirePasswordChange}
                  title="当前正在使用默认密码"
                  okText="确认修改并重新登录"
                  okButtonProps={{ loading: changingPassword }}
                  onOk={handleForceChangePassword}
                  onCancel={handleDismissPasswordNotice}
                >
                  <p style={{ marginBottom: 12, color: 'var(--text-secondary, #6b6b75)' }}>
                    为保证数据安全，建议尽快修改默认密码。你也可以关闭本提示，稍后在系统中修改。
                  </p>
                  {forceChangeError ? (
                    <Alert type="error" showIcon message={forceChangeError} style={{ marginBottom: 12 }} />
                  ) : null}
                  <Form form={passwordForm} layout="vertical">
                    <Form.Item
                      label="原密码"
                      name="oldPassword"
                      rules={[{ required: true, message: '请输入原密码' }]}
                    >
                      <Input.Password placeholder="请输入当前密码" />
                    </Form.Item>
                    <Form.Item
                      label="新密码"
                      name="newPassword"
                      rules={[
                        { required: true, message: '请输入新密码' },
                        { min: 8, message: '至少 8 位' },
                        { pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/, message: '需包含字母和数字' },
                      ]}
                    >
                      <Input.Password placeholder="请输入新密码" />
                    </Form.Item>
                    <Form.Item
                      label="确认新密码"
                      name="confirmPassword"
                      dependencies={['newPassword']}
                      rules={[
                        { required: true, message: '请再次输入新密码' },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!value || getFieldValue('newPassword') === value) {
                              return Promise.resolve();
                            }
                            return Promise.reject(new Error('两次输入的新密码不一致'));
                          },
                        }),
                      ]}
                    >
                      <Input.Password placeholder="请再次输入新密码" />
                    </Form.Item>
                  </Form>
                </Modal>
              </>
            </PrivateRoute>
          }
        />
      </Routes>
    </ConfigProvider>
  );
}

function App() {
  useEffect(() => {
    const onMove = (event) => {
      const x = `${(event.clientX / window.innerWidth) * 100}%`;
      const y = `${(event.clientY / window.innerHeight) * 100}%`;
      document.documentElement.style.setProperty('--mouse-x', x);
      document.documentElement.style.setProperty('--mouse-y', y);
    };

    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <ErrorBoundary>
      <Router>
        <AppContent />
      </Router>
    </ErrorBoundary>
  );
}

export default App;
