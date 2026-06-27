import React, { useState } from 'react';
import apiClient from '../services/apiClient';

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
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', width:'100vw', background:'linear-gradient(135deg, #A9D9D4 0%, #466E73 100%)', padding:'20px', boxSizing:'border-box' }}>
      <div style={{ background:'white', padding:'40px 50px', borderRadius:'16px', boxShadow:'0 10px 30px rgba(0,0,0,0.1)', width:'100%', maxWidth:'420px', textAlign:'center', boxSizing:'border-box' }}>
        <h2 style={{ color:'#222', marginBottom:'10px', fontWeight:'700', fontSize:'26px' }}>Đặt lại mật khẩu</h2>

        {done ? (
          <>
            <p style={{ color:'#2e7d32', marginBottom:'24px', fontSize:'15px', lineHeight:1.6, background:'#e8f5e9', padding:'14px', borderRadius:'8px' }}>
              ✅ Mật khẩu của bạn đã được cập nhật thành công. Bạn có thể đăng nhập bằng mật khẩu mới.
            </p>
            <button onClick={goToLogin} style={{ width:'100%', padding:'14px', borderRadius:'8px', border:'none', background:'#466E73', color:'white', fontSize:'16px', fontWeight:'700', cursor:'pointer' }}>
              Đến trang đăng nhập
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ color:'#555', marginBottom:'24px', fontSize:'14px' }}>Nhập mật khẩu mới cho tài khoản của bạn.</p>
            {error && <p style={{ color:'red', marginBottom:'18px', fontSize:'14px', fontWeight:'500' }}>{error}</p>}

            <div style={{ marginBottom:'18px', textAlign:'left' }}>
              <label style={{ display:'block', marginBottom:'6px', color:'#333', fontWeight:'600', fontSize:'14px' }}>Mật khẩu mới</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required style={{ width:'100%', padding:'12px 15px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'15px', boxSizing:'border-box' }} />
            </div>

            <div style={{ marginBottom:'24px', textAlign:'left' }}>
              <label style={{ display:'block', marginBottom:'6px', color:'#333', fontWeight:'600', fontSize:'14px' }}>Nhập lại mật khẩu mới</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required style={{ width:'100%', padding:'12px 15px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'15px', boxSizing:'border-box' }} />
            </div>

            <button type="submit" disabled={loading} style={{ width:'100%', padding:'14px', borderRadius:'8px', border:'none', background:'#466E73', color:'white', fontSize:'16px', fontWeight:'700', cursor:'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
            </button>
            <button type="button" onClick={goToLogin} style={{ width:'100%', marginTop:'12px', padding:'12px', borderRadius:'8px', border:'1px solid #ddd', background:'white', color:'#555', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>
              Quay lại đăng nhập
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
