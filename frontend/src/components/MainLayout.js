import React, { useEffect, useRef, useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Tag, Typography, Button } from 'antd';
import {
  AppstoreOutlined,
  BarChartOutlined,
  MoonOutlined,
  SunOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  HomeOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MoneyCollectOutlined,
  SettingOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  UserOutlined,
  WalletOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SafetyCertificateOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '经营看板' },
  { key: '/products', icon: <AppstoreOutlined />, label: '商品管理' },
  { key: '/sales', icon: <ShoppingCartOutlined />, label: '销售订单' },
  { key: '/customers', icon: <TeamOutlined />, label: '客户管理' },
  { key: '/suppliers', icon: <ShopOutlined />, label: '供应商' },
  { key: '/purchase', icon: <WalletOutlined />, label: '采购管理' },
  { key: '/inventory', icon: <DatabaseOutlined />, label: '库存中心' },
  { key: '/warehouses', icon: <HomeOutlined />, label: '仓库管理' },
  { key: '/finance', icon: <MoneyCollectOutlined />, label: '财务中心' },
  { key: '/reports', icon: <BarChartOutlined />, label: '报表中心' },
  { key: '/ai-analysis', icon: <BulbOutlined />, label: 'AI智能分析' },
  { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
  { key: '/data', icon: <FileTextOutlined />, label: '数据管理' },
];

const developerMenuItems = [
  { key: '/diagnostics', icon: <SafetyCertificateOutlined />, label: '运行诊断' },
];

function MainLayout({ children, user, onLogout, developerMode = false, darkMode = false, onToggleDarkMode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [collapsed, setCollapsed] = useState(false);
  const themeBtnRef = useRef(null);
  const visibleMenuItems = developerMode ? [...menuItems, ...developerMenuItems] : menuItems;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const dropdownItems = [
    {
      key: 'role',
      label: `当前角色：${user?.role === 'admin' ? '管理员' : user?.role === 'operator' ? '操作员' : '访客'}`,
      disabled: true,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: onLogout,
    },
  ];

  return (
    <Layout className="main-shell">
      <Sider
        width={220}
        theme="light"
        className="main-sider"
        collapsible
        breakpoint="lg"
        collapsedWidth={64}
        collapsed={collapsed}
        onCollapse={setCollapsed}
      >
        <div className="main-brand">
          <Text className={`main-brand-title ${collapsed ? 'is-collapsed' : ''}`} strong style={{ display: 'block', fontSize: 18 }}>
            Lutra 财务管理系统
          </Text>
          <Text className={`main-brand-sub ${collapsed ? 'is-collapsed' : ''}`} type="secondary">
            智慧经营中枢
          </Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={visibleMenuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderInlineEnd: 0, background: 'transparent' }}
        />
      </Sider>
      <Layout>
        <Header className="main-header">
          <div className="main-header-left">
            <Button
              type="text"
              className="menu-toggle-btn"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((prev) => !prev)}
            />
            <Space direction="vertical" size={0}>
              <Text strong style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>欢迎回来，{user?.username || '管理员'}</Text>
              <Space size={8} wrap>
                <Tag color="blue">正式版</Tag>
                <Tag color="cyan">数据持久化</Tag>
                {developerMode ? <Tag color="gold">开发者模式</Tag> : null}
                <Text type="secondary">{currentTime.toLocaleString('zh-CN', { hour12: false })}</Text>
              </Space>
            </Space>
          </div>
          <Space size={12}>
            <Button
              ref={themeBtnRef}
              type="text"
              icon={darkMode ? <SunOutlined style={{ color: '#f4b75c' }} /> : <MoonOutlined />}
              onClick={() => {
                if (onToggleDarkMode && themeBtnRef.current) {
                  onToggleDarkMode(themeBtnRef.current.getBoundingClientRect());
                }
              }}
              title={darkMode ? '切换到亮色模式' : '切换到暗色模式'}
            />
            <Dropdown menu={{ items: dropdownItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} />
                <Text className="main-user-name" title={user?.username || '管理员'}>{user?.username || '管理员'}</Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content className="main-content">{children}</Content>
      </Layout>
    </Layout>
  );
}

export default MainLayout;
