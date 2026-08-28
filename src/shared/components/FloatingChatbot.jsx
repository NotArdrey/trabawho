import { useEffect, useMemo, useRef, useState } from 'react';
import { BotMessageSquare, Loader2, Paperclip, RotateCcw, Send, X } from 'lucide-react';
import { sendChatbotMessage } from '../services/chatbotService';
import { startServiceConversationByServiceId } from '../../features/bookings/services/bookingService';

const MAX_IMAGE_BYTES = 2_900_000;
const PHOTO_HELP_PROMPT = 'Please identify the problem in this photo, estimate the likely budget, and find a qualified TrabaWho worker.';
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const WELCOME_MESSAGE = 'Hi! I can help you browse services, understand bookings, set up seller tools, or find the right next step in TrabaWho.';
const CHATBOT_SIZE_STORAGE_KEY = 'trabawho-chatbot-size';
const CHATBOT_DEFAULT_SIZE = { width: 430, height: 680 };
const CHATBOT_MIN_SIZE = { width: 320, height: 380 };
const CHATBOT_RESIZE_HANDLES = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'];
const CHATBOT_RESIZE_CURSOR = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};

const createWelcomeMessage = () => ({
  id: 'assistant-welcome',
  role: 'assistant',
  content: WELCOME_MESSAGE,
});

const createMessage = (role, content, extras = {}) => ({
  id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  role,
  content,
  ...extras,
});

const DEFAULT_QUICK_PROMPTS = [
  'Search prices',
  'Find services',
  'Booking help',
];

const QUICK_PROMPTS_BY_VIEW = {
  'client-dashboard': ['Find services', 'Book a provider', 'Search prices'],
  'browse-services': ['Estimate from photo', 'Compare providers', 'Ask for a quote'],
  'my-bookings': ['Reschedule booking', 'Payment status', 'Request refund'],
  'my-work': ['Add service slots', 'Update payment options', 'Handle quotes'],
  'worker-dashboard': ['Improve listing', 'Manage schedule', 'Payment setup'],
  profile: ['Update profile', 'Change location', 'Account privacy'],
  'account-settings': ['Change password', 'Identity verification', 'Privacy settings'],
  settings: ['Change theme', 'Language settings', 'Notification settings'],
};

const LOCAL_SHORTCUT_REPLIES = {
  hi: 'Hi. What would you like to do in TrabaWho: find a service, check a booking, or set up seller tools?',
  hello: 'Hi. What would you like to do in TrabaWho: find a service, check a booking, or set up seller tools?',
  hey: 'Hi. What would you like to do in TrabaWho: find a service, check a booking, or set up seller tools?',
  help: 'I can help with services, bookings, seller setup, quotes, payments, refunds, profiles, or settings. What are you trying to do right now?',
  qr: 'Do you mean a seller payment QR, identity verification, or a booking payment step?',
  id: 'Do you mean identity verification, your profile details, or an account issue?',
  ok: 'Got it. What would you like to do next in TrabaWho?',
};

const LOW_CONFIDENCE_REPLIES_BY_VIEW = {
  'browse-services': 'I did not catch that yet. Are you trying to search providers, compare a service, or start a booking?',
  'my-bookings': 'I did not catch that yet. Are you checking a booking, rescheduling, paying, or asking about a refund?',
  'my-work': 'I did not catch that yet. Are you updating services, editing slots, handling quotes, or setting payment options?',
  'worker-dashboard': 'I did not catch that yet. Are you improving your listing, checking work, or managing your schedule?',
  profile: 'I did not catch that yet. Are you updating profile details, location, privacy, or account information?',
  'account-settings': 'I did not catch that yet. Are you changing your password, privacy settings, or identity verification details?',
  settings: 'I did not catch that yet. Are you changing theme, language, or notification preferences?',
};

const DEFAULT_LOW_CONFIDENCE_REPLY = 'I did not catch that yet. Are you trying to find a service, check a booking, manage seller work, or handle payments?';

const normalizeSignal = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const isLowConfidenceInput = (value) => {
  const cleanValue = String(value || '').trim();
  const compactValue = normalizeSignal(cleanValue);

  if (!compactValue || LOCAL_SHORTCUT_REPLIES[compactValue]) return false;
  if (compactValue.length <= 2) return true;
  if (compactValue.length <= 4 && /^([a-z0-9])\1+$/.test(compactValue)) return true;

  return false;
};

