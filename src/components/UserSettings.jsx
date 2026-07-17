import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import apiClient from '../services/apiClient';
import authService from '../services/authService';
import { IoSettingsOutline, IoMoonOutline, IoSunnyOutline } from 'react-icons/io5';
import { useToast } from './LightboxSwipeOnly';
import { colors, alpha } from '../theme';
import { useTheme } from '../ThemeProvider';

const ALL_ROLES = [
  "admin", "ehs", "ehs committee", "trainer", "manager", "Nhà Ăn",
  "G_Cutting","G_Rolling","G_Finishing","G_Dipping","G_Buffing","G_Graphics",
  "G_QC","A_QC","QC_Management","Kayak","A_Rolling","A_Cosmetics","Planning",
  "Kho VW","WH_SK","WH_FG","WH_EM","WH_AG","Apple","MTN","Paint Blending",
  "Engineering","MFG","Bảo Vệ","Tạp Vụ","Office"
];

// Công tắc bật/tắt nhỏ, dựng bằng div vì <input type="checkbox"> không tô được
// theo bảng màu của app trên mọi trình duyệt.
function Switch({ on }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 34,
        height: 20,
        flexShrink: 0,
        borderRadius: 999,
        background: on ? colors.primary : colors.textDisabled,
        position: 'relative',
        transition: 'background .15s'
      }}
    >
      <span style={{
        position: 'absolute',
        top: 2,
        left: on ? 16 : 2,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: colors.white,
        transition: 'left .15s'
      }} />
    </span>
  );
}

