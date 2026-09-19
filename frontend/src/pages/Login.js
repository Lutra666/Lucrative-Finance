import React, { useState } from 'react';
import { Alert, Button, Card, Form, Input, Space, Typography } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { login } from '../services/api';

const { Title, Paragraph, Text } = Typography;

function Login({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (values) => {
    setLoading(true);
    setError('');
    try {
      const data = await login(values);
      localStorage.setItem('token', data.token);
      onLogin(data.user, { requirePasswordChange: Boolean(data.requirePasswordChange) });
    } catch (err) {
      setError(err.response?.data?.error || '登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-intro">
        <Text className="auth-tagline">进销存 · 资金流 · 客户经营</Text>
        <h1 className="auth-title">把业务、资金和决策汇入同一块智能驾驶舱。</h1>
        <p className="auth-subtitle">
          统一看板、统一数据、统一流程。登录后即可进入正式版经营后台，快速处理商品、客户、库存、财务和报表。
        </p>
        <div className="auth-badges">
          <span className="auth-badge">默认账号：admin</span>
          <span className="auth-badge">默认密码：admin123</span>
          <span className="auth-badge">首次登录建议立即改密</span>
        </div>
      </div>
      <div className="auth-card-wrap">
        <Card className="auth-card" style={{ width: '100%', maxWidth: 420, borderRadius: 24 }}>
          <Space direction="vertical" size={4} style={{ marginBottom: 24 }}>
            <Title level={3} style={{ margin: 0 }}>
              登录系统
            </Title>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              进入经营控制台，开始今天的业务管理。
            </Paragraph>
          </Space>
          {error ? <Alert showIcon type="error" message={error} style={{ marginBottom: 16 }} /> : null}
          <Form layout="vertical" onFinish={handleSubmit} initialValues={{ username: 'admin', password: 'admin123' }}>
            <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input prefix={<UserOutlined />} size="large" />
            </Form.Item>
            <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined />} size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              登录并进入工作台
            </Button>
          </Form>
        </Card>
      </div>
    </div>
  );
}

export default Login;
