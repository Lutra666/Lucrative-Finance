<template>
  <view class="profile-page">
    <view class="profile-header">
      <view class="avatar">
        <up-icon name="account" size="48" color="#fff" />
      </view>
      <text class="username">{{ store.username }}</text>
      <up-tag :text="store.isAdmin ? '管理员' : '操作员'" type="primary" size="small" plain />
    </view>

    <view class="section">
      <up-cell-group>
        <up-cell title="用户名" :value="store.username" icon="account" />
        <up-cell title="角色" :value="store.role === 'admin' ? '管理员' : '操作员'" icon="info-circle" />
        <up-cell title="手机号" :value="store.user?.phone || '未设置'" icon="phone" />
        <up-cell title="邮箱" :value="store.user?.email || '未设置'" icon="email" />
      </up-cell-group>
    </view>

    <view class="section">
      <up-cell-group title="设置">
        <up-cell title="暗色模式">
          <template #right-icon>
            <up-switch
              :modelValue="appStore.darkMode"
              @update:modelValue="appStore.setDarkMode($event)"
              size="22"
            />
          </template>
        </up-cell>
      </up-cell-group>
    </view>

    <view class="section">
      <up-cell-group>
        <up-cell title="修改密码" icon="lock" clickable @click="goChangePassword" />
        <up-cell title="退出登录" icon="share" clickable @click="handleLogout" />
      </up-cell-group>
    </view>

    <view class="footer">
      <text class="version">Lutra 财务管理系统 v1.0.8</text>
    </view>

    <up-modal
      :show="showLogout"
      title="退出确认"
      content="确定要退出登录吗？"
      showCancelButton
      @confirm="confirmLogout"
      @cancel="showLogout = false"
    />
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app';
import { useUserStore } from '@/store/user';
import { useAppStore } from '@/store/app';

const store = useUserStore();
const appStore = useAppStore();

const showLogout = ref(false);

const goChangePassword = () => {
  uni.navigateTo({ url: '/pages/profile/change-password' });
};

const handleLogout = () => {
  showLogout.value = true;
};

const confirmLogout = () => {
  showLogout.value = false;
  store.logout();
  uni.reLaunch({ url: '/pages/login/login' });
};

onShow(async () => {
  try {
    await store.fetchProfile();
  } catch {
    // ignore refresh errors - stale data is fine
  }
});

onPullDownRefresh(async () => {
  try {
    await store.fetchProfile();
  } catch {
    // ignore
  }
  uni.stopPullDownRefresh();
});
</script>

<style lang="scss" scoped>
.profile-page {
  min-height: 100vh;
  background: #f5f6fa;
  padding-bottom: 60rpx;
}

.profile-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0 40rpx;
  background: linear-gradient(135deg, #2f7af8, #6c63ff);
}

.avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
}

.username {
  font-size: 36rpx;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8rpx;
}

.section {
  margin-top: 24rpx;
}

.footer {
  display: flex;
  justify-content: center;
  margin-top: 60rpx;
}

.version {
  font-size: 24rpx;
  color: #c0ccda;
}
</style>
