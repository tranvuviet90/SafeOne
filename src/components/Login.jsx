import React, { useState, useEffect } from 'react';
import authService from '../services/authService';
import apiClient from '../services/apiClient';
import { useI18n } from '../i18n/I18nProvider';

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
        if (res.data && res.data.initialized === false) {
          setShowInitForm(true);
        }
      } catch (e) {
        console.warn("Check system init failed:", e);
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

  if (showInitForm) {
    return (
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', width:'100vw', background:'linear-gradient(135deg, #A9D9D4 0%, #466E73 100%)', padding:'20px', boxSizing:'border-box' }}>
        <form onSubmit={handleInitAdmin} style={{ background:'white', padding:'40px 50px', borderRadius:'16px', boxShadow:'0 10px 30px rgba(0,0,0,0.1)', width:'100%', maxWidth:'450px', textAlign:'center', boxSizing:'border-box' }}>
          <h2 style={{ color:'#222', marginBottom:'10px', fontWeight:'700', fontSize:'26px' }}>Khởi Tạo Hệ Thống</h2>
          <p style={{ color:'#e74c3c', marginBottom:'25px', fontSize:'14px', lineHeight:'1.5', fontWeight:'500', padding:'10px', background:'#fadbd8', borderRadius:'8px' }}>
            Hệ thống chưa có người dùng nào. Vui lòng tạo tài khoản Admin đầu tiên để thiết lập cấu hình.
          </p>
          {error && <p style={{ color:'red', marginBottom:'20px', fontSize:'14px', fontWeight:'500' }}>{error}</p>}
          
          <div style={{ marginBottom:'18px', textAlign:'left' }}>
            <label style={{ display:'block', marginBottom:'6px', color:'#333', fontWeight:'600', fontSize:'14px' }}>Tên người quản trị (Admin Name)</label>
            <input type="text" value={initName} onChange={e => setInitName(e.target.value)} placeholder="Ví dụ: Super Admin" required style={{ width:'100%', padding:'12px 15px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'15px', boxSizing:'border-box' }} />
          </div>

          <div style={{ marginBottom:'18px', textAlign:'left' }}>
            <label style={{ display:'block', marginBottom:'6px', color:'#333', fontWeight:'600', fontSize:'14px' }}>Email Admin</label>
            <input type="email" value={initEmail} onChange={e => setInitEmail(e.target.value)} placeholder="admin@domain.com" required style={{ width:'100%', padding:'12px 15px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'15px', boxSizing:'border-box' }} />
          </div>

          <div style={{ marginBottom:'18px', textAlign:'left' }}>
            <label style={{ display:'block', marginBottom:'6px', color:'#333', fontWeight:'600', fontSize:'14px' }}>Mật khẩu</label>
            <input type="password" value={initPassword} onChange={e => setInitPassword(e.target.value)} required style={{ width:'100%', padding:'12px 15px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'15px', boxSizing:'border-box' }} />
          </div>

          <div style={{ marginBottom:'25px', textAlign:'left' }}>
            <label style={{ display:'block', marginBottom:'6px', color:'#333', fontWeight:'600', fontSize:'14px' }}>Nhập lại mật khẩu</label>
            <input type="password" value={initConfirmPassword} onChange={e => setInitConfirmPassword(e.target.value)} required style={{ width:'100%', padding:'12px 15px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'15px', boxSizing:'border-box' }} />
          </div>

          <button type="submit" disabled={loading} style={{ width:'100%', padding:'15px', borderRadius:'8px', border:'none', background:'#e74c3c', color:'white', fontSize:'16px', fontWeight:'700', cursor:'pointer', boxShadow:'0 4px 15px rgba(231,76,60,0.3)', opacity: loading ? 0.7 : 1, transition:'all 0.2s ease-in-out' }}>
            {loading ? "Đang đăng ký..." : "Khởi Tạo & Đăng Ký Admin"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', width:'100vw', background:'linear-gradient(135deg, #A9D9D4 0%, #466E73 100%)', padding:'20px', boxSizing:'border-box' }}>
      <form onSubmit={handleLogin} style={{ background:'white', padding:'40px 50px', borderRadius:'16px', boxShadow:'0 10px 30px rgba(0,0,0,0.1)', width:'100%', maxWidth:'400px', textAlign:'center', boxSizing:'border-box' }}>
        <h2 style={{ color:'#222', marginBottom:'10px', fontWeight:'700', fontSize:'28px' }}>{t('login.title')}</h2>
        <p style={{ color:'#555', marginBottom:'30px', fontSize:'16px' }}>{t('login.subtitle')}</p>
        {error && <p style={{ color:'red', marginBottom:'20px' }}>{error}</p>}
        <div style={{ marginBottom:'20px', textAlign:'left' }}>
          <label style={{ display:'block', marginBottom:'8px', color:'#333', fontWeight:'600' }}>{t('login.email')}</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width:'100%', padding:'12px 15px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'16px', boxSizing:'border-box' }} />
        </div>
        <div style={{ marginBottom:'20px', textAlign:'left' }}>
          <label style={{ display:'block', marginBottom:'8px', color:'#333', fontWeight:'600' }}>{t('login.password')}</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width:'100%', padding:'12px 15px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'16px', boxSizing:'border-box' }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'30px', fontSize:'14px' }}>
          <label style={{ display:'flex', alignItems:'center', color:'#555', cursor:'pointer' }}>
            <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} style={{ marginRight:'8px', accentColor:'#466E73' }} />
            {t('login.remember')}
          </label>
          <a href="#" style={{ color:'#466E73', textDecoration:'none', fontWeight:'600' }}
            onClick={e => { e.preventDefault(); setForgotEmail(email); setForgotMsg(''); setShowForgot(true); }}>
            {t('login.forgot')}
          </a>
        </div>
        <button type="submit" disabled={loading} style={{ width:'100%', padding:'15px', borderRadius:'8px', border:'none', background:'#466E73', color:'white', fontSize:'18px', fontWeight:'700', cursor:'pointer', boxShadow:'0 4px 15px rgba(70,110,115,0.4)', opacity: loading ? 0.7 : 1 }}>
          {loading ? t('login.logging') : t('login.button')}
        </button>
      </form>

      {showForgot && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'16px' }}>
          <form onSubmit={handleForgot} style={{ background:'white', padding:'28px 30px', borderRadius:'14px', boxShadow:'0 10px 30px rgba(0,0,0,0.2)', width:'100%', maxWidth:'420px', boxSizing:'border-box' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
              <h3 style={{ margin:0, color:'#222', fontWeight:'700', fontSize:'20px' }}>{t('login.forgot')}</h3>
              <button type="button" onClick={() => setShowForgot(false)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#888' }}>✕</button>
            </div>
            <p style={{ color:'#555', fontSize:'14px', marginBottom:'16px', lineHeight:1.5 }}>
              Nhập email tài khoản của bạn. Chúng tôi sẽ gửi liên kết đặt lại mật khẩu đến hộp thư của bạn.
            </p>
            <input
              type="email"
              value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)}
              placeholder="email@domain.com"
              required
              style={{ width:'100%', padding:'12px 15px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'15px', boxSizing:'border-box', marginBottom:'12px' }}
            />
            {forgotMsg && (
              <p style={{ color:'#466E73', fontSize:'13px', marginBottom:'12px', background:'#eef6f5', padding:'10px', borderRadius:'8px' }}>{forgotMsg}</p>
            )}
            {forgotDevLink && (
              <p style={{ fontSize:'12px', marginBottom:'12px', background:'#fff7e6', padding:'10px', borderRadius:'8px', color:'#8a6d3b', wordBreak:'break-all' }}>
                ⚙️ Chế độ dev (chưa cấu hình SMTP) — nhấp để đặt lại mật khẩu:<br />
                <a href={forgotDevLink} style={{ color:'#466E73', fontWeight:600 }}>{forgotDevLink}</a>
              </p>
            )}
            <button type="submit" disabled={forgotLoading} style={{ width:'100%', padding:'13px', borderRadius:'8px', border:'none', background:'#466E73', color:'white', fontSize:'16px', fontWeight:'700', cursor:'pointer', opacity: forgotLoading ? 0.7 : 1 }}>
              {forgotLoading ? 'Đang gửi...' : 'Gửi liên kết đặt lại'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default Login;