const getLocalAssistantReply = (input, context) => {
  const compactValue = normalizeSignal(input);

  if (LOCAL_SHORTCUT_REPLIES[compactValue]) {
    return LOCAL_SHORTCUT_REPLIES[compactValue];
  }

  if (!isLowConfidenceInput(input)) {
    return '';
  }

  return LOW_CONFIDENCE_REPLIES_BY_VIEW[context?.currentView] || DEFAULT_LOW_CONFIDENCE_REPLY;
};

const getQuickPrompts = (currentView, role) => {
  const viewPrompts = QUICK_PROMPTS_BY_VIEW[currentView] || DEFAULT_QUICK_PROMPTS;
  const prompts = role === 'worker' && currentView !== 'my-work' && currentView !== 'worker-dashboard'
    ? [...viewPrompts.slice(0, 2), 'Manage my work']
    : viewPrompts;

  return Array.from(new Set(prompts)).slice(0, 3);
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('Unable to read the selected image.'));
  reader.readAsDataURL(file);
});

const formatCurrency = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return '';

  return `PHP ${new Intl.NumberFormat('en-PH', {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)}`;
};

const formatRange = (low, high) => {
  const lowLabel = formatCurrency(low);
  const highLabel = formatCurrency(high);

  if (lowLabel && highLabel && lowLabel !== highLabel) return `${lowLabel} - ${highLabel}`;
  return lowLabel || highLabel || 'Needs quote';
};

const getMatchQuery = (match = {}) => (
  match.serviceType
  || match.title
  || match.providerName
  || ''
);

const clampNumber = (value, min, max) => Math.min(Math.max(value, min), max);

const getViewportSize = () => ({
  width: typeof window === 'undefined' ? 1366 : window.innerWidth,
  height: typeof window === 'undefined' ? 900 : window.innerHeight,
});

const getChatbotSizeBounds = (isWorkView) => {
  const viewport = getViewportSize();
  const isSmallViewport = viewport.width <= 520;
  const isNarrowViewport = viewport.width <= 880;
  const horizontalPadding = isSmallViewport ? 24 : isNarrowViewport ? 28 : 32;
  const bottomOffset = isNarrowViewport
    ? (isWorkView ? 166 : 92)
    : (isWorkView ? 96 : 24);
  const toggleHeight = isSmallViewport ? 54 : 58;
  const topPadding = isSmallViewport ? 8 : 24;
  const maxWidth = Math.max(280, viewport.width - horizontalPadding);
  const maxHeight = Math.max(340, viewport.height - bottomOffset - toggleHeight - 12 - topPadding);

  return {
    minWidth: Math.min(CHATBOT_MIN_SIZE.width, maxWidth),
    minHeight: Math.min(CHATBOT_MIN_SIZE.height, maxHeight),
    maxWidth,
    maxHeight,
  };
};

const getBoundedChatbotSize = (size, isWorkView) => {
  const bounds = getChatbotSizeBounds(isWorkView);
  return {
    width: clampNumber(Number(size?.width) || CHATBOT_DEFAULT_SIZE.width, bounds.minWidth, bounds.maxWidth),
    height: clampNumber(Number(size?.height) || CHATBOT_DEFAULT_SIZE.height, bounds.minHeight, bounds.maxHeight),
  };
};

const getInitialChatbotSize = (isWorkView) => {
  if (typeof window === 'undefined') return CHATBOT_DEFAULT_SIZE;

  try {
    const storedSize = JSON.parse(window.localStorage.getItem(CHATBOT_SIZE_STORAGE_KEY) || 'null');
    return getBoundedChatbotSize(storedSize || CHATBOT_DEFAULT_SIZE, isWorkView);
  } catch (error) {
    return getBoundedChatbotSize(CHATBOT_DEFAULT_SIZE, isWorkView);
  }
};

const getResizePoint = (event) => {
  const touch = event.touches?.[0] || event.changedTouches?.[0];
  return {
    clientX: touch?.clientX ?? event.clientX,
    clientY: touch?.clientY ?? event.clientY,
  };
};