export default function UserSettings({ user, onLogout }) {
  const { t } = useI18n();
  const { pushToast } = useToast();
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [isOpen, setIsOpen] = useState(false);
  const [modalType, setModalType] = useState(null); // 'password' | 'role' | null
  const menuRef = useRef(null);

  // Mật khẩu state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPass, setIsUpdatingPass] = useState(false);

  // Quyền state — cho phép chọn nhiều chức vụ cùng lúc
  const [requestedRoles, setRequestedRoles] = useState([]);
  const [isRequestingRole, setIsRequestingRole] = useState(false);

  const toggleRequestedRole = (role) => {
    setRequestedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) {
      pushToast(t('login.error.empty'), 'error');
      return;
    }
    setIsUpdatingPass(true);
    try {
      await authService.verifyPassword(oldPassword);
      await authService.updatePassword(newPassword);
      pushToast(t('common.success'), 'success');
      setModalType(null);
      setOldPassword('');
      setNewPassword('');
    } catch (error) {
      console.error(error);
      const errorMsg = error.response?.data?.error || error.message || t('login.error.invalid');
      pushToast(errorMsg, 'error');
    } finally {
      setIsUpdatingPass(false);
    }
  };

  const handleRequestRole = async (e) => {
    e.preventDefault();
    if (requestedRoles.length === 0) {
      pushToast(t('settings.requestRole.empty'), 'error');
      return;
    }
    setIsRequestingRole(true);
    try {
      await apiClient.post('/api/functions/submitRoleRequest', {
        requestedRole: requestedRoles.join(','),
        currentRole: user.role,
        name: user.name,
        email: user.email
      });
      pushToast(t('settings.requestRole.pending'), 'success');
      setRequestedRoles([]);
      setModalType(null);
    } catch (error) {
      console.error(error);
      pushToast(t('common.error'), 'error');
    } finally {
      setIsRequestingRole(false);
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'inherit'
        }}
        title={t('settings.title')}
      >
        <IoSettingsOutline size={24} />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          borderRadius: 8,
          padding: '8px 0',
          minWidth: 200,
          zIndex: 100
        }}>
          {/* Không đóng menu sau khi bấm: người dùng thấy ngay app đổi màu. */}
          <button
            onClick={toggleTheme}
            aria-pressed={isDark}
            style={{
              width: '100%', padding: '10px 16px', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 14, color: colors.textPrimary,
              display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = colors.backgroundLight}
            onMouseOut={(e) => e.currentTarget.style.background = 'none'}
          >
            {isDark ? <IoMoonOutline size={16} /> : <IoSunnyOutline size={16} />}
            <span style={{ flex: 1 }}>{t('settings.theme')}</span>
            <Switch on={isDark} />
          </button>

          <hr style={{ border: 'none', borderTop: `1px solid ${colors.border}`, margin: '6px 0' }} />

          <button
            onClick={() => { setModalType('password'); setIsOpen(false); }}
            style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 14, color: colors.textPrimary }}
            onMouseOver={(e) => e.currentTarget.style.background = colors.backgroundLight}
            onMouseOut={(e) => e.currentTarget.style.background = 'none'}
          >
            {t('settings.changePassword')}
          </button>
          <button
            onClick={() => { setRequestedRoles([]); setModalType('role'); setIsOpen(false); }}
            style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 14, color: colors.textPrimary }}
            onMouseOver={(e) => e.currentTarget.style.background = colors.backgroundLight}
            onMouseOut={(e) => e.currentTarget.style.background = 'none'}
          >
            {t('settings.requestRole')}
          </button>

          <hr style={{ border: 'none', borderTop: `1px solid ${colors.border}`, margin: '6px 0' }} />

          <button
            onClick={() => { onLogout && onLogout(); setIsOpen(false); }}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: 14,
              color: colors.error,
              fontWeight: '600'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = alpha('error', 0.13)}
            onMouseOut={(e) => e.currentTarget.style.background = 'none'}
          >
            {t('logout')}
          </button>
        </div>
      )}

      {/* Modal Change Password */}
      {modalType === 'password' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <form onSubmit={handleChangePassword} style={{ background: colors.surface, padding: 24, borderRadius: 12, width: '90%', maxWidth: 400 }}>
            <h3 style={{ marginTop: 0, color: colors.textPrimary }}>{t('settings.changePassword')}</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: colors.textSecondary }}>{t('settings.oldPassword')}</label>
              <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} required style={{ width: '100%', padding: 10, borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.background, color: colors.textPrimary, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: colors.textSecondary }}>{t('settings.newPassword')}</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required style={{ width: '100%', padding: 10, borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.background, color: colors.textPrimary, boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setModalType(null)} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: colors.backgroundLight, color: colors.textPrimary, cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button type="submit" disabled={isUpdatingPass} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: '#E88E2E', color: 'white', fontWeight: 'bold', cursor: 'pointer', opacity: isUpdatingPass ? 0.7 : 1 }}>
                {isUpdatingPass ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Request Role */}
      {modalType === 'role' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <form onSubmit={handleRequestRole} style={{ background: colors.surface, padding: 24, borderRadius: 12, width: '90%', maxWidth: 400 }}>
            <h3 style={{ marginTop: 0, color: colors.textPrimary }}>{t('settings.requestRole')}</h3>
            <p style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 8 }}>{t('settings.requestRole.desc')}</p>
            <p style={{ fontSize: 13, color: colors.textDisabled, marginBottom: 12 }}>{t('settings.requestRole.multiHint')}</p>
            <div style={{
              marginBottom: 20,
              maxHeight: 260,
              overflowY: 'auto',
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              padding: '8px 10px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '4px 12px'
            }}>
              {ALL_ROLES.map(r => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', fontSize: 13, color: colors.textPrimary, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={requestedRoles.includes(r)}
                    onChange={() => toggleRequestedRole(r)}
                    style={{ width: 16, height: 16, accentColor: '#10b981', cursor: 'pointer' }}
                  />
                  {r}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setModalType(null)} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: colors.backgroundLight, color: colors.textPrimary, cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button type="submit" disabled={isRequestingRole} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: '#10b981', color: 'white', fontWeight: 'bold', cursor: 'pointer', opacity: isRequestingRole ? 0.7 : 1 }}>
                {isRequestingRole ? t('common.loading') : t('common.send')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
