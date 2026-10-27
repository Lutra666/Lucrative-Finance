<template>
  <view class="login-page">
    <view class="login-header">
      <text class="login-title">Lutra 财务管理系统</text>
      <text class="login-subtitle">批发零售企业管理手机端</text>
    </view>

    <view class="login-card">
      <up-form :model="form" :rules="rules" ref="formRef" labelPosition="top">
        <up-form-item prop="username" borderBottom>
          <up-input
            v-model="form.username"
            placeholder="请输入用户名"
            prefixIcon="account"
            clearable
            border="none"
          />
        </up-form-item>
        <up-form-item prop="password" borderBottom>
          <up-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            prefixIcon="lock"
            border="none"
          />
        </up-form-item>
      </up-form>

      <up-button
        type="primary"
        :loading="submitting"
        :disabled="submitting"
        text="登 录"
        block
        shape="round"
        customStyle="margin-top: 40rpx; height: 88rpx; font-size: 32rpx;"
        @click="handleLogin"
      />

      <view class="login-hint" v-if="!errorMsg">
        <text>默认账户 admin / admin123</text>
      </view>
      <view class="login-error" v-if="errorMsg">
        <up-icon name="error-circle" size="18" color="#e74c3c" />
        <text>{{ errorMsg }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useUserStore } from '@/store/user';

const userStore = useUserStore();
const formRef = ref(null);
const submitting = ref(false);
const errorMsg = ref('');

const form = reactive({
  username: 'admin',
  password: 'admin123',
});

const rules = {
  username: { type: 'string', required: true, message: '请输入用户名', trigger: ['blur'] },
  password: { type: 'string', required: true, message: '请输入密码', trigger: ['blur'] },
};

const handleLogin = async () => {
  try {
    await formRef.value.validate();
  } catch {
    return;
  }

  errorMsg.value = '';
  submitting.value = true;

  try {
    const res = await userStore.login(form.username, form.password);

    if (res.requirePasswordChange) {
      uni.showModal({
        title: '安全提示',
        content: '您正在使用默认密码，登录后请立即修改密码',
        confirmText: '知道了',
        showCancel: false,
        success() {
          uni.switchTab({ url: '/pages/dashboard/dashboard' });
        },
      });
    } else {
      uni.switchTab({ url: '/pages/dashboard/dashboard' });
    }
  } catch (err) {
    errorMsg.value = err.message || '登录失败，请检查网络连接';
  } finally {
    submitting.value = false;
  }
};
</script>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #eef4fb 0%, #d4e3f8 100%);
  padding: 0 64rpx;
}

.login-header {
  text-align: center;
  margin-bottom: 80rpx;
}

.login-title {
  display: block;
  font-size: 48rpx;
  font-weight: 700;
  color: #18243d;
  margin-bottom: 16rpx;
}

.login-subtitle {
  font-size: 26rpx;
  color: #8b9bb5;
}

.login-card {
  width: 100%;
  background: #fff;
  border-radius: 24rpx;
  padding: 48rpx 40rpx;
  box-shadow: 0 8rpx 32rpx rgba(47, 122, 248, 0.08);
}

.login-hint {
  text-align: center;
  margin-top: 32rpx;
}

.login-hint text {
  font-size: 22rpx;
  color: #b0bec5;
}

.login-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  margin-top: 24rpx;
}

.login-error text {
  font-size: 24rpx;
  color: #e74c3c;
}
</style>
