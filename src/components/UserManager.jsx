import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import dbService from '../services/dbService';
import apiClient from '../services/apiClient';
import { useToast, useConfirm } from './LightboxSwipeOnly';
import { colors, alpha } from '../theme';
import { ALL_ROLES } from '../constants/roles';

export default function UserManager({ isMobile }) {
  const { t } = useI18n();
  const { pushToast } = useToast();
  const { askConfirm } = useConfirm();
  
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

  // Helper: parse role thành mảng, bất kể lưu dạng string hay array
  const parseRoles = (role) => {
    if (!role) return [];
    const arr = Array.isArray(role) ? role : [String(role)];
    return arr.flatMap(r => String(r).split(',')).map(r => r.trim()).filter(Boolean);
  };
  const [createAccountModal, setCreateAccountModal] = useState(false);
  const [newAccountData, setNewAccountData] = useState({ name: '', email: '', password: '', role: 'Nhà Ăn', customRole: '' });
  
  // New States for Rename & Search
  const [renameModal, setRenameModal] = useState(null); // { uid, currentName }
  const [newName, setNewName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Tab API Key Config
  const [aiProvider, setAiProvider] = useState('google');
  const [aiModel, setAiModel] = useState('gemini-2.5-flash');
  const [apiKey, setApiKey] = useState('');
  const [systemInstruction, setSystemInstruction] = useState('');
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);

  // Trained documents for Chatbot
  const [trainedDocs, setTrainedDocs] = useState([]);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [, setUploadingDoc] = useState(false);
  const [aiDocuments, setAiDocuments] = useState([]);

  // Password-recovery email content (admin-configurable). Placeholders: {name}, {link}
  const DEFAULT_RECOVERY_SUBJECT = 'Đặt lại mật khẩu SafeOne';
  const DEFAULT_RECOVERY_BODY = 'Xin chào {name},\n\nBạn (hoặc ai đó) đã yêu cầu đặt lại mật khẩu cho tài khoản SafeOne của bạn.\nNhấp vào liên kết sau để đặt lại mật khẩu (có hiệu lực trong 1 giờ):\n\n{link}\n\nNếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.';
  const [showRecoveryConfig, setShowRecoveryConfig] = useState(false);
  const [recoverySubject, setRecoverySubject] = useState(DEFAULT_RECOVERY_SUBJECT);
  const [recoveryBody, setRecoveryBody] = useState(DEFAULT_RECOVERY_BODY);
  const [savingRecovery, setSavingRecovery] = useState(false);

  const loadRecoveryConfig = async () => {
    try {
      const snap = await dbService.getDoc('settings', 'password_recovery');
      if (snap && snap._exists !== false) {
        setRecoverySubject(snap.emailSubject || DEFAULT_RECOVERY_SUBJECT);
        setRecoveryBody(snap.emailBody || DEFAULT_RECOVERY_BODY);
      }
    } catch (e) {
      // keep defaults on error
    }
  };

  const handleSaveRecoveryConfig = async () => {
    setSavingRecovery(true);
    try {
      await dbService.updateDoc('settings', 'password_recovery', {
        emailSubject: recoverySubject,
        emailBody: recoveryBody,
        updatedAt: new Date().toISOString()
      });
      pushToast('Đã lưu nội dung khôi phục mật khẩu!', 'success');
    } catch (err) {
      console.error('Error saving recovery config:', err);
      pushToast('Lưu nội dung khôi phục thất bại.', 'error');
    } finally {
      setSavingRecovery(false);
    }
  };

  useEffect(() => {
    loadRecoveryConfig();
  }, []);

  const triggerExtractMarkdown = async (docItem) => {
    pushToast("Đang trích xuất nội dung văn bản bằng AI...", "info");
    try {
      await apiClient.post("/api/functions/extractMarkdown", { docId: docItem.id, fileUrl: docItem.fileUrlVi || docItem.fileUrl || docItem.fileUrlEn });
      pushToast("AI đã trích xuất tài liệu thành công!", "success");
      fetchAIConfig();
    } catch (err) {
      console.error("Lỗi khi trích xuất AI:", err);
      pushToast("AI trích xuất thất bại", "error");
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const result = await apiClient.post('/api/functions/listUsers');
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
      const snap = await dbService.getDocs('role_requests');
      const reqs = snap.filter(item => item.status === 'pending').map(item => ({ id: item.id || item.uid, ...item }));
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
      let data = null;
      try {
        data = await dbService.getDoc('settings', 'ai_config');
      } catch (e) {
        console.log("No AI config doc yet");
      }
      if (data && data._exists !== false) {
        setAiProvider(data.provider || 'google');
        
        // Map old deprecated models to newer ones
        let loadedModel = data.model || 'gemini-2.5-flash';
        if (loadedModel === 'gemini-2.0-flash' || loadedModel === 'gemini-1.5-flash') {
          loadedModel = 'gemini-2.5-flash';
        } else if (loadedModel === 'gemini-1.5-pro') {
          loadedModel = 'gemini-2.5-pro';
        }
        setAiModel(loadedModel);
        
        setSystemInstruction(data.systemInstruction || '');
        setTrainedDocs(data.trainedDocs || []);
        // Backend chỉ trả cờ hasApiKey (không trả key thật) để tránh lộ khóa.
        if (data.hasApiKey) {
          setApiKey('MOCKED_SAVED_KEY');
          setHasSavedKey(true);
        } else {
          setApiKey('');
          setHasSavedKey(false);
        }
      } else {
        setAiProvider('google');
        setAiModel('gemini-2.5-flash');
        setSystemInstruction('');
        setTrainedDocs([]);
        setApiKey('');
        setHasSavedKey(false);
      }

      // Fetch active documents currently in use for RAG chatbot
      const docsSnap = await dbService.getDocs('documents');
      const docsList = docsSnap.map(d => ({ id: d.id || d.uid, ...d }));
      setAiDocuments(docsList);
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
      // Gửi thẳng giá trị apiKey trong state:
      //  - 'MOCKED_SAVED_KEY' (sentinel): backend giữ nguyên key đang lưu, không ghi đè.
      //  - chuỗi mới: đặt key mới.
      //  - '' (rỗng): xóa key.
      // Key thật không bao giờ được tải về client nên không cần đọc lại trước khi lưu.
      await dbService.updateDoc('settings', 'ai_config', {
        provider: aiProvider,
        model: aiModel,
        apiKey: apiKey,
        updatedAt: new Date()
      });

      setSaveStatus('Lưu thành công!');
      pushToast('Cấu hình API Key đã được cập nhật!', 'success');
      // Sau khi lưu: nếu vừa nhập key mới hoặc giữ key cũ (sentinel) thì coi như đã có key.
      if (apiKey && apiKey.trim() !== '') {
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

  const handleSaveSystemInstruction = async (e) => {
    e.preventDefault();
    setIsSavingKey(true);
    setSaveStatus('Đang lưu...');
    try {
      await dbService.updateDoc('settings', 'ai_config', {
        systemInstruction: systemInstruction,
        updatedAt: new Date()
      });
      setSaveStatus('Lưu chỉ dẫn thành công!');
      pushToast('Chỉ dẫn hệ thống đã được cập nhật!', 'success');
    } catch (err) {
      console.error("Error saving system instruction:", err);
      setSaveStatus('Lỗi khi lưu chỉ dẫn.');
      pushToast(err.message || 'Lỗi khi lưu chỉ dẫn.', 'error');
    } finally {
      setIsSavingKey(false);
    }
  };

  // eslint-disable-next-line no-unused-vars -- giữ cho UI nạp tài liệu huấn luyện AI (hiện chưa nối)
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file extension
    const allowedExtensions = ['txt', 'md', 'csv', 'json'];
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      pushToast('Định dạng tệp không hợp lệ. Chỉ hỗ trợ .txt, .md, .csv, .json.', 'error');
      e.target.value = '';
      return;
    }

    // Limit file size to 500KB
    if (file.size > 500 * 1024) {
      pushToast('Tệp quá lớn. Vui lòng tải tệp dưới 500KB để đảm bảo hiệu năng.', 'error');
      e.target.value = '';
      return;
    }

    setUploadingDoc(true);
    setSaveStatus('Đang đọc tệp tin...');

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target.result;
        
        const newDoc = {
          id: 'td-' + Date.now() + Math.random().toString(36).substr(2, 6),
          name: file.name,
          size: file.size,
          type: file.type || 'text/plain',
          uploadedAt: new Date().toLocaleDateString('vi-VN') + ' ' + new Date().toLocaleTimeString('vi-VN'),
          content: content
        };

        const updatedDocs = [...trainedDocs, newDoc];
        await dbService.updateDoc('settings', 'ai_config', {
          trainedDocs: updatedDocs
        });

        setTrainedDocs(updatedDocs);
        pushToast('Nạp tài liệu huấn luyện thành công!', 'success');
        setSaveStatus('Đang tạo embedding...');

        // Cắt + tạo embedding ở backend để chatbot chỉ nạp đoạn liên quan (tiết kiệm token)
        try {
          await apiClient.post('/api/functions/embedTrainingDoc', {
            id: newDoc.id,
            name: newDoc.name,
            content: newDoc.content
          });
          setSaveStatus('Huấn luyện thành công!');
        } catch (embErr) {
          console.error('Lỗi tạo embedding tài liệu:', embErr);
          pushToast('Đã lưu tài liệu nhưng tạo embedding thất bại. Hãy xóa tài liệu và nạp lại.', 'error');
        }
      };
      
      reader.onerror = (err) => {
        console.error(err);
        pushToast('Lỗi khi đọc nội dung tệp.', 'error');
        setSaveStatus('Lỗi đọc tệp.');
      };

      reader.readAsText(file, "UTF-8");
    } catch (err) {
      console.error(err);
      pushToast('Lỗi trong quá trình nạp tài liệu.', 'error');
      setSaveStatus('Lỗi nạp tài liệu.');
    } finally {
      setUploadingDoc(false);
      e.target.value = '';
    }
  };

  // eslint-disable-next-line no-unused-vars -- giữ cho UI xóa tài liệu huấn luyện AI (hiện chưa nối)
  const handleDeleteDoc = async (indexToDelete) => {
    if (!(await askConfirm("Bạn có chắc chắn muốn xóa tài liệu huấn luyện này?", "Xác nhận xóa tài liệu"))) return;
    
    try {
      const docToDelete = trainedDocs[indexToDelete];
      const updatedDocs = trainedDocs.filter((_, idx) => idx !== indexToDelete);
      await dbService.updateDoc('settings', 'ai_config', {
        trainedDocs: updatedDocs
      });

      // Xóa luôn embedding tương ứng (nếu có id)
      if (docToDelete?.id) {
        try {
          await apiClient.post('/api/functions/deleteTrainingDoc', { id: docToDelete.id });
        } catch (embErr) {
          console.error('Lỗi xóa embedding tài liệu:', embErr);
        }
      }

      setTrainedDocs(updatedDocs);
      pushToast('Đã xóa tài liệu khỏi bộ nhớ chatbot!', 'success');
    } catch (err) {
      console.error("Lỗi khi xóa tài liệu:", err);
      pushToast('Không thể xóa tài liệu. Vui lòng thử lại.', 'error');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  useEffect(() => {
    fetchRequests(); // Luôn load requests khi mount để hiện badge số lượng
    if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'requests') fetchRequests();
    else if (activeTab === 'apikey' || activeTab === 'train') fetchAIConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tải lại theo tab đang chọn
  }, [activeTab]);

  const handleAdminAction = async (action, targetUid, data = {}) => {
    if (action === 'delete' && !(await askConfirm(t('manager.confirm.delete'), "Xác nhận xóa người dùng"))) return;
    
    pushToast('Đang xử lý...', 'info');
    try {
      await apiClient.post('/api/functions/adminUserAction', { action, targetUid, data });
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
      (Array.isArray(u.role) ? u.role.join(', ') : (u.role || '')).toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const currentUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const tdStyle = { padding: '10px 12px', borderBottom: `1px solid ${colors.border}` };
  const thStyle = { padding: '10px 12px', textAlign: 'left', borderBottom: `2px solid ${colors.border}`, background: colors.backgroundLight, position: 'sticky', top: 0 };
  const btnStyle = { padding: '4px 8px', margin: '2px', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: colors.white };

  return (
    <div style={{ 
      padding: isMobile ? 0 : 20, 
      maxWidth: 1000, 
      margin: '0 auto', 
      background: isMobile ? 'transparent' : colors.surface,
      borderRadius: isMobile ? 0 : 12, 
      boxShadow: isMobile ? 'none' : '0 2px 10px rgba(0,0,0,0.05)', 
      marginTop: isMobile ? 0 : 20 
    }}>
      <h2 style={{ color: colors.primary, marginTop: 0, borderBottom: `2px solid ${colors.primaryLight}`, paddingBottom: 10 }}>{t('manager.title')}</h2>
      
      {/* Tabs Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button 
            onClick={() => setActiveTab('users')}
            style={{ padding: '8px 16px', background: activeTab === 'users' ? colors.primary : colors.backgroundLight, color: activeTab === 'users' ? colors.white : colors.textPrimary, border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 600 }}
          >
            {t('manager.tab.users')}
          </button>
          <button 
            onClick={() => setActiveTab('requests')}
            style={{ padding: '8px 16px', background: activeTab === 'requests' ? colors.primary : colors.backgroundLight, color: activeTab === 'requests' ? colors.white : colors.textPrimary, border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 600 }}
          >
            {t('manager.tab.requests')}
            {requests.length > 0 && <span style={{ background: colors.error, color: colors.white, borderRadius: 10, padding: '2px 6px', fontSize: 12, marginLeft: 6 }}>{requests.length}</span>}
          </button>
          <button 
            onClick={() => setActiveTab('apikey')}
            style={{ padding: '8px 16px', background: activeTab === 'apikey' ? colors.primary : colors.backgroundLight, color: activeTab === 'apikey' ? colors.white : colors.textPrimary, border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 600 }}
          >
            🔑 API Key
          </button>
          <button 
            onClick={() => setActiveTab('train')}
            style={{ padding: '8px 16px', background: activeTab === 'train' ? colors.primary : colors.backgroundLight, color: activeTab === 'train' ? colors.white : colors.textPrimary, border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 600 }}
          >
            🤖 Huấn luyện Chatbot
          </button>
        </div>
        {activeTab === 'users' && (
          <button
            onClick={() => setCreateAccountModal(true)}
            style={{ padding: '8px 16px', background: colors.success, color: colors.white, border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 600 }}
          >
            + Tạo tài khoản
          </button>
        )}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 20, color: colors.textSecondary }}>{t('common.loading')}...</div>}

      {/* Tab: USERS */}
      {!loading && activeTab === 'users' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div>
                Hiển thị: 
                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} style={{ marginLeft: 8, padding: '6px 10px', borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.surface }}>
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
                  border: `1px solid ${colors.border}`,
                  fontSize: 14,
                  minWidth: isMobile ? '100%' : 220,
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ fontSize: 14, color: colors.textSecondary, fontWeight: 600 }}>Tổng: {filteredUsers.length} / {users.length} users</div>
          </div>

          {/* Password recovery email content settings */}
          <div style={{ border: `1px solid ${colors.border}`, borderRadius: 12, marginBottom: 16, background: colors.backgroundLight, overflow: 'hidden' }}>
            <button
              onClick={() => setShowRecoveryConfig(v => !v)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 700, color: colors.primary, fontSize: 15 }}
            >
              <span>🔐 Cài đặt nội dung khôi phục mật khẩu</span>
              <span>{showRecoveryConfig ? '▲' : '▼'}</span>
            </button>
            {showRecoveryConfig && (
              <div style={{ padding: '0 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ margin: 0, fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
                  Nội dung email gửi cho người dùng khi họ bấm "Quên mật khẩu". Dùng <code>{'{name}'}</code> để chèn tên người dùng và <code>{'{link}'}</code> để chèn liên kết đặt lại mật khẩu.
                </p>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>Tiêu đề email</label>
                  <input
                    type="text"
                    value={recoverySubject}
                    onChange={e => setRecoverySubject(e.target.value)}
                    style={{ width: '100%', padding: 10, borderRadius: 6, border: `1px solid ${colors.border}`, boxSizing: 'border-box', fontSize: 14 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>Nội dung email</label>
                  <textarea
                    value={recoveryBody}
                    onChange={e => setRecoveryBody(e.target.value)}
                    rows={8}
                    style={{ width: '100%', padding: 10, borderRadius: 6, border: `1px solid ${colors.border}`, boxSizing: 'border-box', fontSize: 14, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                  <button
                    onClick={() => { setRecoverySubject(DEFAULT_RECOVERY_SUBJECT); setRecoveryBody(DEFAULT_RECOVERY_BODY); }}
                    style={{ padding: '8px 14px', borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.textSecondary, cursor: 'pointer', fontWeight: 600 }}
                  >
                    Khôi phục mặc định
                  </button>
                  <button
                    onClick={handleSaveRecoveryConfig}
                    disabled={savingRecovery}
                    style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: colors.primary, color: colors.white, cursor: 'pointer', fontWeight: 700, opacity: savingRecovery ? 0.7 : 1 }}
                  >
                    {savingRecovery ? 'Đang lưu...' : 'Lưu cài đặt'}
                  </button>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: colors.textDisabled, lineHeight: 1.5 }}>
                  Lưu ý: cần cấu hình SMTP (SMTP_HOST, SMTP_USER...) trong file <code>backend/.env</code> để hệ thống gửi được email. Nếu chưa cấu hình, liên kết đặt lại sẽ được in ra console của server.
                </p>
              </div>
            )}
          </div>

          {isMobile ? (
            /* Mobile View: Render each user as a premium flat card to fit perfectly with the page */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 15 }}>
              {currentUsers.map(u => (
                <div 
                  key={u.uid} 
                  style={{ 
                    background: u.disabled ? alpha('error', 0.08) : colors.surface,
                    border: `1px solid ${u.disabled ? alpha('error', 0.35) : colors.border}`,
                    borderRadius: 12, 
                    padding: 16,
                    boxShadow: '0 2px 8px rgba(70, 110, 115, 0.05)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, color: colors.primary, fontSize: 16 }}>{u.name}</span>
                    <span style={{ color: u.disabled ? colors.error : colors.success, fontWeight: 600, fontSize: 13 }}>
                      {u.disabled ? t('manager.status.disabled') : t('manager.status.active')}
                    </span>
                  </div>
                  
                  <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 6, wordBreak: 'break-all' }}>
                    <strong>Email:</strong> {u.email}
                  </div>
                  
                  <div style={{ fontSize: 13, color: colors.textPrimary, marginBottom: 12 }}>
                    <strong>Chức vụ:</strong> <span style={{ background: colors.primaryLight, color: colors.primaryDark, padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, marginLeft: 6 }}>{u.role}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: `1px solid ${colors.border}`, paddingTop: 10 }}>
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
                          setSelectedRoles(parseRoles(u.role));
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
                        border: `1px solid ${colors.border}`,
                        background: colors.surface,
                        fontSize: 13,
                        fontWeight: '600',
                        color: colors.textPrimary,
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
                    <tr key={u.uid} style={{ background: u.disabled ? alpha('error', 0.08) : 'inherit' }}>
                      <td style={tdStyle}>{u.email}</td>
                      <td style={tdStyle}>{u.name}</td>
                      <td style={tdStyle}><strong>{u.role}</strong></td>
                      <td style={tdStyle}>
                        <span style={{ color: u.disabled ? colors.error : colors.success, fontWeight: 600 }}>
                          {u.disabled ? t('manager.status.disabled') : t('manager.status.active')}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <button onClick={() => { setRenameModal({ uid: u.uid, currentName: u.name }); setNewName(u.name || ''); }} style={{ ...btnStyle, background: colors.success }}>Đổi tên</button>
                        <button onClick={() => setResetPassModal(u.uid)} style={{ ...btnStyle, background: colors.warning }}>{t('manager.action.resetPass')}</button>
                        <button onClick={() => { setRoleModal({ uid: u.uid, currentRoles: u.role }); setSelectedRoles(parseRoles(u.role)); }} style={{ ...btnStyle, background: colors.info }}>{t('manager.action.changeRole')}</button>
                        
                        {u.disabled ? (
                          <button onClick={() => handleAdminAction('enable', u.uid)} style={{ ...btnStyle, background: colors.success }}>{t('manager.action.enable')}</button>
                        ) : (
                          <button onClick={() => handleAdminAction('disable', u.uid)} style={{ ...btnStyle, background: colors.textSecondary }}>{t('manager.action.disable')}</button>
                        )}
                        
                        <button onClick={() => handleAdminAction('delete', u.uid)} style={{ ...btnStyle, background: colors.error }}>{t('manager.action.delete')}</button>
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
            <div style={{ padding: 20, textAlign: 'center', color: colors.textSecondary }}>Không có yêu cầu nào.</div>
          ) : (
            isMobile ? (
              /* Mobile View: Render each role request as a flat card to fit perfectly with the page */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {requests.map(req => (
                  <div 
                    key={req.id} 
                    style={{ 
                      background: colors.surface, 
                      border: `1px solid ${colors.border}`, 
                      borderRadius: 12, 
                      padding: 16,
                      boxShadow: '0 2px 8px rgba(70, 110, 115, 0.05)'
                    }}
                  >
                    <div style={{ fontWeight: 700, color: colors.primary, fontSize: 16, marginBottom: 8 }}>{req.name}</div>
                    
                    <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 6, wordBreak: 'break-all' }}>
                      <strong>Email:</strong> {req.email}
                    </div>
                    
                    <div style={{ fontSize: 13, color: colors.textPrimary, marginBottom: 6 }}>
                      <strong>Quyền hiện tại:</strong> <span style={{ textDecoration: 'line-through', color: colors.textSecondary, marginLeft: 6 }}>{req.currentRole}</span>
                    </div>

                    <div style={{ fontSize: 13, color: colors.textPrimary, marginBottom: 12 }}>
                      <strong>Quyền muốn đổi:</strong> <span style={{ background: colors.primaryLight, color: colors.primaryDark, padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700, marginLeft: 6 }}>{req.requestedRole}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: `1px solid ${colors.border}`, paddingTop: 10 }}>
                      <button onClick={() => handleAdminAction('rejectRoleRequest', req.uid, { requestId: req.id })} style={{ ...btnStyle, background: colors.error, padding: '6px 14px' }}>{t('manager.action.reject')}</button>
                      <button onClick={() => handleAdminAction('approveRoleRequest', req.uid, { requestId: req.id, newRole: req.requestedRole })} style={{ ...btnStyle, background: colors.success, padding: '6px 14px' }}>{t('manager.action.approve')}</button>
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
                      <td style={tdStyle}>{req.name} <br/><span style={{ color: colors.textSecondary, fontSize: 12 }}>{req.email}</span></td>
                      <td style={tdStyle}>{req.currentRole}</td>
                      <td style={tdStyle}><strong style={{ color: colors.primary }}>{req.requestedRole}</strong></td>
                      <td style={tdStyle}>
                        <button onClick={() => handleAdminAction('approveRoleRequest', req.uid, { requestId: req.id, newRole: req.requestedRole })} style={{ ...btnStyle, background: colors.success }}>{t('manager.action.approve')}</button>
                        <button onClick={() => handleAdminAction('rejectRoleRequest', req.uid, { requestId: req.id })} style={{ ...btnStyle, background: colors.error }}>{t('manager.action.reject')}</button>
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
        <form onSubmit={handleSaveAIConfig} style={{ background: colors.backgroundLight, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 24, marginTop: 10 }}>
          <h3 style={{ marginTop: 0, color: colors.primary, borderBottom: `1px solid ${colors.border}`, paddingBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            🔑 Cấu hình Dịch vụ AI (Spellcheck)
          </h3>
          
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 6, fontSize: 14, color: colors.textPrimary }}>
              Nhà cung cấp dịch vụ AI:
            </label>
            <select 
              value={aiProvider} 
              onChange={e => {
                const prov = e.target.value;
                setAiProvider(prov);
                setAiModel(prov === 'google' ? 'gemini-2.5-flash' : 'gpt-4o-mini');
              }} 
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${colors.border}`, boxSizing: 'border-box', background: colors.surface }}
            >
              <option value="google">Google Gemini</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 6, fontSize: 14, color: colors.textPrimary }}>
              Mô hình AI sử dụng:
            </label>
            <select 
              value={aiModel} 
              onChange={e => setAiModel(e.target.value)} 
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${colors.border}`, boxSizing: 'border-box', background: colors.surface }}
            >
              {aiProvider === 'google' ? (
                <>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Khuyên dùng)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
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
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 6, fontSize: 14, color: colors.textPrimary }}>
              API Key cá nhân:
            </label>
            <input 
              type="password" 
              value={apiKey} 
              onChange={e => setApiKey(e.target.value)}
              placeholder={hasSavedKey ? "••••••••••••••••" : "Nhập API Key để kích hoạt kết nối trực tiếp..."}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${colors.border}`, boxSizing: 'border-box' }}
            />
            {hasSavedKey && (
              <p style={{ margin: '5px 0 0', fontSize: 12, color: colors.success, fontWeight: 600 }}>
                ✓ Hệ thống đã lưu trữ và bảo mật API Key của bạn. Bạn vẫn có thể ghi đè khóa mới nếu cần.
              </p>
            )}
            {!hasSavedKey && (
              <p style={{ margin: '5px 0 0', fontSize: 12, color: colors.textSecondary }}>
                * Nếu không có API Key, tính năng tự sửa lỗi chính tả sẽ tự động chuyển tiếp qua Cloud Function fallback.
              </p>
            )}
          </div>

          {saveStatus && (
            <div style={{ 
              marginBottom: 18, 
              padding: '8px 12px', 
              borderRadius: 6, 
              background: saveStatus.includes('thành công') ? alpha('success', 0.12) : alpha('warning', 0.12),
              color: saveStatus.includes('thành công') ? colors.success : colors.warning,
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
                  if (await askConfirm("Bạn có chắc chắn muốn XÓA API Key đã lưu?", "Xác nhận xóa API Key")) {
                    setApiKey('');
                    setHasSavedKey(false);
                    setSaveStatus('Chưa lưu thay đổi.');
                  }
                }}
                style={{ padding: '10px 20px', borderRadius: 8, border: `1.5px solid ${colors.error}`, background: 'transparent', color: colors.error, cursor: 'pointer', fontWeight: 600 }}
              >
                Xóa Key cũ
              </button>
            )}
            <button 
              type="submit" 
              disabled={isSavingKey} 
              style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: colors.primary, color: colors.white, fontWeight: 'bold', cursor: 'pointer', opacity: isSavingKey ? 0.6 : 1 }}
            >
              {isSavingKey ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          </div>
        </form>
      )}

      {/* Tab: HUẤN LUYỆN CHATBOT */}
      {!loading && activeTab === 'train' && (
        <div style={{ background: colors.backgroundLight, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 24, marginTop: 10 }}>
          <h3 style={{ marginTop: 0, color: colors.primary, borderBottom: `1px solid ${colors.border}`, paddingBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            🤖 Huấn luyện & Thiết lập Chatbot
          </h3>

          {/* Section: System Prompt */}
          <form onSubmit={handleSaveSystemInstruction} style={{ marginBottom: 30 }}>
            <h4 style={{ margin: '0 0 10px 0', color: colors.textPrimary, fontSize: 15, fontWeight: 700 }}>
              1. Chỉ dẫn hệ thống & Phong cách phản hồi (System Instructions)
            </h4>
            <div style={{ marginBottom: 12 }}>
              <textarea 
                value={systemInstruction} 
                onChange={e => setSystemInstruction(e.target.value)}
                placeholder="Nhập các quy định, tài liệu nội bộ, thông tin hướng dẫn nghiệp vụ hoặc phong cách xưng hô cho Chatbot tại đây... (Ví dụ: 'Bạn là trợ lý EHS của nhà máy SafeOne. Hãy trả lời lịch sự bằng tiếng Việt. Khi trả lời về gemba thì...')"
                rows={6}
                style={{ width: '100%', padding: '12px', borderRadius: 8, border: `1px solid ${colors.border}`, boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 14 }}
              />
              <p style={{ margin: '5px 0 0', fontSize: 12, color: colors.textSecondary }}>
                * Chỉ dẫn hệ thống giúp định hình tính cách, vai trò và phạm vi trả lời của AI trợ lý.
              </p>
            </div>

            {saveStatus && (
              <div style={{ 
                marginBottom: 12, 
                padding: '8px 12px', 
                borderRadius: 6, 
                background: saveStatus.includes('thành công') ? alpha('success', 0.12) : alpha('warning', 0.12),
                color: saveStatus.includes('thành công') ? colors.success : colors.warning,
                fontSize: 13,
                fontWeight: 600
              }}>
                {saveStatus}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                type="submit" 
                disabled={isSavingKey} 
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: colors.primary, color: colors.white, fontWeight: 'bold', cursor: 'pointer', opacity: isSavingKey ? 0.6 : 1 }}
              >
                {isSavingKey ? 'Đang lưu...' : 'Lưu chỉ dẫn hệ thống'}
              </button>
            </div>
          </form>

          <hr style={{ border: 'none', borderTop: `1px solid ${colors.border}`, margin: '24px 0' }} />

          {/* Section: Manage Chatbot Documents */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', margin: '0 0 8px 0' }}>
              <h4 style={{ margin: 0, color: colors.textPrimary, fontSize: 15, fontWeight: 700 }}>
                2. Quản lý tài liệu huấn luyện AI hiện tại
              </h4>
            </div>
            <p style={{ margin: '0 0 16px 0', fontSize: 13, color: colors.textSecondary }}>
              Bật/tắt trạng thái "Huấn luyện AI" cho các tài liệu (MSDS, SOP, Quy trình, Biểu mẫu) để Chatbot tự động nạp tri thức từ tài liệu đó. Để tải lên tài liệu mới, vui lòng vào tab <strong>Tài liệu</strong>.
              <br />
              <span style={{ color: colors.textSecondary }}>* Chatbot chỉ gửi vài đoạn liên quan nhất tới AI mỗi câu hỏi (RAG) để tiết kiệm token.</span>
            </p>

            {/* List of Documents */}
            <div style={{ overflowX: 'auto', border: `1px solid ${colors.border}`, borderRadius: 8, background: colors.surface }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: colors.backgroundLight, borderBottom: `1px solid ${colors.border}` }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 'bold' }}>Tên tài liệu</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 'bold', width: 120 }}>Phân loại</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 'bold', width: 120 }}>Huấn luyện AI</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 'bold', width: 140 }}>Nội dung Markdown</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 'bold', width: 140 }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {aiDocuments.map((docItem) => (
                    <tr key={docItem.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <td style={{ padding: '10px 12px', color: colors.textPrimary, fontWeight: 600, wordBreak: 'break-all' }}>
                        📄 {docItem.title}
                      </td>
                      <td style={{ padding: '10px 12px', color: colors.textSecondary, textTransform: 'uppercase' }}>
                        {docItem.type}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={docItem.isAITrained || false}
                          onChange={async (e) => {
                            const newStatus = e.target.checked;
                            try {
                              await dbService.updateDoc('documents', docItem.id, { isAITrained: newStatus });

                              // Cập nhật state local
                              setAiDocuments(prev => prev.map(d => d.id === docItem.id ? { ...d, isAITrained: newStatus } : d));
                              pushToast(`Đã ${newStatus ? 'bật' : 'tắt'} huấn luyện AI cho tài liệu`, 'success');

                              // Đồng bộ embedding: tắt -> xóa chunk; bật -> tạo chunk từ markdown,
                              // nếu chưa có markdown thì trích xuất (sẽ tự tạo chunk sau đó).
                              try {
                                const syncRes = await apiClient.post('/api/functions/syncDocChunks', { docId: docItem.id, enabled: newStatus });
                                if (newStatus && syncRes.data?.needsExtract) {
                                  triggerExtractMarkdown(docItem);
                                }
                              } catch (syncErr) {
                                console.error('Lỗi đồng bộ embedding tài liệu:', syncErr);
                              }
                            } catch (err) {
                              console.error(err);
                              pushToast('Lỗi khi cập nhật trạng thái huấn luyện', 'error');
                            }
                          }}
                          style={{ width: 18, height: 18, cursor: 'pointer', accentColor: colors.primary }}
                        />
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {docItem.markdownContent ? (
                          <span style={{ color: colors.success, fontWeight: 600, fontSize: 12, background: alpha('success', 0.12), padding: '2px 8px', borderRadius: 12 }}>
                            ✓ Đã trích xuất
                          </span>
                        ) : (
                          <span style={{ color: colors.error, fontWeight: 600, fontSize: 12, background: alpha('error', 0.12), padding: '2px 8px', borderRadius: 12 }}>
                            ✗ Chưa có
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            onClick={() => {
                              if (docItem.markdownContent) {
                                setViewingDoc({
                                  name: docItem.title,
                                  size: docItem.markdownContent.length,
                                  content: docItem.markdownContent
                                });
                              } else {
                                pushToast("Tài liệu chưa được trích xuất nội dung văn bản", "warning");
                              }
                            }}
                            disabled={!docItem.markdownContent}
                            style={{
                              padding: '4px 10px',
                              background: docItem.markdownContent ? colors.info : colors.border,
                              color: colors.white,
                              border: 'none',
                              borderRadius: 4,
                              cursor: docItem.markdownContent ? 'pointer' : 'not-allowed',
                              fontSize: 12,
                              fontWeight: 600
                            }}
                          >
                            👁️ Xem MD
                          </button>
                          
                          {docItem.isAITrained && !docItem.markdownContent && (
                            <button
                              onClick={() => triggerExtractMarkdown(docItem)}
                              style={{
                                padding: '4px 10px',
                                background: colors.primary,
                                color: colors.white,
                                border: 'none',
                                borderRadius: 4,
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 600
                              }}
                              title="Trích xuất nội dung AI"
                            >
                              🤖 AI
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      {createAccountModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: colors.surface, padding: 24, borderRadius: 12, width: '90%', maxWidth: 400 }}>
            <h3>Tạo tài khoản mới</h3>
            
            <p style={{ margin: '10px 0 5px', fontSize: 14, fontWeight: 'bold' }}>Tên hiển thị:</p>
            <input type="text" value={newAccountData.name} onChange={e => setNewAccountData({...newAccountData, name: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: `1px solid ${colors.border}`, boxSizing: 'border-box' }} placeholder="Nhập tên..." />
            
            <p style={{ margin: '10px 0 5px', fontSize: 14, fontWeight: 'bold' }}>Email:</p>
            <input type="email" value={newAccountData.email} onChange={e => setNewAccountData({...newAccountData, email: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: `1px solid ${colors.border}`, boxSizing: 'border-box' }} placeholder="user@example.com" />
            
            <p style={{ margin: '10px 0 5px', fontSize: 14, fontWeight: 'bold' }}>Mật khẩu (≥ 6 ký tự):</p>
            <input type="text" value={newAccountData.password} onChange={e => setNewAccountData({...newAccountData, password: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: `1px solid ${colors.border}`, boxSizing: 'border-box' }} placeholder="Mật khẩu..." />
            
            <p style={{ margin: '10px 0 5px', fontSize: 14, fontWeight: 'bold' }}>Chức vụ:</p>
            <select value={newAccountData.role} onChange={e => setNewAccountData({...newAccountData, role: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: `1px solid ${colors.border}`, boxSizing: 'border-box' }}>
              {ALL_ROLES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
              <option value="Khác (Tạo mới)">Khác (Tạo mới)</option>
            </select>
            
            {newAccountData.role === 'Khác (Tạo mới)' && (
              <div style={{ marginTop: 10 }}>
                <input type="text" value={newAccountData.customRole} onChange={e => setNewAccountData({...newAccountData, customRole: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 6, border: `1px solid ${colors.border}`, boxSizing: 'border-box' }} placeholder="Nhập tên chức vụ mới..." />
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
                style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: colors.primary, color: colors.white, fontWeight: 'bold', cursor: 'pointer' }}
              >
                Tạo
              </button>
            </div>
          </div>
        </div>
      )}
      {renameModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: colors.surface, padding: 24, borderRadius: 12, width: '90%', maxWidth: 400 }}>
            <h3 style={{ marginTop: 0 }}>Đổi tên người dùng</h3>
            <p style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 12 }}>Nhập tên mới cho tài khoản email <strong>{users.find(u => u.uid === renameModal.uid)?.email}</strong>:</p>
            <input 
              type="text" 
              value={newName} 
              onChange={e => setNewName(e.target.value)} 
              style={{ width: '100%', padding: 10, borderRadius: 6, border: `1px solid ${colors.border}`, marginBottom: 20, boxSizing: 'border-box' }} 
              placeholder="Tên mới..."
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setRenameModal(null)} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: colors.border, cursor: 'pointer' }}>Hủy</button>
              <button 
                onClick={() => handleAdminAction('changeName', renameModal.uid, { newName })} 
                disabled={!newName.trim() || newName === renameModal.currentName} 
                style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: colors.primary, color: colors.white, fontWeight: 'bold', cursor: 'pointer', opacity: (!newName.trim() || newName === renameModal.currentName) ? 0.5 : 1 }}
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
      {resetPassModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: colors.surface, padding: 24, borderRadius: 12, width: '90%', maxWidth: 400 }}>
            <h3>Đặt lại mật khẩu</h3>
            <p>Nhập mật khẩu mới (ít nhất 6 ký tự):</p>
            <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: `1px solid ${colors.border}`, marginBottom: 20, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setResetPassModal(null)} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Hủy</button>
              <button onClick={() => handleAdminAction('resetPassword', resetPassModal, { newPassword })} disabled={newPassword.length < 6} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: colors.primary, color: colors.white, fontWeight: 'bold', cursor: 'pointer' }}>Lưu</button>
            </div>
          </div>
        </div>
      )}

      {roleModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: colors.surface, padding: 24, borderRadius: 12, width: '90%', maxWidth: 440 }}>
            <h3 style={{ marginTop: 0 }}>Đổi chức vụ</h3>
            <p style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>Chọn một hoặc nhiều chức vụ cho người dùng này:</p>
            <div style={{ maxHeight: 320, overflowY: 'auto', border: `1px solid ${colors.border}`, borderRadius: 8, padding: '8px 0' }}>
              {ALL_ROLES.map(r => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', cursor: 'pointer', borderBottom: `1px solid ${colors.border}`, background: selectedRoles.includes(r) ? alpha('primary', 0.08) : colors.surface }}>
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(r)}
                    onChange={e => {
                      if (e.target.checked) setSelectedRoles(prev => [...prev, r]);
                      else setSelectedRoles(prev => prev.filter(x => x !== r));
                    }}
                    style={{ width: 16, height: 16, accentColor: colors.primary, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 14, color: selectedRoles.includes(r) ? colors.primary : colors.textPrimary, fontWeight: selectedRoles.includes(r) ? 700 : 400 }}>{r}</span>
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
                onClick={() => handleAdminAction('changeRole', roleModal.uid, { newRole: selectedRoles })}
                disabled={selectedRoles.length === 0}
                style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: colors.primary, color: colors.white, fontWeight: 'bold', cursor: 'pointer', opacity: selectedRoles.length === 0 ? 0.5 : 1 }}
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xem Tài Liệu Huấn Luyện */}
      {viewingDoc && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: colors.surface, padding: 24, borderRadius: 12, width: '90%', maxWidth: 700, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginTop: 0, borderBottom: `1px solid ${colors.border}`, paddingBottom: 10, color: colors.primary, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>👁️ Chi tiết tài liệu: {viewingDoc.name}</span>
              <span style={{ fontSize: 13, color: colors.textSecondary }}>({formatFileSize(viewingDoc.size)})</span>
            </h3>
            <div style={{ flex: 1, overflowY: 'auto', background: colors.backgroundLight, padding: 16, borderRadius: 8, fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap', border: `1px solid ${colors.border}`, margin: '12px 0' }}>
              {viewingDoc.content}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setViewingDoc(null)} 
                style={{ padding: '8px 20px', border: 'none', borderRadius: 6, background: colors.primary, color: colors.white, fontWeight: 'bold', cursor: 'pointer' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