function FloatingChatbot({
  appTheme = 'light',
  currentView = 'landing',
  isLoggedIn = false,
  role = 'guest',
  isHidden = false,
  onOpenBrowseServices,
  onOpenChatPage,
  onSearchChange,
}) {
  const isWorkView = currentView === 'my-work' || currentView === 'worker-dashboard';
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState(() => [createWelcomeMessage()]);
  const [isSending, setIsSending] = useState(false);
  const [isStartingBookingId, setIsStartingBookingId] = useState('');
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [panelSize, setPanelSize] = useState(() => getInitialChatbotSize(isWorkView));
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const resizeCleanupRef = useRef(null);

  const widgetClassName = [
    'gl-chatbot',
    isOpen ? 'open' : '',
    appTheme === 'dark' ? 'dark' : '',
    isWorkView ? 'work-view' : '',
  ].filter(Boolean).join(' ');

  const panelStyle = useMemo(() => ({
    width: `${panelSize.width}px`,
    height: `${panelSize.height}px`,
  }), [panelSize.height, panelSize.width]);

  const context = useMemo(() => ({
    currentView,
    isLoggedIn,
    role,
  }), [currentView, isLoggedIn, role]);

  const quickPrompts = useMemo(
    () => getQuickPrompts(currentView, role),
    [currentView, role]
  );

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    if (!inputValue.trim()) {
      input.style.height = '';
      return;
    }

    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 116)}px`;
  }, [inputValue, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [isOpen, isSending, messages]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleViewportResize = () => {
      setPanelSize((currentSize) => getBoundedChatbotSize(currentSize, isWorkView));
    };

    window.addEventListener('resize', handleViewportResize);
    return () => window.removeEventListener('resize', handleViewportResize);
  }, [isWorkView]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.localStorage.setItem(CHATBOT_SIZE_STORAGE_KEY, JSON.stringify(panelSize));
  }, [panelSize]);

  useEffect(() => () => {
    resizeCleanupRef.current?.();
  }, []);

  const handleResizeStart = (direction, event) => {
    const isTouchResize = event.type === 'touchstart';
    if (!isTouchResize && event.button !== undefined && event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    resizeCleanupRef.current?.();

    const startPoint = getResizePoint(event);
    const startSize = panelSize;
    const startX = startPoint.clientX;
    const startY = startPoint.clientY;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    const moveEventName = isTouchResize ? 'touchmove' : 'mousemove';
    const endEventName = isTouchResize ? 'touchend' : 'mouseup';
    const cancelEventName = isTouchResize ? 'touchcancel' : 'blur';

    document.body.classList.add('gl-chatbot-resizing');
    document.body.style.cursor = CHATBOT_RESIZE_CURSOR[direction] || 'move';
    document.body.style.userSelect = 'none';

    const handleResizeMove = (moveEvent) => {
      if (moveEvent.cancelable) moveEvent.preventDefault();
      const movePoint = getResizePoint(moveEvent);
      const deltaX = movePoint.clientX - startX;
      const deltaY = movePoint.clientY - startY;
      let nextWidth = startSize.width;
      let nextHeight = startSize.height;

      if (direction.includes('w')) nextWidth = startSize.width - deltaX;
      if (direction.includes('e')) nextWidth = startSize.width + deltaX;
      if (direction.includes('n')) nextHeight = startSize.height - deltaY;
      if (direction.includes('s')) nextHeight = startSize.height + deltaY;

      setPanelSize(getBoundedChatbotSize({ width: nextWidth, height: nextHeight }, isWorkView));
    };

    const stopResize = () => {
      window.removeEventListener(moveEventName, handleResizeMove);
      window.removeEventListener(endEventName, stopResize);
      window.removeEventListener(cancelEventName, stopResize);
      document.body.classList.remove('gl-chatbot-resizing');
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      resizeCleanupRef.current = null;
    };

    window.addEventListener(moveEventName, handleResizeMove, { passive: false });
    window.addEventListener(endEventName, stopResize);
    window.addEventListener(cancelEventName, stopResize);
    resizeCleanupRef.current = stopResize;
  };

  const clearAttachment = () => {
    setSelectedAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetChat = () => {
    if (isSending || isStartingBookingId) return;
    setMessages([createWelcomeMessage()]);
    setInputValue('');
    setErrorMessage('');
    clearAttachment();
  };

  const handleAttachmentChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!SUPPORTED_IMAGE_TYPES.has(String(file.type || '').toLowerCase())) {
      setErrorMessage('Upload a JPG, PNG, or WebP image so I can inspect the problem photo.');
      clearAttachment();
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setErrorMessage('Use an image under 2.9 MB so the assistant can analyze it safely.');
      clearAttachment();
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setSelectedAttachment({
        type: 'image',
        name: file.name || 'problem-photo',
        mediaType: file.type || 'image/jpeg',
        dataUrl,
        size: file.size,
      });
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to load that image.');
      clearAttachment();
    }
  };

  const sendMessage = async (rawInput) => {
    const activeAttachment = selectedAttachment;
    const cleanInput = String(rawInput || '').trim() || (activeAttachment ? PHOTO_HELP_PROMPT : '');
    if (!cleanInput || isSending) return;

    const userMessage = createMessage(
      'user',
      cleanInput,
      activeAttachment ? { attachments: [activeAttachment] } : {}
    );
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInputValue('');
    if (activeAttachment) clearAttachment();
    setErrorMessage('');

    const localReply = activeAttachment ? '' : getLocalAssistantReply(cleanInput, context);
    if (localReply) {
      setMessages([
        ...nextMessages,
        createMessage('assistant', localReply),
      ]);
      return;
    }

    setIsSending(true);

    try {
      const response = await sendChatbotMessage({
        messages: nextMessages.map((message) => ({
          role: message.role,
          content: message.content,
          attachments: message.attachments,
        })),
        context,
        attachments: activeAttachment ? [activeAttachment] : [],
      });

      setMessages((prevMessages) => [
        ...prevMessages,
        createMessage('assistant', response.message, {
          diagnosis: response.diagnosis,
          estimate: response.estimate,
          matches: response.matches,
          sources: response.sources,
        }),
      ]);
    } catch (error) {
      setErrorMessage(error?.message || 'The assistant is unavailable right now.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendMessage = async (event) => {
    event?.preventDefault();
    await sendMessage(inputValue);
  };

  const handleBrowseMatch = (match) => {
    const query = getMatchQuery(match);
    if (query) onSearchChange?.({ target: { value: query } });
    onOpenBrowseServices?.();
    setIsOpen(false);
  };

  const handleStartBooking = async (match, assistantMessage) => {
    if (!match?.id || isStartingBookingId) return;

    try {
      setIsStartingBookingId(String(match.id));
      setErrorMessage('');
      const conversation = await startServiceConversationByServiceId({
        serviceId: match.id,
        assistantContext: {
          source: 'trabawho-chatbot',
          problem: assistantMessage?.diagnosis || null,
          estimate: assistantMessage?.estimate || null,
          selected_match: match,
        },
      });

      setMessages((prevMessages) => [
        ...prevMessages,
        createMessage(
          'assistant',
          `Chat started with ${match.providerName || match.title || 'this worker'}. I opened the thread so you can continue scope, quote, and schedule details.`
        ),
      ]);
      onOpenChatPage?.(conversation?.id);
      setIsOpen(false);
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to start chat with this worker.');
    } finally {
      setIsStartingBookingId('');
    }
  };

  const renderAttachmentPreview = (attachment, compact = false) => (
    <div className={`gl-chatbot-attachment ${compact ? 'compact' : ''}`}>
      <img src={attachment.dataUrl} alt={attachment.name || 'Uploaded problem'} />
      <span>{attachment.name || 'Problem photo'}</span>
    </div>
  );

  const renderEstimate = (estimate) => {
    if (!estimate) return null;

    const materialRange = formatRange(estimate.materialSubtotalLow, estimate.materialSubtotalHigh);
    const totalRange = formatRange(estimate.totalLow, estimate.totalHigh);

    return (
      <div className="gl-chatbot-estimate" aria-label="Estimated budget">
        <strong>{estimate.problemTitle || 'Estimated budget'}</strong>
        {estimate.problemSummary && <p>{estimate.problemSummary}</p>}
        <div>
          <span>Materials</span>
          <b>{materialRange}</b>
        </div>
        <div>
          <span>Likely total</span>
          <b>{totalRange}</b>
        </div>
      </div>
    );
  };

  const renderSources = (sources = []) => {
    const cleanSources = sources
      .filter((source) => source?.url && source?.title)
      .slice(0, 3);

    if (cleanSources.length === 0) return null;

    return (
      <div className="gl-chatbot-sources" aria-label="Material price sources">
        {cleanSources.map((source) => (
          <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
            {source.title}
          </a>
        ))}
      </div>
    );
  };

  const renderMatches = (message) => {
    const matches = Array.isArray(message.matches) ? message.matches.slice(0, 3) : [];
    if (matches.length === 0) return null;

    return (
      <div className="gl-chatbot-matches" aria-label="Matched workers">
        {matches.map((match) => (
          <article key={`${match.id}-${match.providerName}`} className="gl-chatbot-match">
            <div>
              <strong>{match.providerName || match.title || 'Service Provider'}</strong>
              <span>{match.serviceType || match.title || 'Service'}{match.location ? ` - ${match.location}` : ''}</span>
              <small>{match.priceLabel || 'Quote required'}</small>
            </div>
            <div className="gl-chatbot-match-actions">
              <button type="button" onClick={() => handleBrowseMatch(match)}>
                View
              </button>
              <button
                type="button"
                className="primary"
                disabled={Boolean(isStartingBookingId)}
                onClick={() => handleStartBooking(match, message)}
              >
                {isStartingBookingId === String(match.id) ? 'Opening chat' : 'Chat with worker'}
              </button>
            </div>
          </article>
        ))}
      </div>
    );
  };

  if (isHidden) return null;

  return (
    <aside className={widgetClassName} data-testid="floating-chatbot">
      {isOpen && (
        <section
          className="gl-chatbot-panel"
          role="dialog"
          aria-label="TrabaWho assistant"
          aria-modal="false"
          style={panelStyle}
        >
          {CHATBOT_RESIZE_HANDLES.map((direction) => (
            <div
              key={direction}
              className={`gl-chatbot-resize-handle ${direction}`}
              aria-hidden="true"
              onMouseDown={(event) => handleResizeStart(direction, event)}
              onTouchStart={(event) => handleResizeStart(direction, event)}
            />
          ))}
          <header className="gl-chatbot-header">
            <span className="gl-chatbot-header-icon">
              <BotMessageSquare size={19} aria-hidden="true" />
            </span>
            <div>
              <h2>TrabaWho Assistant</h2>
              <p>Marketplace and booking help</p>
            </div>
            <button
              type="button"
              className="gl-chatbot-icon-button"
              aria-label="Reset TrabaWho assistant chat"
              title="Reset chat"
              disabled={isSending || Boolean(isStartingBookingId)}
              onClick={resetChat}
            >
              <RotateCcw size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="gl-chatbot-icon-button"
              aria-label="Close TrabaWho assistant"
              onClick={() => setIsOpen(false)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>

          <div className="gl-chatbot-messages" aria-live="polite" aria-busy={isSending}>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`gl-chatbot-message ${message.role}`}
                data-testid={`chatbot-message-${message.role}`}
              >
                {Array.isArray(message.attachments) && message.attachments.map((attachment) => (
                  <div key={attachment.dataUrl || attachment.name}>
                    {renderAttachmentPreview(attachment, true)}
                  </div>
                ))}
                {message.content}
                {message.role === 'assistant' && renderEstimate(message.estimate)}
                {message.role === 'assistant' && renderMatches(message)}
                {message.role === 'assistant' && renderSources(message.sources)}
              </div>
            ))}
            {isSending && (
              <div className="gl-chatbot-message assistant loading" data-testid="chatbot-loading">
                <Loader2 className="gl-spin" size={16} aria-hidden="true" />
                Thinking
              </div>
            )}
            <div className="gl-chatbot-scroll-anchor" ref={messagesEndRef} aria-hidden="true" />
          </div>

          {errorMessage && (
            <div className="gl-chatbot-error" role="alert">
              {errorMessage}
            </div>
          )}

          <form className="gl-chatbot-form" onSubmit={handleSendMessage}>
            <div className="gl-chatbot-suggestions" aria-label="Suggested TrabaWho questions">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="gl-chatbot-suggestion"
                  disabled={isSending}
                  onClick={() => sendMessage(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
            {selectedAttachment && (
              <div className="gl-chatbot-selected-attachment">
                {renderAttachmentPreview(selectedAttachment)}
                <button type="button" aria-label="Remove uploaded photo" onClick={clearAttachment}>
                  <X size={15} aria-hidden="true" />
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="gl-chatbot-file-input"
              onChange={handleAttachmentChange}
            />
            <button
              type="button"
              className="gl-chatbot-attach"
              aria-label="Upload problem photo"
              disabled={isSending}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip size={17} aria-hidden="true" />
            </button>
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSendMessage(event);
                }
              }}
              aria-label="Message TrabaWho assistant"
              placeholder="Ask or add photo"
              rows={1}
            />
            <button
              type="submit"
              className="gl-chatbot-send"
              aria-label="Send message"
              disabled={(!inputValue.trim() && !selectedAttachment) || isSending}
            >
              {isSending ? <Loader2 className="gl-spin" size={18} aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="gl-chatbot-toggle"
        aria-label={isOpen ? 'Close TrabaWho assistant' : 'Open TrabaWho assistant'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
      >
        {isOpen ? <X size={24} aria-hidden="true" /> : <BotMessageSquare className="gl-chatbot-toggle-icon" size={29} aria-hidden="true" />}
      </button>
    </aside>
  );
}

export default FloatingChatbot;
