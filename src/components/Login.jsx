import React, { useState, useEffect } from 'react';
import authService from '../services/authService';
import apiClient from '../services/apiClient';
import { useI18n } from '../i18n/I18nProvider';
import { colors, alpha, shadows } from '../theme';

function Login({ setUser }) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // States for the "forgot password" modal
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotDevLink, setForgotDevLink] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // States for system initialization form
  const [showInitForm, setShowInitForm] = useState(false);
  const [initError, setInitError] = useState('');
  const [initName, setInitName] = useState('');
  const [initEmail, setInitEmail] = useState('');
  const [initPassword, setInitPassword] = useState('');
  const [initConfirmPassword, setInitConfirmPassword] = useState('');

  useEffect(() => {
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }

    // Check system initialization
    const checkInit = async () => {
      try {
        const res = await apiClient.get("/api/auth/check-init");
        setInitError('');
        if (res.data && res.data.initialized === false) {
          setShowInitForm(true);
        }
      } catch (e) {
        // Do NOT swallow this silently: a 5xx / network failure here means the
        // backend or MySQL isn't ready, so the first-admin setup form would
        // otherwise never appear and the user would be stuck on a login screen
        // with no account. Surface a clear, actionable message instead.
        console.warn("Check system init failed:", e);
        setInitError(
          "Không kiểm tra được trạng thái khởi tạo hệ thống. Backend hoặc MySQL có thể chưa sẵn sàng — hãy kiểm tra dịch vụ backend đang chạy, kết nối MySQL và file backend/.env, rồi tải lại trang."
        );
      }
    };
    checkInit();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (!email || !password) {
      setError(t('login.error.empty'));
      setLoading(false);
      return;
    }
    try {
      const data = await authService.login(email, password, rememberMe);
      const appUser = data.user;
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }
      setUser(appUser);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || t('login.error.generic');
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setForgotMsg('');
    setForgotDevLink('');
    if (!forgotEmail.trim()) {
      setForgotMsg('Vui lòng nhập email.');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await apiClient.post('/api/auth/forgot-password', { email: forgotEmail.trim() });
      setForgotMsg(res.data?.message || 'Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi.');
      // In dev (no SMTP configured) the backend returns the link directly so it can be tested.
      if (res.data?.devLink) setForgotDevLink(res.data.devLink);
    } catch (err) {
      setForgotMsg(err.response?.data?.error || 'Gửi yêu cầu thất bại. Vui lòng thử lại.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleInitAdmin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!initName.trim() || !initEmail.trim() || !initPassword || !initConfirmPassword) {
      setError("Vui lòng điền đầy đủ các thông tin yêu cầu.");
      setLoading(false);
      return;
    }

    if (initPassword !== initConfirmPassword) {
      setError("Mật khẩu xác nhận không trùng khớp.");
      setLoading(false);
      return;
    }

    try {
      await apiClient.post("/api/auth/init-admin", {
        email: initEmail.trim(),
        password: initPassword,
        name: initName.trim()
      });
      alert("Khởi tạo tài khoản Admin đầu tiên thành công! Bạn có thể đăng nhập ngay bây giờ.");
      setShowInitForm(false);
      setEmail(initEmail.trim());
      setPassword('');
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || "Đăng ký admin thất bại";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Khung toàn màn hình dùng chung cho cả form login lẫn form khởi tạo.
  // Nền lấy từ token --so-login-bg: gradient teal ở tông sáng, nền tối + quầng teal ở tông tối.
  const screenStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100dvh',
    width: '100vw',
    background: 'var(--so-login-bg)',
    padding: 20,
    boxSizing: 'border-box'
  };

  const errorBoxStyle = {
    color: colors.error,
    marginBottom: 20,
    fontSize: 13,
    fontWeight: 500,
    padding: 12,
    background: alpha('error', 0.1),
    borderRadius: 'var(--so-radius-sm)',
    lineHeight: 1.5,
    textAlign: 'left'
  };

  if (showInitForm) {
    return (
      <div style={screenStyle}>
        <form onSubmit={handleInitAdmin} className="so-card" style={{ boxShadow: shadows.lg, padding: '36px 40px', width: '100%', maxWidth: 450, textAlign: 'center' }}>
          <h2 style={{ color: colors.textPrimary, marginBottom: 8, fontWeight: 700, fontSize: 26, letterSpacing: '-0.01em' }}>Khởi tạo hệ thống</h2>
          <p style={errorBoxStyle}>
            Hệ thống chưa có người dùng nào. Vui lòng tạo tài khoản Admin đầu tiên để thiết lập cấu hình.
          </p>
          {error && <p style={errorBoxStyle}>{error}</p>}

          <div style={{ marginBottom: 18, textAlign: 'left' }}>
            <label className="so-label">Tên người quản trị (Admin Name)</label>
            <input type="text" className="so-input" value={initName} onChange={e => setInitName(e.target.value)} placeholder="Ví dụ: Super Admin" required />
          </div>

          <div style={{ marginBottom: 18, textAlign: 'left' }}>
            <label className="so-label">Email Admin</label>
            <input type="email" className="so-input" value={initEmail} onChange={e => setInitEmail(e.target.value)} placeholder="admin@domain.com" required />
          </div>

          <div style={{ marginBottom: 18, textAlign: 'left' }}>
            <label className="so-label">Mật khẩu</label>
            <input type="password" className="so-input" value={initPassword} onChange={e => setInitPassword(e.target.value)} required />
          </div>

          <div style={{ marginBottom: 24, textAlign: 'left' }}>
            <label className="so-label">Nhập lại mật khẩu</label>
            <input type="password" className="so-input" value={initConfirmPassword} onChange={e => setInitConfirmPassword(e.target.value)} required />
          </div>

          <button type="submit" disabled={loading} className="so-btn so-btn--primary" style={{ width: '100%', padding: 14, fontSize: 16 }}>
            {loading ? "Đang đăng ký..." : "Khởi tạo & đăng ký Admin"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={screenStyle}>
      <form onSubmit={handleLogin} className="so-card" style={{ boxShadow: shadows.lg, padding: '36px 40px', width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <h2 style={{ color: colors.textPrimary, marginBottom: 6, fontWeight: 700, fontSize: 28, letterSpacing: '-0.01em' }}>{t('login.title')}</h2>
        <p style={{ color: colors.textSecondary, marginBottom: 28, fontSize: 15 }}>{t('login.subtitle')}</p>
        {initError && <p style={errorBoxStyle}>⚠️ {initError}</p>}
        {error && <p style={errorBoxStyle}>{error}</p>}
        <div style={{ marginBottom: 18, textAlign: 'left' }}>
          <label className="so-label">{t('login.email')}</label>
          <input type="email" className="so-input" value={email} onChange={e => setEmail(e.target.value)} required style={{ fontSize: 16 }} />
        </div>
        <div style={{ marginBottom: 18, textAlign: 'left' }}>
          <label className="so-label">{t('login.password')}</label>
          <input type="password" className="so-input" value={password} onChange={e => setPassword(e.target.value)} style={{ fontSize: 16 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, fontSize: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', color: colors.textSecondary, cursor: 'pointer' }}>
            <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} style={{ marginRight: 8, accentColor: colors.primary }} />
            {t('login.remember')}
          </label>
          <a href="#" style={{ color: colors.primary, textDecoration: 'none', fontWeight: 600 }}
            onClick={e => { e.preventDefault(); setForgotEmail(email); setForgotMsg(''); setShowForgot(true); }}>
            {t('login.forgot')}
          </a>
        </div>
        <button type="submit" disabled={loading} className="so-btn so-btn--primary" style={{ width: '100%', padding: 14, fontSize: 17 }}>
          {loading ? t('login.logging') : t('login.button')}
        </button>
      </form>

      {showForgot && (
        <div className="so-modal-overlay">
          <form onSubmit={handleForgot} className="so-modal" style={{ maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: colors.textPrimary, fontWeight: 700, fontSize: 20 }}>{t('login.forgot')}</h3>
              <button type="button" onClick={() => setShowForgot(false)} className="so-btn so-btn--ghost" style={{ padding: '4px 10px', fontSize: 18, color: colors.textSecondary }} aria-label="Đóng">✕</button>
            </div>
            <p style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
              Nhập email tài khoản của bạn. Chúng tôi sẽ gửi liên kết đặt lại mật khẩu đến hộp thư của bạn.
            </p>
            <input
              type="email"
              className="so-input"
              value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)}
              placeholder="email@domain.com"
              required
              style={{ marginBottom: 12 }}
            />
            {forgotMsg && (
              <p style={{ color: colors.primary, fontSize: 13, marginBottom: 12, background: alpha('primary', 0.08), padding: 10, borderRadius: 'var(--so-radius-sm)' }}>{forgotMsg}</p>
            )}
            {forgotDevLink && (
              <p style={{ fontSize: 12, marginBottom: 12, background: alpha('primary', 0.08), padding: 10, borderRadius: 'var(--so-radius-sm)', color: colors.warning, wordBreak: 'break-all' }}>
                ⚙️ Chế độ dev (chưa cấu hình SMTP) — nhấp để đặt lại mật khẩu:<br />
                <a href={forgotDevLink} style={{ color: colors.primary, fontWeight: 600 }}>{forgotDevLink}</a>
              </p>
            )}
            <button type="submit" disabled={forgotLoading} className="so-btn so-btn--primary" style={{ width: '100%', padding: 13, fontSize: 15 }}>
              {forgotLoading ? 'Đang gửi...' : 'Gửi liên kết đặt lại'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default Login;
