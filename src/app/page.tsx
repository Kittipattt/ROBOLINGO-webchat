'use client';

import React, { useState, useRef, useEffect } from 'react';
import { TopNavbar } from '@/components/TopNavbar';
import { Sidebar } from '@/components/Sidebar';
import { ChatCanvas } from '@/components/ChatCanvas';
import { CustomerDetailDrawer } from '@/components/CustomerDetailDrawer';
import { QrCodeModal } from '@/components/QrCodeModal';
import { DeleteChatModal } from '@/components/DeleteChatModal';
import { QuickRepliesModal } from '@/components/QuickRepliesModal';

import { useNotificationSound } from '@/hooks/useNotificationSound';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useWebChatUsers } from '@/hooks/useWebChatUsers';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useQuickReplies } from '@/hooks/useQuickReplies';
import { useTheme } from '@/hooks/useTheme';

/**
 * Main WebChat Application View
 * Cleanly orchestrates specialized domain hooks with presentation components.
 */
export default function WebChatPage() {
  // 0. Theme Mode Hook
  const { theme, toggleTheme } = useTheme();

  // 1. Audio and Keyboard Shortcuts
  const { soundEnabled, toggleSound, playNotificationSound } = useNotificationSound(true);
  const { searchInputRef } = useKeyboardShortcuts();

  // 2. Users Domain Hook
  const {
    users,
    selectedUser,
    selectedUserId,
    isRefreshing,
    fetchUsers,
    selectUser,
    updateUserLastMessage,
    resetUserLastMessage,
    deleteUserConversation,
  } = useWebChatUsers();

  // 3. Chat Messages Domain Hook (Single instance with active user selection)
  const {
    activeMessages,
    isSending,
    sendMessage,
    clearUserMessages,
    removeUserMessagesLocally,
    syncIncomingUserMessage,
  } = useChatMessages({
    selectedUserId,
    onNewMessageSound: playNotificationSound,
    onMessageSyncedToUser: updateUserLastMessage,
  });

  // Automatically sync incoming message from users poll into chat history
  useEffect(() => {
    users.forEach((u) => {
      if (u.lastMessage && u.lastMessageAt) {
        syncIncomingUserMessage(u.userId, u.lastMessage, u.lastMessageAt);
      }
    });
  }, [users, syncIncomingUserMessage]);

  // 4. Quick Replies Domain Hook
  const {
    quickReplies,
    addQuickReply,
    updateQuickReply,
    deleteQuickReply,
    resetToDefaults,
  } = useQuickReplies();

  // 5. View Presentation State
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'replied'>('all');
  const [showQrModal, setShowQrModal] = useState(false);
  const [showDetailDrawer, setShowDetailDrawer] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showQuickRepliesModal, setShowQuickRepliesModal] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages]);

  // Handle message sending
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSending) return;

    setInputText('');
    setShowEmojiPicker(false);
    await sendMessage(text);
    textareaRef.current?.focus();
  };

  // Copy User ID with visual feedback
  const handleCopyUserId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Clear messages handler
  const handleClearMessages = async (userId: string) => {
    await clearUserMessages(userId);
    resetUserLastMessage(userId);
  };

  // Delete entire conversation handler
  const handleDeleteConversation = async (userId: string) => {
    removeUserMessagesLocally(userId);
    await deleteUserConversation(userId);
  };

  return (
    <div className="app-container">
      <TopNavbar
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        theme={theme}
        onToggleTheme={toggleTheme}
        isRefreshing={isRefreshing}
        onRefresh={() => fetchUsers()}
        onOpenQrModal={() => setShowQrModal(true)}
      />

      <div className="workspace-grid">
        <Sidebar
          users={users}
          selectedUser={selectedUser}
          onSelectUser={selectUser}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchInputRef={searchInputRef}
        />

        <ChatCanvas
          selectedUser={selectedUser}
          messages={activeMessages}
          onCopyUserId={handleCopyUserId}
          copiedId={copiedId}
          showDetailDrawer={showDetailDrawer}
          onToggleDetailDrawer={() => setShowDetailDrawer(!showDetailDrawer)}
          inputText={inputText}
          onInputChange={setInputText}
          onSendMessage={handleSendMessage}
          isSending={isSending}
          showEmojiPicker={showEmojiPicker}
          onToggleEmojiPicker={() => setShowEmojiPicker(!showEmojiPicker)}
          onInsertEmoji={(em) => setInputText((prev) => prev + em)}
          messagesEndRef={messagesEndRef}
          textareaRef={textareaRef}
          onOpenQrModal={() => setShowQrModal(true)}
          onOpenDeleteModal={() => setShowDeleteModal(true)}
          quickReplies={quickReplies}
          onOpenQuickRepliesModal={() => setShowQuickRepliesModal(true)}
        />

        {selectedUser && showDetailDrawer && (
          <CustomerDetailDrawer
            selectedUser={selectedUser}
            messageCount={activeMessages.length}
            onClose={() => setShowDetailDrawer(false)}
            copiedId={copiedId}
            onCopyUserId={handleCopyUserId}
            onOpenDeleteModal={() => setShowDeleteModal(true)}
          />
        )}
      </div>

      <QrCodeModal isOpen={showQrModal} onClose={() => setShowQrModal(false)} />

      <DeleteChatModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        targetUser={selectedUser}
        messageCount={activeMessages.length}
        onClearMessages={handleClearMessages}
        onDeleteConversation={handleDeleteConversation}
      />

      <QuickRepliesModal
        isOpen={showQuickRepliesModal}
        onClose={() => setShowQuickRepliesModal(false)}
        quickReplies={quickReplies}
        onAddReply={addQuickReply}
        onUpdateReply={updateQuickReply}
        onDeleteReply={deleteQuickReply}
        onResetDefaults={resetToDefaults}
      />
    </div>
  );
}
