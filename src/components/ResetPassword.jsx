import React, { useState } from 'react';
import apiClient from '../services/apiClient';
import { colors, alpha, shadows } from '../theme';

// Standalone view rendered when the app is opened via an email reset link
// (e.g. https://app/?reset=<token>). Lets the user set a new password.
export default function ResetPassword({ token }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const goToLogin = () => {
    // Drop the ?reset=... query string and return to the login screen.
    window.location.href = window.location.origin + window.location.pathname;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/api/auth/reset-password', { token, newPassword });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Đặt lại mật khẩu thất bại. Liên kết có thể đã hết hạn.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100dvh', width: '100vw', background: 'var(--so-login-bg)', padding: 20, boxSizing: 'border-box' }}>
      <div className="so-card" style={{ boxShadow: shadows.lg, padding: '36px 40px', width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <h2 style={{ color: colors.textPrimary, marginBottom: 10, fontWeight: 700, fontSize: 26, letterSpacing: '-0.01em' }}>Đặt lại mật khẩu</h2>

        {done ? (
          <>
            <p style={{ color: colors.success, marginBottom: 24, fontSize: 15, lineHeight: 1.6, background: alpha('success', 0.12), padding: 14, borderRadius: 'var(--so-radius-sm)' }}>
              ✅ Mật khẩu của bạn đã được cập nhật thành công. Bạn có thể đăng nhập bằng mật khẩu mới.
            </p>
            <button onClick={goToLogin} className="so-btn so-btn--primary" style={{ width: '100%', padding: 14, fontSize: 16 }}>
              Đến trang đăng nhập
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ color: colors.textSecondary, marginBottom: 24, fontSize: 14 }}>Nhập mật khẩu mới cho tài khoản của bạn.</p>
            {error && <p style={{ color: colors.error, marginBottom: 18, fontSize: 14, fontWeight: 500 }}>{error}</p>}

            <div style={{ marginBottom: 18, textAlign: 'left' }}>
              <label className="so-label">Mật khẩu mới</label>
              <input type="password" className="so-input" value={newPassword} onChange={e => setNewPassword(e.target.value)} required style={{ fontSize: 15 }} />
            </div>

            <div style={{ marginBottom: 24, textAlign: 'left' }}>
              <label className="so-label">Nhập lại mật khẩu mới</label>
              <input type="password" className="so-input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required style={{ fontSize: 15 }} />
            </div>

            <button type="submit" disabled={loading} className="so-btn so-btn--primary" style={{ width: '100%', padding: 14, fontSize: 16 }}>
              {loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
            </button>
            <button type="button" onClick={goToLogin} className="so-btn" style={{ width: '100%', marginTop: 12, padding: 12, fontSize: 14 }}>
              Quay lại đăng nhập
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
