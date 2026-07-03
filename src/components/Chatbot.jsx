// src/components/Chatbot.jsx
import React, { useState, useEffect, useRef } from 'react';
import './Chatbot.css';
import chatIcon from '../assets/favicon.png'; // <-- 1. Import icon
import { useI18n } from '../i18n/I18nProvider';
import { callAIService } from '../utils/aiAdapter';
import dbService from '../services/dbService';

import { normalizeRole } from '../utils/string';
import { parseMarkdown } from '../utils/markdown';

function Chatbot({ user }) {
    const { t } = useI18n();
    // 2. Thêm state để quản lý trạng thái đóng/mở
    const [isOpen, setIsOpen] = useState(false);

    const [messages, setMessages] = useState([{ text: t("chatbot.welcome"), type: 'ai' }]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatBodyRef = useRef(null);

    const [sopDocs, setSopDocs] = useState([]);
    const [msdsDocs, setMsdsDocs] = useState([]);
    const allDocs = [...sopDocs, ...msdsDocs];

    useEffect(() => {
        if (!user) {
            setSopDocs([]);
            setMsdsDocs([]);
            return;
        }
        const userRoles = user?.role ? (Array.isArray(user.role) ? user.role.map(normalizeRole) : String(user.role).split(',').map(normalizeRole)) : [];
        const canViewMSDS = userRoles.some(r => ["admin", "ehs", "manager"].includes(r));
        const canViewSOP = userRoles.some(r => ["admin", "ehs", "ehs committee", "trainer", "manager"].includes(r));

        const fetchDocs = async () => {
            try {
                const list = await dbService.getDocs("documents");
                if (!Array.isArray(list)) return;

                if (canViewSOP) {
                    const sops = list.filter(d => ["sop", "quytrinh", "bieumau"].includes(d.type));
                    setSopDocs(sops);
                } else {
                    setSopDocs([]);
                }

                if (canViewMSDS) {
                    const msds = list.filter(d => d.type === "msds");
                    setMsdsDocs(msds);
                } else {
                    setMsdsDocs([]);
                }
            } catch (error) {
                console.error("Lỗi tải tài liệu cho chatbot:", error);
            }
        };

        fetchDocs();
    }, [user]);

    // Tự động cuộn xuống khi có tin nhắn mới
    useEffect(() => {
        if (chatBodyRef.current) {
            chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
    }, [messages]);
    const CLOUD_FUNCTION_URL = import.meta.env.VITE_ASKAI_URL || '/api/functions/askAI';
    const getDocAccess = (docItem, currentUser) => {
        const userRoles = currentUser?.role ? (Array.isArray(currentUser.role) ? currentUser.role.map(normalizeRole) : String(currentUser.role).split(',').map(normalizeRole)) : [];
        const canView = userRoles.some(r => ["admin", "ehs", "ehs committee", "trainer", "manager"].includes(r));
        const canViewMSDS = userRoles.some(r => ["admin", "ehs", "manager"].includes(r));

        if (!canView) {
            return { hasAccess: false, reason: "Tài khoản của bạn không có quyền truy cập hệ thống tài liệu. Yêu cầu các vai trò như Admin, EHS, EHS Committee, Trainer hoặc Manager." };
        }

        if (docItem.type === "msds" && !canViewMSDS) {
            return { hasAccess: false, reason: "Tài liệu thuộc danh mục MSDS yêu cầu quyền truy cập của Admin, EHS hoặc Manager. Vai trò hiện tại của bạn không được phép xem tài liệu này." };
        }

        return { hasAccess: true };
    };

    const constructDocContext = (promptText) => {
        const userRoleName = user?.role || "Khách";
        const queryLower = (promptText || "").toLowerCase();
        
        // Kiểm tra xem câu hỏi của người dùng có thực sự cần liệt kê danh mục tài liệu không
        const isAskingForList = queryLower.includes("danh sách") || 
                               queryLower.includes("liệt kê") || 
                               queryLower.includes("có những tài liệu") ||
                               queryLower.includes("tài liệu gì") ||
                               queryLower.includes("danh mục");

        if (!isAskingForList) {
            // Không hỏi về danh mục tài liệu -> không gửi danh sách tài liệu EHS để tiết kiệm token
            return `=== VAI TRÒ & QUYỀN TRUY CẬP CỦA NGƯỜI DÙNG ===
Người dùng hiện tại: ${user?.name || "Khách"}
Vai trò: ${userRoleName}

NGUYÊN TẮC: Chỉ cung cấp liên kết tài liệu gốc khi tài liệu đó được truy xuất trong Context của hệ thống và trạng thái quyền hạn là được phép truy cập. Không tự ý bịa đặt liên kết.`;
        }

        // Thực sự hỏi danh mục tài liệu -> cung cấp danh sách tài liệu EHS dạng siêu thu gọn để tiết kiệm tối đa token
        let context = `=== VAI TRÒ & QUYỀN TRUY CẬP CỦA NGƯỜI DÙNG ===
Người dùng hiện tại: ${user?.name || "Khách"}
Vai trò: ${userRoleName}

=== DANH SÁCH TÀI LIỆU EHS TRONG HỆ THỐNG ===
Bao gồm tên tài liệu, danh mục và trạng thái quyền truy cập của người dùng. Hãy trả lời dựa trên danh sách này:
`;

        allDocs.forEach((docItem, i) => {
            const access = getDocAccess(docItem, user);
            context += `\n[Tài liệu ${i + 1}]: ${docItem.title} (${docItem.type.toUpperCase()}) - ${access.hasAccess ? "ĐƯỢC TRUY CẬP" : "BỊ TỪ CHỐI"}`;
        });

        context += `\n\nNếu người dùng hỏi xin link của tài liệu được phép truy cập, hãy cung cấp liên kết dạng [Tên tài liệu](URL) tương ứng với tài liệu đó từ Context hệ thống.`;
        return context;
    };

    const handleSendMessage = async () => {
        if (inputValue.trim() === '' || isLoading) return;

        const currentInput = inputValue; // Sao lưu input hiện tại
        const newMessages = [...messages, { text: currentInput, type: 'user' }];
        setMessages(newMessages);
        setInputValue('');
        setIsLoading(true);

        const history = messages.map(msg => ({
            role: msg.type === 'ai' ? 'model' : 'user',
            parts: [{ text: msg.text }],
        }));

        try {
            const additionalContext = constructDocContext(currentInput);
            const data = await callAIService(currentInput, history, CLOUD_FUNCTION_URL, additionalContext);
            
            // Lưu tin nhắn AI cùng thông tin file đính kèm
            setMessages(prev => [...prev, { 
                text: data.response, 
                type: 'ai',
                fileUrl: data.file_url,
                docTitle: data.doc_title
            }]);

            // Tự động mở / tải tài liệu nếu người dùng yêu cầu (gửi, tải, mở, xem, download, get, send...)
            if (data.file_url) {
                const lowerInput = currentInput.toLowerCase();
                const triggerWords = ["gửi", "tải", "tải về", "mở", "xem", "download", "get", "send", "show"];
                const isRequestingFile = triggerWords.some(word => lowerInput.includes(word));
                if (isRequestingFile) {
                    window.open(data.file_url, "_blank");
                }
            }
        } catch (error) {
            console.error('Error:', error);
            setMessages(prev => [...prev, { text: t("chatbot.error"), type: 'ai' }]);
        } finally {
            setIsLoading(false);
        }
    };

    // 3. Hàm để bật/tắt cửa sổ chat
    const toggleChat = () => {
        setIsOpen(!isOpen);
    };

    return (
        <>
            {/* 4. Chỉ hiển thị cửa sổ chat khi isOpen là true */}
            {isOpen && (
                <div id="chat-widget">
                    <div id="chat-header">
                        <h2>{t("chatbot.title")}</h2>
                        {/* Thêm nút đóng cửa sổ chat */}
                        <button className="close-btn" onClick={toggleChat}>×</button>
                    </div>
                    <div id="chat-body" ref={chatBodyRef}>
                        {messages.map((msg, index) => (
                            <div key={index} className={`message ${msg.type}`}>
                                {msg.type === 'ai' ? parseMarkdown(msg.text) : msg.text}
                                
                                {/* Render thẻ tải về tài liệu đính kèm cho câu trả lời của AI */}
                                {msg.type === 'ai' && msg.fileUrl && (
                                    <div className="chat-file-attachment">
                                        <div className="file-info">
                                            <span className="file-icon">📄</span>
                                            <span className="file-name" title={msg.docTitle}>{msg.docTitle || "Tài liệu đính kèm"}</span>
                                        </div>
                                        <a 
                                            href={msg.fileUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="file-download-btn"
                                        >
                                            Tải về / Xem
                                        </a>
                                    </div>
                                )}
                            </div>
                        ))}
                        {isLoading && <div className="message loading"><span></span><span></span><span></span></div>}
                    </div>
                    <div id="chat-footer">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder={t("chatbot.placeholder")}
                        />
                        <button onClick={handleSendMessage}>{t("common.send")}</button>
                    </div>
                </div>
            )}

            {/* 5. Icon nổi luôn hiển thị */}
            <button id="chat-icon-button" onClick={toggleChat}>
                <img src={chatIcon} alt="Chat Icon" />
            </button>
        </>
    );
}

export default Chatbot;