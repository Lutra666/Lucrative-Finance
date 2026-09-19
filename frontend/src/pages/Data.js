import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, List, Popconfirm, Row, Space, Table, Tag, message } from 'antd';
import { CloudDownloadOutlined, HistoryOutlined, ReloadOutlined } from '@ant-design/icons';
import PageHeader from '../components/PageHeader';
import { createBackup, listAuditLogs, listBackups, restoreBackup } from '../services/api';

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

export default function Data({ developerMode = false }) {
  const [loading, setLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState('');
  const [error, setError] = useState('');
  const [backups, setBackups] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const backupColumns = [
      {
        title: '备份文件',
        dataIndex: 'fileName',
        key: 'fileName',
      },
      {
        title: '大小',
        dataIndex: 'size',
        key: 'size',
        width: 110,
        render: (size) => formatBytes(size),
      },
      {
        title: '时间',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 180,
        render: (value) => new Date(value).toLocaleString('zh-CN', { hour12: false }),
      },
      {
        title: '操作',
        key: 'action',
        width: 170,
        render: (_, record) => (
          <Popconfirm
            title="确认恢复该备份吗？"
            description="恢复后会覆盖当前业务数据，建议先手动备份一次。"
            okText="确认恢复"
            cancelText="取消"
            onConfirm={() => handleRestore(record.fileName)}
          >
            <Button
              type="primary"
              ghost
              danger
              loading={restoreLoading === record.fileName}
              icon={<HistoryOutlined />}
            >
              恢复
            </Button>
          </Popconfirm>
        ),
      },
    ];

  const auditColumns = [
      {
        title: '时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 180,
        render: (value) => new Date(value).toLocaleString('zh-CN', { hour12: false }),
      },
      {
        title: '用户',
        key: 'user',
        width: 130,
        render: (_, record) => record.user?.username || 'unknown',
      },
      {
        title: '动作',
        key: 'action',
        width: 140,
        render: (_, record) => (
          <Tag color={record.method === 'DELETE' ? 'red' : 'blue'}>
            {record.method} {record.statusCode}
          </Tag>
        ),
      },
      {
        title: '路径',
        dataIndex: 'path',
        key: 'path',
        ellipsis: true,
      },
    ];

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const tasks = [listBackups()];
      if (developerMode) {
        tasks.push(listAuditLogs(80));
      }
      const [backupData, logsData] = await Promise.all(tasks);
      setBackups(backupData.items || []);
      setAuditLogs(logsData?.items || []);
    } catch (err) {
      setError(err?.response?.data?.error || '数据管理信息加载失败');
    } finally {
      setLoading(false);
    }
  }, [developerMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateBackup = async () => {
    setBackupLoading(true);
    try {
      await createBackup();
      message.success('备份已创建');
      await loadData();
    } catch (err) {
      message.error(err?.response?.data?.error || '创建备份失败');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestore = async (fileName) => {
    setRestoreLoading(fileName);
    try {
      await restoreBackup(fileName);
      message.success('备份恢复成功，建议刷新并核对数据');
      await loadData();
    } catch (err) {
      message.error(err?.response?.data?.error || '恢复备份失败');
    } finally {
      setRestoreLoading('');
    }
  };

  return (
    <>
      <PageHeader
        title="数据管理"
        description={
          developerMode
            ? '集中管理备份恢复与操作审计，保障正式版的可追溯与可恢复能力。'
            : '集中管理备份与恢复，帮助你安全维护业务数据。'
        }
      />
      {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} /> : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={15}>
          <Card
            className="surface-card"
            title="备份与恢复"
            extra={
              <Space>
                <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
                  刷新
                </Button>
                <Button
                  type="primary"
                  icon={<CloudDownloadOutlined />}
                  onClick={handleCreateBackup}
                  loading={backupLoading}
                >
                  立即备份
                </Button>
              </Space>
            }
          >
            <Table
              rowKey="fileName"
              loading={loading}
              columns={backupColumns}
              dataSource={backups}
              pagination={{ pageSize: 6, showSizeChanger: false }}
              locale={{ emptyText: '暂无备份，请先创建一次备份' }}
            />
          </Card>
        </Col>
        {developerMode ? (
          <>
            <Col xs={24} xl={9}>
              <Card className="surface-card" title="安全策略与建议">
                <List
                  size="small"
                  dataSource={[
                    '敏感字段已加密落盘，备份带签名校验。',
                    '建议配置 SECONDARY_BACKUP_DIR 做异地备份。',
                  ]}
                  renderItem={(item) => <List.Item>{item}</List.Item>}
                />
              </Card>
            </Col>
            <Col span={24}>
              <Card className="surface-card" title="最近操作审计">
                <Table
                  rowKey={(record) => String(record.id)}
                  loading={loading}
                  columns={auditColumns}
                  dataSource={auditLogs}
                  pagination={{ pageSize: 8, showSizeChanger: false }}
                  locale={{ emptyText: '暂无审计记录' }}
                  scroll={{ x: 760 }}
                />
              </Card>
            </Col>
          </>
        ) : null}
      </Row>
    </>
  );
}
