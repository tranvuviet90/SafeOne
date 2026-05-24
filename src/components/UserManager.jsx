import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { db, functions } from '../firebase';
import { collection, query, where, getDocs, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useToast } from './LightboxSwipeOnly';
import { colors } from '../theme';

const ALL_ROLES = [
  "admin", "ehs", "ehs committee", "manager", "Nhà Ăn",
  "G_Cutting","G_Rolling","G_Finishing","G_Dipping","G_Buffing","G_Graphics",
  "G_QC","A_QC","QC_Management","Kayak","A_Rolling","A_Cosmetics","Planning",
  "Kho VW","WH_SK","WH_FG","WH_EM","WH_AG","Apple","MTN","Paint Blending",
  "Engineering","MFG","Bảo Vệ","Tạp Vụ","Office"
];

export default function UserManager({ user, isMobile }) {
  const { t } = useI18n();
  const { pushToast } = useToast();
  
  const [activeTab, setActiveTab] = useState('users'); // 'users' or 'requests'
  const [loading, setLoading] = useState(false);
  
  // Tab Users
  const [users, setUsers] = useState([]);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Tab Requests
  const [requests, setRequests] = useState([]);

  // Modals
  const [resetPassModal, setResetPassModal] = useState(null); // UID
  const [newPassword, setNewPassword] = useState('');
  const [roleModal, setRoleModal] = useState(null); // { uid, currentRoles }
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [createAccountModal, setCreateAccountModal] = useState(false);
  const [newAccountData, setNewAccountData] = useState({ name: '', email: '', password: '', role: 'Nhà Ăn', customRole: '' });
  
  // New States for Rename & Search
  const [renameModal, setRenameModal] = useState(null); // { uid, currentName }
  const [newName, setNewName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Tab API Key Config
  const [aiProvider, setAiProvider] = useState('google');
  const [aiModel, setAiModel] = useState('gemini-2.0-flash');
  const [apiKey, setApiKey] = useState('');
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const listUsers = httpsCallable(functions, 'listUsers');
      const result = await listUsers();
      setUsers(result.data.users);
    } catch (err) {
      console.error(err);
      pushToast('Lỗi khi tải danh sách người dùng.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'role_requests'), where('status', '==', 'pending'));
      const snap = await getDocs(q);
      const reqs = [];
      snap.forEach(doc => {
        reqs.push({ id: doc.id, ...doc.data() });
      });
      setRequests(reqs);
    } catch (err) {
      console.error(err);
      pushToast('Lỗi khi tải yêu cầu chức vụ.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAIConfig = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, 'settings', 'ai_config');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAiProvider(data.provider || 'google');
        setAiModel(data.model || 'gemini-2.0-flash');
        if (data.apiKey) {
          setApiKey('MOCKED_SAVED_KEY');
          setHasSavedKey(true);
        } else {
          setApiKey('');
          setHasSavedKey(false);
        }
      } else {
        setAiProvider('google');
        setAiModel('gemini-2.0-flash');
        setApiKey('');
        setHasSavedKey(false);
      }
    } catch (err) {
      console.error("Error fetching AI config:", err);
      pushToast('Lỗi khi tải cấu hình AI.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAIConfig = async (e) => {
    e.preventDefault();
    setIsSavingKey(true);
    setSaveStatus('Đang lưu...');
    try {
      const docRef = doc(db, 'settings', 'ai_config');
      const docSnap = await getDoc(docRef);
      
      let finalKey = apiKey;
      if (apiKey === 'MOCKED_SAVED_KEY' && docSnap.exists()) {
        finalKey = docSnap.data().apiKey || '';
      }

      await setDoc(docRef, {
        provider: aiProvider,
        model: aiModel,
        apiKey: finalKey,
        updatedAt: new Date()
      }, { merge: true });

      setSaveStatus('Lưu thành công!');
      pushToast('Cấu hình AI đã được cập nhật!', 'success');
      if (finalKey) {
        setApiKey('MOCKED_SAVED_KEY');
        setHasSavedKey(true);
      } else {
        setApiKey('');
        setHasSavedKey(false);
      }
    } catch (err) {
      console.error("Error saving AI config:", err);
      setSaveStatus('Lỗi khi lưu cấu hình.');
      pushToast(err.message || 'Lỗi khi lưu cấu hình.', 'error');
    } finally {
      setIsSavingKey(false);
    }
  };

  useEffect(() => {
    fetchRequests(); // Luôn load requests khi mount để hiện badge số lượng
    if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'requests') fetchRequests();
    else if (activeTab === 'apikey') fetchAIConfig();
  }, [activeTab]);

  const handleAdminAction = async (action, targetUid, data = {}) => {
    if (action === 'delete' && !window.confirm(t('manager.confirm.delete'))) return;
    
    const toastId = pushToast('Đang xử lý...', 'info');
    try {
      const adminUserAction = httpsCallable(functions, 'adminUserAction');
      await adminUserAction({ action, targetUid, data });
      pushToast('Thành công!', 'success');
      
      // Refresh data
      if (['createUser', 'resetPassword', 'changeRole', 'changeName', 'disable', 'enable', 'delete'].includes(action)) {
        setResetPassModal(null);
        setRoleModal(null);
        setRenameModal(null);
        fetchUsers();
      } else {
        fetchRequests();
      }
    } catch (err) {
      console.error(err);
      pushToast(err.message || 'Có lỗi xảy ra.', 'error');
    }
  };

  // Search & Pagination logic
  const filteredUsers = users.filter(u => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      (u.name || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term) ||
      (u.role || '').toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const currentUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const tdStyle = { padding: '10px 12px', borderBottom: '1px solid #eee' };
  const thStyle = { padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #ccc', background: '#f9f9f9', position: 'sticky', top: 0 };
  const btnStyle = { padding: '4px 8px', margin: '2px', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'white' };

  return (
    <div style={{ 
      padding: isMobile ? 0 : 20, 
      maxWidth: 1000, 
      margin: '0 auto', 
      background: isMobile ? 'transparent' : 'white', 
      borderRadius: isMobile ? 0 : 12, 
      boxShadow: isMobile ? 'none' : '0 2px 10px rgba(0,0,0,0.05)', 
      marginTop: isMobile ? 0 : 20 
    }}>
      <h2 style={{ color: colors.primary, marginTop: 0, borderBottom: `2px solid ${colors.primaryLight || '#E88E2E'}`, paddingBottom: 10 }}>{t('manager.title')}</h2>
      
      {/* Tabs Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button 
            onClick={() => setActiveTab('users')}
            style={{ padding: '8px 16px', background: activeTab === 'users' ? colors.primary : '#f0f0f0', color: activeTab === 'users' ? 'white' : '#333', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 600 }}
          >
            {t('manager.tab.users')}
          </button>
          <button 
            onClick={() => setActiveTab('requests')}
            style={{ padding: '8px 16px', background: activeTab === 'requests' ? colors.primary : '#f0f0f0', color: activeTab === 'requests' ? 'white' : '#333', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 600 }}
          >
            {t('manager.tab.requests')}
            {requests.length > 0 && <span style={{ background: 'red', color: 'white', borderRadius: 10, padding: '2px 6px', fontSize: 12, marginLeft: 6 }}>{requests.length}</span>}
          </button>
          <button 
            onClick={() => setActiveTab('apikey')}
            style={{ padding: '8px 16px', background: activeTab === 'apikey' ? colors.primary : '#f0f0f0', color: activeTab === 'apikey' ? 'white' : '#333', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 600 }}
          >
            🔑 API Key
          </button>
        </div>
        {activeTab === 'users' && (
          <button
            onClick={() => setCreateAccountModal(true)}
            style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 600 }}
          >
            + Tạo tài khoản
          </button>
        )}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 20, color: '#888' }}>{t('common.loading')}...</div>}

      {/* Tab: USERS */}
      {!loading && activeTab === 'users' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div>
                Hiển thị: 
                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} style={{ marginLeft: 8, padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', background: 'white' }}>
                  <option value={10}>10</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="🔍 Tìm kiếm tên, email, chức vụ..."
                style={{
                  padding: '6px 12px',
                  borderRadius: 20,
                  border: '1px solid #ccc',
                  fontSize: 14,
                  minWidth: isMobile ? '100%' : 220,
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ fontSize: 14, color: '#666', fontWeight: 600 }}>Tổng: {filteredUsers.length} / {users.length} users</div>
          </div>

          {isMobile ? (
            /* Mobile View: Render each user as a premium flat card to fit perfectly with the page */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 15 }}>
              {currentUsers.map(u => (
                <div 
                  key={u.uid} 
                  style={{ 
                    background: u.disabled ? '#fff0f0' : '#ffffff', 
                    border: `1px solid ${u.disabled ? '#fecaca' : '#d0e2e0'}`, 
                    borderRadius: 12, 
                    padding: 16,
                    boxShadow: '0 2px 8px rgba(70, 110, 115, 0.05)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, color: colors.primary, fontSize: 16 }}>{u.name}</span>
                    <span style={{ color: u.disabled ? 'red' : 'green', fontWeight: 600, fontSize: 13 }}>
                      {u.disabled ? t('manager.status.disabled') : t('manager.status.active')}
                    </span>
                  </div>
                  
                  <div style={{ fontSize: 13, color: '#5a6f72', marginBottom: 6, wordBreak: 'break-all' }}>
                    <strong>Email:</strong> {u.email}
                  </div>
                  
                  <div style={{ fontSize: 13, color: '#2b3a3c', marginBottom: 12 }}>
                    <strong>Chức vụ:</strong> <span style={{ background: colors.primaryLight, color: colors.primaryDark, padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, marginLeft: 6 }}>{u.role}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #eee', paddingTop: 10 }}>
                    <select
                      onChange={(e) => {
                        const act = e.target.value;
                        if (!act) return;
                        if (act === 'rename') {
                          setRenameModal({ uid: u.uid, currentName: u.name });
                          setNewName(u.name || '');
                        } else if (act === 'resetPass') {
                          setResetPassModal(u.uid);
                        } else if (act === 'changeRole') {
                          setRoleModal({ uid: u.uid, currentRoles: u.role });
                          setSelectedRoles(u.role ? (Array.isArray(u.role) ? u.role : [u.role]) : []);
                        } else if (act === 'enable') {
                          handleAdminAction('enable', u.uid);
                        } else if (act === 'disable') {
                          handleAdminAction('disable', u.uid);
                        } else if (act === 'delete') {
                          handleAdminAction('delete', u.uid);
                        }
                        e.target.value = ''; // reset selection
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: '1px solid #ccc',
                        background: '#fff',
                        fontSize: 13,
                        fontWeight: '600',
                        color: '#333',
                        cursor: 'pointer',
                        width: '100%',
                        maxWidth: 160
                      }}
                    >
                      <option value="">Tùy chỉnh...</option>
                      <option value="rename">✍️ Đổi tên</option>
                      <option value="changeRole">🔑 Đổi chức vụ</option>
                      <option value="resetPass">🔒 Đặt lại Pass</option>
                      {u.disabled ? (
                        <option value="enable">✅ Kích hoạt</option>
                      ) : (
                        <option value="disable">🚫 Vô hiệu hóa</option>
                      )}
                      <option value="delete">❌ Xóa</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Desktop View: Keep elegant structured table */
            <div style={{ overflowX: 'auto', maxHeight: '60vh' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>{t('manager.table.email')}</th>
                    <th style={thStyle}>{t('manager.table.name')}</th>
                    <th style={thStyle}>{t('manager.table.role')}</th>
                    <th style={thStyle}>{t('manager.table.status')}</th>
                    <th style={thStyle}>{t('manager.table.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {currentUsers.map(u => (
                    <tr key={u.uid} style={{ background: u.disabled ? '#fff0f0' : 'inherit' }}>
                      <td style={tdStyle}>{u.email}</td>
                      <td style={tdStyle}>{u.name}</td>
                      <td style={tdStyle}><strong>{u.role}</strong></td>
                      <td style={tdStyle}>
                        <span style={{ color: u.disabled ? 'red' : 'green', fontWeight: 600 }}>
                          {u.disabled ? t('manager.status.disabled') : t('manager.status.active')}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <button onClick={() => { setRenameModal({ uid: u.uid, currentName: u.name }); setNewName(u.name || ''); }} style={{ ...btnStyle, background: '#10b981' }}>Đổi tên</button>
                        <button onClick={() => setResetPassModal(u.uid)} style={{ ...btnStyle, background: '#f59e0b' }}>{t('manager.action.resetPass')}</button>
                        <button onClick={() => { setRoleModal({ uid: u.uid, currentRoles: u.role }); setSelectedRoles(u.role ? (Array.isArray(u.role) ? u.role : [u.role]) : []); }} style={{ ...btnStyle, background: '#3b82f6' }}>{t('manager.action.changeRole')}</button>
                        
                        {u.disabled ? (
                          <button onClick={() => handleAdminAction('enable', u.uid)} style={{ ...btnStyle, background: '#10b981' }}>{t('manager.action.enable')}</button>
                        ) : (
                          <button onClick={() => handleAdminAction('disable', u.uid)} style={{ ...btnStyle, background: '#6b7280' }}>{t('manager.action.disable')}</button>
                        )}
                        
                        <button onClick={() => handleAdminAction('delete', u.uid)} style={{ ...btnStyle, background: '#ef4444' }}>{t('manager.action.delete')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 15 }}>
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} style={{ padding: '4px 10px', borderRadius: 4, cursor: 'pointer' }}>&lt;</button>
              <span style={{ padding: '4px 10px', fontWeight: 'bold' }}>{currentPage} / {totalPages}</span>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} style={{ padding: '4px 10px', borderRadius: 4, cursor: 'pointer' }}>&gt;</button>
            </div>
          )}
        </>
      )}

      {/* Tab: REQUESTS */}
      {!loading && activeTab === 'requests' && (
        <div style={{ overflowX: 'auto' }}>
          {requests.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>Không có yêu cầu nào.</div>
          ) : (
            isMobile ? (
              /* Mobile View: Render each role request as a flat card to fit perfectly with the page */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {requests.map(req => (
                  <div 
                    key={req.id} 
                    style={{ 
                      background: '#ffffff', 
                      border: `1px solid #d0e2e0`, 
                      borderRadius: 12, 
                      padding: 16,
                      boxShadow: '0 2px 8px rgba(70, 110, 115, 0.05)'
                    }}
                  >
                    <div style={{ fontWeight: 700, color: colors.primary, fontSize: 16, marginBottom: 8 }}>{req.name}</div>
                    
                    <div style={{ fontSize: 13, color: '#5a6f72', marginBottom: 6, wordBreak: 'break-all' }}>
                      <strong>Email:</strong> {req.email}
                    </div>
                    
                    <div style={{ fontSize: 13, color: '#2b3a3c', marginBottom: 6 }}>
                      <strong>Quyền hiện tại:</strong> <span style={{ textDecoration: 'line-through', color: '#888', marginLeft: 6 }}>{req.currentRole}</span>
                    </div>

                    <div style={{ fontSize: 13, color: '#2b3a3c', marginBottom: 12 }}>
                      <strong>Quyền muốn đổi:</strong> <span style={{ background: colors.primaryLight, color: colors.primaryDark, padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700, marginLeft: 6 }}>{req.requestedRole}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #eee', paddingTop: 10 }}>
                      <button onClick={() => handleAdminAction('rejectRoleRequest', req.uid, { requestId: req.id })} style={{ ...btnStyle, background: '#ef4444', padding: '6px 14px' }}>{t('manager.action.reject')}</button>
                      <button onClick={() => handleAdminAction('approveRoleRequest', req.uid, { requestId: req.id, newRole: req.requestedRole })} style={{ ...btnStyle, background: '#10b981', padding: '6px 14px' }}>{t('manager.action.approve')}</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Desktop View: Keep elegant structured table */
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Tên (Email)</th>
                    <th style={thStyle}>Quyền hiện tại</th>
                    <th style={thStyle}>Quyền muốn đổi</th>
                    <th style={thStyle}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(req => (
                    <tr key={req.id}>
                      <td style={tdStyle}>{req.name} <br/><span style={{ color: '#666', fontSize: 12 }}>{req.email}</span></td>
                      <td style={tdStyle}>{req.currentRole}</td>
                      <td style={tdStyle}><strong style={{ color: colors.primary }}>{req.requestedRole}</strong></td>
                      <td style={tdStyle}>
                        <button onClick={() => handleAdminAction('approveRoleRequest', req.uid, { requestId: req.id, newRole: req.requestedRole })} style={{ ...btnStyle, background: '#10b981' }}>{t('manager.action.approve')}</button>
                        <button onClick={() => handleAdminAction('rejectRoleRequest', req.uid, { requestId: req.id })} style={{ ...btnStyle, background: '#ef4444' }}>{t('manager.action.reject')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      )}

      {/* Tab: API KEY */}
      {!loading && activeTab === 'apikey' && (
        <form onSubmit={handleSaveAIConfig} style={{ background: '#fafafa', border: '1px solid #e0e0e0', borderRadius: 12, padding: 24, marginTop: 10 }}>
          <h3 style={{ marginTop: 0, color: colors.primary, borderBottom: '1px solid #eee', paddingBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            🔑 Cấu hình Dịch vụ AI (Spellcheck)
          </h3>
          
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 6, fontSize: 14, color: '#333' }}>
              Nhà cung cấp dịch vụ AI:
            </label>
            <select 
              value={aiProvider} 
              onChange={e => {
                const prov = e.target.value;
                setAiProvider(prov);
                setAiModel(prov === 'google' ? 'gemini-2.0-flash' : 'gpt-4o-mini');
              }} 
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', boxSizing: 'border-box', background: 'white' }}
            >
              <option value="google">Google Gemini</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 6, fontSize: 14, color: '#333' }}>
              Mô hình AI sử dụng:
            </label>
            <select 
              value={aiModel} 
              onChange={e => setAiModel(e.target.value)} 
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', boxSizing: 'border-box', background: 'white' }}
            >
              {aiProvider === 'google' ? (
                <>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash (Khuyên dùng)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                </>
              ) : (
                <>
                  <option value="gpt-4o-mini">GPT-4o Mini (Khuyên dùng)</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </>
              )}
            </select>
          </div>

          <div style={{ marginBottom: 22 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 6, fontSize: 14, color: '#333' }}>
              API Key cá nhân:
            </label>
            <input 
              type="password" 
              value={apiKey} 
              onChange={e => setApiKey(e.target.value)}
              placeholder={hasSavedKey ? "••••••••••••••••" : "Nhập API Key để kích hoạt kết nối trực tiếp..."}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', boxSizing: 'border-box' }}
            />
            {hasSavedKey && (
              <p style={{ margin: '5px 0 0', fontSize: 12, color: '#2e7d32', fontWeight: 600 }}>
                ✓ Hệ thống đã lưu trữ và bảo mật API Key của bạn. Bạn vẫn có thể ghi đè khóa mới nếu cần.
              </p>
            )}
            {!hasSavedKey && (
              <p style={{ margin: '5px 0 0', fontSize: 12, color: '#666' }}>
                * Nếu không có API Key, tính năng tự sửa lỗi chính tả sẽ tự động chuyển tiếp qua Cloud Function fallback.
              </p>
            )}
          </div>

          {saveStatus && (
            <div style={{ 
              marginBottom: 18, 
              padding: '8px 12px', 
              borderRadius: 6, 
              background: saveStatus.includes('thành công') ? '#e8f5e9' : '#fff3e0',
              color: saveStatus.includes('thành công') ? '#2e7d32' : '#e65100',
              fontSize: 14,
              fontWeight: 600
            }}>
              {saveStatus}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            {hasSavedKey && (
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm("Bạn có chắc chắn muốn XÓA API Key đã lưu?")) {
                    setApiKey('');
                    setHasSavedKey(false);
                    setSaveStatus('Chưa lưu thay đổi.');
                  }
                }}
                style={{ padding: '10px 20px', borderRadius: 8, border: '1.5px solid #d32f2f', background: 'transparent', color: '#d32f2f', cursor: 'pointer', fontWeight: 600 }}
              >
                Xóa Key cũ
              </button>
            )}
            <button 
              type="submit" 
              disabled={isSavingKey} 
              style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: colors.primary, color: 'white', fontWeight: 'bold', cursor: 'pointer', opacity: isSavingKey ? 0.6 : 1 }}
            >
              {isSavingKey ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          </div>
        </form>
      )}

      {/* MODALS */}
      {createAccountModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'white', padding: 24, borderRadius: 12, width: '90%', maxWidth: 400 }}>
            <h3>Tạo tài khoản mới</h3>
            
            <p style={{ margin: '10px 0 5px', fontSize: 14, fontWeight: 'bold' }}>Tên hiển thị:</p>
            <input type="text" value={newAccountData.name} onChange={e => setNewAccountData({...newAccountData, name: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc', boxSizing: 'border-box' }} placeholder="Nhập tên..." />
            
            <p style={{ margin: '10px 0 5px', fontSize: 14, fontWeight: 'bold' }}>Email:</p>
            <input type="email" value={newAccountData.email} onChange={e => setNewAccountData({...newAccountData, email: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc', boxSizing: 'border-box' }} placeholder="user@example.com" />
            
            <p style={{ margin: '10px 0 5px', fontSize: 14, fontWeight: 'bold' }}>Mật khẩu (≥ 6 ký tự):</p>
            <input type="text" value={newAccountData.password} onChange={e => setNewAccountData({...newAccountData, password: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc', boxSizing: 'border-box' }} placeholder="Mật khẩu..." />
            
            <p style={{ margin: '10px 0 5px', fontSize: 14, fontWeight: 'bold' }}>Chức vụ:</p>
            <select value={newAccountData.role} onChange={e => setNewAccountData({...newAccountData, role: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc', boxSizing: 'border-box' }}>
              {ALL_ROLES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
              <option value="Khác (Tạo mới)">Khác (Tạo mới)</option>
            </select>
            
            {newAccountData.role === 'Khác (Tạo mới)' && (
              <div style={{ marginTop: 10 }}>
                <input type="text" value={newAccountData.customRole} onChange={e => setNewAccountData({...newAccountData, customRole: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc', boxSizing: 'border-box' }} placeholder="Nhập tên chức vụ mới..." />
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setCreateAccountModal(false)} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Hủy</button>
              <button 
                onClick={() => {
                  const finalRole = newAccountData.role === 'Khác (Tạo mới)' ? newAccountData.customRole : newAccountData.role;
                  handleAdminAction('createUser', null, { 
                    email: newAccountData.email, 
                    password: newAccountData.password, 
                    name: newAccountData.name,
                    role: finalRole 
                  });
                  setCreateAccountModal(false);
                  setNewAccountData({ name: '', email: '', password: '', role: 'Nhà Ăn', customRole: '' });
                }} 
                disabled={!newAccountData.email || newAccountData.password.length < 6 || (newAccountData.role === 'Khác (Tạo mới)' && !newAccountData.customRole)} 
                style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: colors.primary, color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Tạo
              </button>
            </div>
          </div>
        </div>
      )}
      {renameModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'white', padding: 24, borderRadius: 12, width: '90%', maxWidth: 400 }}>
            <h3 style={{ marginTop: 0 }}>Đổi tên người dùng</h3>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>Nhập tên mới cho tài khoản email <strong>{users.find(u => u.uid === renameModal.uid)?.email}</strong>:</p>
            <input 
              type="text" 
              value={newName} 
              onChange={e => setNewName(e.target.value)} 
              style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc', marginBottom: 20, boxSizing: 'border-box' }} 
              placeholder="Tên mới..."
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setRenameModal(null)} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: '#e0e0e0', cursor: 'pointer' }}>Hủy</button>
              <button 
                onClick={() => handleAdminAction('changeName', renameModal.uid, { newName })} 
                disabled={!newName.trim() || newName === renameModal.currentName} 
                style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: colors.primary, color: 'white', fontWeight: 'bold', cursor: 'pointer', opacity: (!newName.trim() || newName === renameModal.currentName) ? 0.5 : 1 }}
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
      {resetPassModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'white', padding: 24, borderRadius: 12, width: '90%', maxWidth: 400 }}>
            <h3>Đặt lại mật khẩu</h3>
            <p>Nhập mật khẩu mới (ít nhất 6 ký tự):</p>
            <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc', marginBottom: 20, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setResetPassModal(null)} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Hủy</button>
              <button onClick={() => handleAdminAction('resetPassword', resetPassModal, { newPassword })} disabled={newPassword.length < 6} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: colors.primary, color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Lưu</button>
            </div>
          </div>
        </div>
      )}

      {roleModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'white', padding: 24, borderRadius: 12, width: '90%', maxWidth: 440 }}>
            <h3 style={{ marginTop: 0 }}>Đổi chức vụ</h3>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>Chọn một hoặc nhiều chức vụ cho người dùng này:</p>
            <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #ddd', borderRadius: 8, padding: '8px 0' }}>
              {ALL_ROLES.map(r => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5', background: selectedRoles.includes(r) ? '#fff6ea' : 'white' }}>
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(r)}
                    onChange={e => {
                      if (e.target.checked) setSelectedRoles(prev => [...prev, r]);
                      else setSelectedRoles(prev => prev.filter(x => x !== r));
                    }}
                    style={{ width: 16, height: 16, accentColor: colors.primary, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 14, color: selectedRoles.includes(r) ? colors.primary : '#333', fontWeight: selectedRoles.includes(r) ? 700 : 400 }}>{r}</span>
                </label>
              ))}
            </div>
            {selectedRoles.length > 0 && (
              <p style={{ fontSize: 13, color: colors.primary, fontWeight: 600, marginTop: 10, marginBottom: 0 }}>
                Đã chọn ({selectedRoles.length}): {selectedRoles.join(', ')}
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button onClick={() => setRoleModal(null)} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Hủy</button>
              <button
                onClick={() => handleAdminAction('changeRole', roleModal.uid, { newRole: selectedRoles.length === 1 ? selectedRoles[0] : selectedRoles.join(', ') })}
                disabled={selectedRoles.length === 0}
                style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: colors.primary, color: 'white', fontWeight: 'bold', cursor: 'pointer', opacity: selectedRoles.length === 0 ? 0.5 : 1 }}
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
