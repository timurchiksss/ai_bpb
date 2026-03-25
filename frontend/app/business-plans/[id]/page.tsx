"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import * as Diff from "diff";
import { authAPI, chatAPI, businessPlanAPI, taskAPI, Chat, Message, MessageChunk, BusinessPlan, ModelsResponse, TaskStatus } from "@/lib/api";
import dynamic from "next/dynamic";
import ProfileDropdown from "@/components/ProfileDropdown";
import ModelTypeSelector from "@/components/ModelTypeSelector";

// Dynamically import MarkdownEditor to avoid SSR issues
const MarkdownEditor = dynamic(
  () => import('@/components/MarkdownEditor'),
  { ssr: false }
);

// Types for diff change groups
interface ChangeGroup {
  id: string;
  type: 'added' | 'removed' | 'modified';
  oldStartLine: number;
  oldEndLine: number;
  newStartLine: number;
  newEndLine: number;
  oldText: string;
  newText: string;
}

// Compute line-based diff between two strings and group changes
function computeLineDiff(oldText: string, newText: string): ChangeGroup[] {
  if (oldText === newText) return [];
  
  const changes = Diff.diffLines(oldText, newText);
  const groups: ChangeGroup[] = [];
  
  let oldLineNum = 1;
  let newLineNum = 1;
  let pendingRemoved: { startLine: number; endLine: number; text: string } | null = null;
  
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    const lineCount = change.value.split('\n').filter((_, idx, arr) => 
      idx < arr.length - 1 || arr[idx] !== ''
    ).length || (change.value.endsWith('\n') ? change.value.split('\n').length - 1 : change.value.split('\n').length);
    
    if (change.removed) {
      pendingRemoved = {
        startLine: oldLineNum,
        endLine: oldLineNum + lineCount - 1,
        text: change.value
      };
      oldLineNum += lineCount;
    } else if (change.added) {
      if (pendingRemoved) {
        // This is a modification (removed + added)
        const id = `mod-${pendingRemoved.startLine}-${newLineNum}-${Date.now()}`;
        groups.push({
          id,
          type: 'modified',
          oldStartLine: pendingRemoved.startLine,
          oldEndLine: pendingRemoved.endLine,
          newStartLine: newLineNum,
          newEndLine: newLineNum + lineCount - 1,
          oldText: pendingRemoved.text,
          newText: change.value
        });
        pendingRemoved = null;
      } else {
        // Pure addition
        const id = `add-${newLineNum}-${Date.now()}`;
        groups.push({
          id,
          type: 'added',
          oldStartLine: oldLineNum,
          oldEndLine: oldLineNum - 1,
          newStartLine: newLineNum,
          newEndLine: newLineNum + lineCount - 1,
          oldText: '',
          newText: change.value
        });
      }
      newLineNum += lineCount;
    } else {
      // Unchanged - flush any pending removed
      if (pendingRemoved) {
        const id = `del-${pendingRemoved.startLine}-${Date.now()}`;
        groups.push({
          id,
          type: 'removed',
          oldStartLine: pendingRemoved.startLine,
          oldEndLine: pendingRemoved.endLine,
          newStartLine: newLineNum,
          newEndLine: newLineNum - 1,
          oldText: pendingRemoved.text,
          newText: ''
        });
        pendingRemoved = null;
      }
      oldLineNum += lineCount;
      newLineNum += lineCount;
    }
  }
  
  // Flush any remaining pending removed
  if (pendingRemoved) {
    const id = `del-${pendingRemoved.startLine}-${Date.now()}`;
    groups.push({
      id,
      type: 'removed',
      oldStartLine: pendingRemoved.startLine,
      oldEndLine: pendingRemoved.endLine,
      newStartLine: newLineNum,
      newEndLine: newLineNum - 1,
      oldText: pendingRemoved.text,
      newText: ''
    });
  }
  
  return groups;
}

// Generate stable ID for a change group (for localStorage persistence)
function getStableChangeId(change: ChangeGroup): string {
  const content = `${change.type}-${change.oldStartLine}-${change.newStartLine}-${change.oldText.slice(0, 50)}-${change.newText.slice(0, 50)}`;
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `change-${Math.abs(hash)}`;
}

// Markdown styling classes
const ASSISTANT_MARKDOWN_CLASSES = [
  "prose prose-sm max-w-none",
  "[&_*]:text-black dark:[&_*]:text-white",
  "[&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-2 [&_h1]:text-black dark:[&_h1]:text-white",
  "[&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-2 [&_h2]:text-black dark:[&_h2]:text-white",
  "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-black dark:[&_h3]:text-white",
  "[&_p]:mb-2 [&_p]:text-sm [&_p]:text-black dark:[&_p]:text-white",
  "[&_ul]:mb-2 [&_ul]:text-sm [&_ul]:text-black dark:[&_ul]:text-white [&_ul]:list-disc [&_ul]:marker:text-black dark:[&_ul]:marker:text-white",
  "[&_ol]:mb-2 [&_ol]:text-sm [&_ol]:text-black dark:[&_ol]:text-white [&_ol]:list-decimal [&_ol]:marker:text-black dark:[&_ol]:marker:text-white",
  "[&_li]:mb-1 [&_li]:text-black dark:[&_li]:text-white [&_li]:marker:text-black dark:[&_li]:marker:text-white",
  "[&_strong]:font-semibold [&_strong]:text-black dark:[&_strong]:text-white",
  "[&_em]:italic [&_em]:text-black dark:[&_em]:text-white",
  "[&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_table]:text-sm",
  "[&_th]:border [&_th]:border-zinc-300 [&_th]:dark:border-zinc-600 [&_th]:px-3 [&_th]:py-2 [&_th]:bg-zinc-200 [&_th]:dark:bg-zinc-700 [&_th]:font-semibold [&_th]:text-left [&_th]:text-black dark:[&_th]:text-white",
  "[&_td]:border [&_td]:border-zinc-300 [&_td]:dark:border-zinc-600 [&_td]:px-3 [&_td]:py-2 [&_td]:text-black dark:[&_td]:text-white",
  "[&_code]:bg-zinc-200 [&_code]:dark:bg-zinc-700 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:text-black dark:[&_code]:text-white",
  "[&_pre]:bg-zinc-200 [&_pre]:dark:bg-zinc-700 [&_pre]:p-3 [&_pre]:rounded [&_pre]:overflow-x-auto [&_pre]:text-xs [&_pre]:text-black dark:[&_pre]:text-white",
  "[&_blockquote]:border-l-4 [&_blockquote]:border-zinc-400 [&_blockquote]:dark:border-zinc-500 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-black dark:[&_blockquote]:text-white",
  "[&_a]:text-blue-600 [&_a]:dark:text-blue-400 [&_a]:underline",
].join(" ");

const REASONING_MARKDOWN_CLASSES = [
  "prose prose-sm max-w-none dark:prose-invert text-amber-900 dark:text-amber-200",
  "[&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-2",
  "[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1",
  "[&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1",
  "[&_p]:mb-2 [&_p]:text-xs",
  "[&_ul]:mb-2 [&_ul]:list-disc [&_ul]:marker:text-amber-900 dark:[&_ul]:marker:text-amber-200",
  "[&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:marker:text-amber-900 dark:[&_ol]:marker:text-amber-200",
  "[&_li]:mb-1 [&_li]:text-xs [&_li]:marker:text-amber-900 dark:[&_li]:marker:text-amber-200",
  "[&_strong]:font-semibold",
  "[&_em]:italic",
  "[&_table]:w-full [&_table]:border-collapse [&_table]:my-2 [&_table]:text-xs",
  "[&_th]:border [&_th]:border-amber-300 [&_th]:dark:border-amber-700 [&_th]:px-2 [&_th]:py-1 [&_th]:bg-amber-100 [&_th]:dark:bg-amber-900/30 [&_th]:font-semibold [&_th]:text-left",
  "[&_td]:border [&_td]:border-amber-300 [&_td]:dark:border-amber-700 [&_td]:px-2 [&_td]:py-1",
  "[&_code]:bg-amber-100 [&_code]:dark:bg-amber-900/30 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs",
  "[&_pre]:bg-amber-100 [&_pre]:dark:bg-amber-900/30 [&_pre]:p-2 [&_pre]:rounded [&_pre]:overflow-x-auto [&_pre]:text-xs",
].join(" ");

// Helper function to parse reasoning blocks from content
// Returns completed reasoning blocks, streaming reasoning (if incomplete), and clean content
function parseReasoningBlocks(content: string, isStreaming: boolean = false): { 
  cleanContent: string; 
  reasoningBlocks: string[]; 
  streamingReasoning: string | null;
} {
  if (!content) return { cleanContent: "", reasoningBlocks: [], streamingReasoning: null };
  
  const reasoningBlocks: string[] = [];
  let streamingReasoning: string | null = null;
  
  // Match <think>...</think> tags (non-greedy to handle multiple)
  // Handle both regular tags and potential HTML-escaped tags
  const regex = /<think>([\s\S]*?)<\/think>/gi;
  let match;
  
  // Reset regex lastIndex to avoid issues with global regex
  regex.lastIndex = 0;
  
  while ((match = regex.exec(content)) !== null) {
    if (match[1]) {
      reasoningBlocks.push(match[1].trim());
    }
  }
  
  // Also check for HTML-escaped versions (just in case)
  if (reasoningBlocks.length === 0 && content.includes("&lt;think&gt;")) {
    const escapedRegex = /&lt;think&gt;([\s\S]*?)&lt;\/think&gt;/gi;
    escapedRegex.lastIndex = 0;
    while ((match = escapedRegex.exec(content)) !== null) {
      if (match[1]) {
        reasoningBlocks.push(match[1].trim());
      }
    }
  }
  
  // Remove completed reasoning tags from content
  let cleanContent = content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/&lt;think&gt;[\s\S]*?&lt;\/think&gt;/gi, '')
    .trim();
  
  // Check for incomplete/streaming thinking block (has <think> but no </think>)
  // This happens during streaming when the model is still outputting reasoning
  const unclosedThinkMatch = cleanContent.match(/<think>([\s\S]*)$/i);
  if (unclosedThinkMatch) {
    streamingReasoning = unclosedThinkMatch[1].trim();
    // Remove the incomplete tag from clean content
    cleanContent = cleanContent.replace(/<think>[\s\S]*$/i, '').trim();
  }
  
  // Also check for HTML-escaped incomplete tag
  if (!streamingReasoning) {
    const unclosedEscapedMatch = cleanContent.match(/&lt;think&gt;([\s\S]*)$/i);
    if (unclosedEscapedMatch) {
      streamingReasoning = unclosedEscapedMatch[1].trim();
      cleanContent = cleanContent.replace(/&lt;think&gt;[\s\S]*$/i, '').trim();
    }
  }
  
  return { cleanContent, reasoningBlocks, streamingReasoning };
}

function formatEstimatedTime(seconds: number): string {
  if (seconds <= 0) return "0 секунд";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'}`);
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'минута' : minutes < 5 ? 'минуты' : 'минут'}`);
  if (secs > 0 && hours === 0) parts.push(`${secs} ${secs === 1 ? 'секунда' : secs < 5 ? 'секунды' : 'секунд'}`);
  return parts.length > 0 ? parts.join(' ') : "0 секунд";
}

export default function BusinessPlanPage() {
  const params = useParams();
  const router = useRouter();
  const businessPlanId = params.id as string;
  
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Business Plan state
  const [businessPlan, setBusinessPlan] = useState<BusinessPlan | null>(null);
  
  // Chat state
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [activeToolCall, setActiveToolCall] = useState<string | null>(null); // Tool name currently executing
  // Track completed streaming segments (content before tool calls) and completed tool calls
  const [streamingSegments, setStreamingSegments] = useState<Array<{ type: 'text' | 'tool'; content: string }>>([]);
  // Planning indicator state
  const [showPlanningIndicator, setShowPlanningIndicator] = useState(false);
  const lastActivityRef = useRef<number>(0);
  const streamingContentRef = useRef<string>("");
  const activeToolCallRef = useRef<string | null>(null);
  const [messagesTotal, setMessagesTotal] = useState(0);
  const [messagesLimit] = useState(50);
  const [messagesOffset, setMessagesOffset] = useState(0);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesTopRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isUserNearBottomRef = useRef(true); // Track if user is near bottom (use ref to avoid re-renders)
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Model selection state
  const [availableModelTypes, setAvailableModelTypes] = useState<string[]>([]);
  const [selectedModelType, setSelectedModelType] = useState<string>(""); // For chat
  const [selectedDraftModelType, setSelectedDraftModelType] = useState<string>(""); // For draft generation
  
  // Chat selector state
  const [isChatSelectorOpen, setIsChatSelectorOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  
  // Download dropdown state
  const [isDownloadDropdownOpen, setIsDownloadDropdownOpen] = useState(false);
  
  // Draft form state
  const [isDraftFormOpen, setIsDraftFormOpen] = useState(false);
  
  // Onboarding state
  const [onboardingStep, setOnboardingStep] = useState<'none' | 'draft-button' | 'chat-panel' | 'complete'>('none');
  const draftButtonRef = useRef<HTMLButtonElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  
  // Load form data from localStorage on mount
  const getInitialDraftFormData = () => {
    if (typeof window === 'undefined') {
      return {
        businessPlanTitle: '',
        priorityActivities: [] as string[],
        participationPeriodYears: 3,
        plannedSubmissionYear: new Date().getFullYear(),
        websiteUrl: '',
        problemDescription: '',
        solutionDescription: '',
        projectGoals: '',
        projectTasks: '',
        region: '',
        targetMarketDescription: '',
        marketVolume: '',
        marketTrends: '',
        competitorsInfo: '',
        marketShare: '',
        ipDescription: '',
        ipDocuments: [] as Array<{ type: string; number: string; owner: string }>,
        teamMembers: [] as Array<{
          name: string;
          position: string;
          education: string;
          experience: string;
          skills: string;
          responsibilities: string;
        }>,
        projectStage: '',
        existingResults: '',
        completedWorkStages: '',
        readinessDegree: '',
        estimatedSalaries: '',
        estimatedServers: '',
        estimatedMarketing: '',
        estimatedOperations: '',
        productServiceTypes: '',
        salesModel: 'B2C' as 'B2C' | 'B2B' | 'B2G',
        revenueModel: '',
        salesStrategy: '',
        salesChannels: '',
        targetAudience: '',
        currentClients: '',
        clientCategories: '',
        customerProfile: '',
        regionalSignificance: '',
        economicSignificance: '',
        socialSignificance: '',
        plannedJobs: '',
      };
    }
    const saved = localStorage.getItem(`draftFormData_${businessPlanId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // If parsing fails, return defaults
      }
    }
    return {
      businessPlanTitle: '',
      priorityActivities: [] as string[],
      participationPeriodYears: 3,
      plannedSubmissionYear: new Date().getFullYear(),
      websiteUrl: '',
      problemDescription: '',
      solutionDescription: '',
      projectGoals: '',
      projectTasks: '',
      region: '',
      targetMarketDescription: '',
      marketVolume: '',
      marketTrends: '',
      competitorsInfo: '',
      marketShare: '',
      ipDescription: '',
      ipDocuments: [] as Array<{ type: string; number: string; owner: string }>,
      teamMembers: [] as Array<{
        name: string;
        position: string;
        education: string;
        experience: string;
        skills: string;
        responsibilities: string;
      }>,
      projectStage: '',
      existingResults: '',
      completedWorkStages: '',
      readinessDegree: '',
      estimatedSalaries: '',
      estimatedServers: '',
      estimatedMarketing: '',
      estimatedOperations: '',
      productServiceTypes: '',
      salesModel: 'B2C' as 'B2C' | 'B2B' | 'B2G',
      revenueModel: '',
      salesStrategy: '',
      salesChannels: '',
      targetAudience: '',
      currentClients: '',
      clientCategories: '',
      customerProfile: '',
      regionalSignificance: '',
      economicSignificance: '',
      socialSignificance: '',
      plannedJobs: '',
    };
  };
  
  const [draftFormData, setDraftFormData] = useState(getInitialDraftFormData);
  
  // Save form data to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && businessPlanId) {
      localStorage.setItem(`draftFormData_${businessPlanId}`, JSON.stringify(draftFormData));
    }
  }, [draftFormData, businessPlanId]);
  
  // State to control visibility of IP document and team member inputs
  const [showIPDocumentInputs, setShowIPDocumentInputs] = useState(false);
  const [showTeamMemberInputs, setShowTeamMemberInputs] = useState(false);
  const [currentPriorityActivity, setCurrentPriorityActivity] = useState('');
  const [currentIPDocument, setCurrentIPDocument] = useState({ type: '', number: '', owner: '' });
  const [currentTeamMember, setCurrentTeamMember] = useState({
    name: '',
    position: '',
    education: '',
    experience: '',
    skills: '',
    responsibilities: '',
  });
  
  // Draft generation state
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [draftTaskId, setDraftTaskId] = useState<string | null>(null);
  const [draftProgress, setDraftProgress] = useState<TaskStatus | null>(null);
  const draftPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Reasoning blocks expand/collapse state (Set of "messageId-blockIndex" keys)
  const [expandedReasoningBlocks, setExpandedReasoningBlocks] = useState<Set<string>>(new Set());
  
  // Panel states
  const [isSourcesPanelOpen, setIsSourcesPanelOpen] = useState(false);
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(true);
  
  // Load chat panel width from localStorage or use default
  const [chatPanelWidth, setChatPanelWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chatPanelWidth');
      return saved ? parseInt(saved, 10) : 384; // Default 96 * 4 = 384px (w-96)
    }
    return 384;
  });
  const [isResizing, setIsResizing] = useState(false);
  
  // Sources state
  const [sources, setSources] = useState<Array<{ id: string; name: string; type: 'text' | 'file' | 'image' | 'link'; content?: string; url?: string; file?: File }>>([]);
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [newSourceLink, setNewSourceLink] = useState("");
  const [draggedFile, setDraggedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Download state
  const [isDownloading, setIsDownloading] = useState<'pdf' | 'docx' | false>(false);

  // Edit mode state
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Diff/Changes state
  const [rejectedChangeIds, setRejectedChangeIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`rejected_changes_${businessPlanId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    }
    return new Set();
  });

  // Compute pending changes (diff between user_content and llm_content)
  const pendingChanges = useMemo(() => {
    if (!businessPlan) return [];
    const { user_content, llm_content } = businessPlan;
    if (user_content === llm_content) return [];
    
    const allChanges = computeLineDiff(user_content, llm_content);
    // Assign stable IDs and filter out rejected
    return allChanges
      .map(change => ({ ...change, id: getStableChangeId(change) }))
      .filter(change => !rejectedChangeIds.has(change.id));
  }, [businessPlan, rejectedChangeIds]);

  // Check if there are any pending changes
  const hasPendingChanges = pendingChanges.length > 0;

  // Save rejected changes to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && businessPlanId) {
      localStorage.setItem(`rejected_changes_${businessPlanId}`, JSON.stringify([...rejectedChangeIds]));
    }
  }, [rejectedChangeIds, businessPlanId]);

  // Accept a change - merge it into user_content and send to backend
  const handleAcceptChange = useCallback(async (changeId: string) => {
    if (!businessPlan) return;
    
    const change = pendingChanges.find(c => c.id === changeId);
    if (!change) return;
    
    // Apply the change to user_content
    const lines = businessPlan.user_content.split('\n');
    const newLines = businessPlan.llm_content.split('\n');
    
    // For simplicity, we'll rebuild user_content by applying this specific change
    // This works by replacing the old text with new text at the right position
    let newUserContent: string;
    
    if (change.type === 'added') {
      // Insert new lines
      const insertAt = change.oldStartLine - 1;
      const newLinesArr = change.newText.split('\n').filter((l, i, arr) => i < arr.length - 1 || l !== '');
      lines.splice(insertAt, 0, ...newLinesArr);
      newUserContent = lines.join('\n');
    } else if (change.type === 'removed') {
      // Remove old lines
      const removeStart = change.oldStartLine - 1;
      const removeCount = change.oldEndLine - change.oldStartLine + 1;
      lines.splice(removeStart, removeCount);
      newUserContent = lines.join('\n');
    } else {
      // Modified - replace old with new
      const replaceStart = change.oldStartLine - 1;
      const replaceCount = change.oldEndLine - change.oldStartLine + 1;
      const newLinesArr = change.newText.split('\n').filter((l, i, arr) => i < arr.length - 1 || l !== '');
      lines.splice(replaceStart, replaceCount, ...newLinesArr);
      newUserContent = lines.join('\n');
    }
    
    // Update local state immediately
    setBusinessPlan(prev => prev ? { ...prev, user_content: newUserContent } : null);
    
    // Send to backend
    try {
      await businessPlanAPI.updateBusinessPlan(businessPlanId, undefined, undefined, undefined, undefined, newUserContent);
    } catch (error) {
      console.error("Failed to accept change:", error);
      // Revert on error
      setBusinessPlan(prev => prev ? { ...prev, user_content: businessPlan.user_content } : null);
    }
  }, [businessPlan, pendingChanges, businessPlanId]);

  // Reject a change - just add to rejected set (frontend only)
  const handleRejectChange = useCallback((changeId: string) => {
    setRejectedChangeIds(prev => new Set([...prev, changeId]));
  }, []);

  // Accept all pending changes
  const handleAcceptAll = useCallback(async () => {
    if (!businessPlan || pendingChanges.length === 0) return;
    
    // Just set user_content to llm_content
    const newUserContent = businessPlan.llm_content;
    
    setBusinessPlan(prev => prev ? { ...prev, user_content: newUserContent } : null);
    
    try {
      await businessPlanAPI.updateBusinessPlan(businessPlanId, undefined, undefined, undefined, undefined, newUserContent);
    } catch (error) {
      console.error("Failed to accept all changes:", error);
      setBusinessPlan(prev => prev ? { ...prev, user_content: businessPlan.user_content } : null);
    }
  }, [businessPlan, pendingChanges, businessPlanId]);

  // Reject all pending changes
  const handleRejectAll = useCallback(() => {
    const allIds = pendingChanges.map(c => c.id);
    setRejectedChangeIds(prev => new Set([...prev, ...allIds]));
  }, [pendingChanges]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleFileSelect = (file: File) => {
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    
    if (isImage || isPdf) {
      setDraggedFile(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const getSourceName = (file?: File, url?: string) => {
    if (file) return file.name;
    if (url) {
      try {
        const urlObj = new URL(url);
        return urlObj.hostname + urlObj.pathname;
      } catch {
        return url;
      }
    }
    return 'Источник';
  };

  const getSourceType = (file?: File, url?: string): 'text' | 'file' | 'image' | 'link' => {
    if (file) {
      if (file.type.startsWith('image/')) return 'image';
      return 'file';
    }
    if (url) return 'link';
    return 'text';
  };

  const handleDownload = async (format: 'pdf' | 'docx') => {
    if (!businessPlan || isDownloading) return;
    
    setIsDownloading(format);
    try {
      const blob = await businessPlanAPI.downloadBusinessPlan(businessPlanId, format);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${businessPlan.title}.${format}`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      alert(`Ошибка при скачивании: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setIsDownloading(false);
    }
  };

  // Edit mode handlers
  const handleEnterEditMode = useCallback(() => {
    if (!businessPlan || hasPendingChanges) return;
    setEditedContent(businessPlan.user_content);
    setIsEditingMode(true);
  }, [businessPlan, hasPendingChanges]);

  const handleSaveEdit = useCallback(async () => {
    if (!businessPlan || isSaving) return;
    
    setIsSaving(true);
    try {
      await businessPlanAPI.updateBusinessPlan(businessPlanId, undefined, undefined, undefined, undefined, editedContent);
      setBusinessPlan(prev => prev ? { ...prev, user_content: editedContent } : null);
      setIsEditingMode(false);
    } catch (error) {
      console.error("Failed to save edited content:", error);
      alert(`Ошибка при сохранении: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setIsSaving(false);
    }
  }, [businessPlan, businessPlanId, editedContent, isSaving]);

  const handleCancelEdit = useCallback(() => {
    if (editedContent !== businessPlan?.user_content) {
      if (!confirm('У вас есть несохраненные изменения. Вы уверены, что хотите отменить?')) {
        return;
      }
    }
    setIsEditingMode(false);
    setEditedContent("");
  }, [editedContent, businessPlan]);

  useEffect(() => {
    fetchUserInfo();
    loadModels();
    
    // Check if onboarding was seen
    if (typeof window !== 'undefined') {
      const onboardingSeen = localStorage.getItem('onboarding_seen');
      if (!onboardingSeen) {
        setOnboardingStep('draft-button');
      }
    }
  }, []);
  
  const handleOnboardingNext = () => {
    if (onboardingStep === 'draft-button') {
      // Ensure chat panel is open for next step
      if (!isChatPanelOpen) {
        setIsChatPanelOpen(true);
      }
      setOnboardingStep('chat-panel');
    } else if (onboardingStep === 'chat-panel') {
      setOnboardingStep('complete');
      if (typeof window !== 'undefined') {
        localStorage.setItem('onboarding_seen', 'true');
      }
    }
  };

  useEffect(() => {
    if (userEmail && businessPlanId) {
      loadBusinessPlan();
      loadChats();
      loadActiveTask();
    }
  }, [userEmail, businessPlanId]);

  useEffect(() => {
    if (selectedChatId) {
      setMessagesOffset(0);
      loadMessages(selectedChatId, 0, false);
    }
  }, [selectedChatId]);

  useEffect(() => {
    // Auto-scroll only if user is near bottom
    scrollToBottom();
  }, [messages, streamingContent, streamingSegments]);

  // Keep refs in sync with state for planning indicator
  useEffect(() => {
    streamingContentRef.current = streamingContent;
    if (streamingContent) {
      lastActivityRef.current = Date.now();
    }
  }, [streamingContent]);

  useEffect(() => {
    activeToolCallRef.current = activeToolCall;
    if (activeToolCall) {
      lastActivityRef.current = Date.now();
    }
  }, [activeToolCall]);

  // Track activity and show planning indicator after 2 seconds of no activity
  useEffect(() => {
    if (!isSending) {
      setShowPlanningIndicator(false);
      return;
    }

    // Check every 100ms if we should show the planning indicator
    const checkInterval = setInterval(() => {
      // Don't show if there's active tool call or streaming content (use refs to avoid stale closures)
      if (activeToolCallRef.current || streamingContentRef.current) {
        setShowPlanningIndicator(false);
        return;
      }

      const now = Date.now();
      const timeSinceActivity = now - lastActivityRef.current;
      
      // Show planning indicator if 2+ seconds since last activity
      if (timeSinceActivity >= 2000) {
        setShowPlanningIndicator(true);
      } else {
        setShowPlanningIndicator(false);
      }
    }, 100);

    return () => clearInterval(checkInterval);
  }, [isSending]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputMessage]);

  // Load saved draft for current chat and business plan
  useEffect(() => {
    if (typeof window === "undefined" || !selectedChatId) return;

    const draftKey = `chatDraft:${businessPlanId}:${selectedChatId}`;
    const savedDraft = localStorage.getItem(draftKey);

    if (savedDraft !== null) {
      setInputMessage(savedDraft);
    } else {
      setInputMessage("");
    }
  }, [businessPlanId, selectedChatId]);

  // Persist non-empty drafts per chat per business plan in localStorage
  useEffect(() => {
    if (typeof window === "undefined" || !selectedChatId) return;

    const draftKey = `chatDraft:${businessPlanId}:${selectedChatId}`;
    const trimmed = inputMessage.trim();

    if (trimmed) {
      localStorage.setItem(draftKey, inputMessage);
    } else {
      localStorage.removeItem(draftKey);
    }
  }, [businessPlanId, selectedChatId, inputMessage]);

  // Save chat panel width to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chatPanelWidth', chatPanelWidth.toString());
    }
  }, [chatPanelWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const newWidth = window.innerWidth - e.clientX;
        // Min width 250px, max width 800px
        const clampedWidth = Math.min(Math.max(newWidth, 250), 800);
        setChatPanelWidth(clampedWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);


  // Close chat selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isChatSelectorOpen) {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-chat-selector]')) {
          setIsChatSelectorOpen(false);
          setChatToDelete(null); // Cancel deletion confirmation when clicking outside
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isChatSelectorOpen]);

  // Close download dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isDownloadDropdownOpen) {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-download-dropdown]')) {
          setIsDownloadDropdownOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDownloadDropdownOpen]);

  const scrollToBottom = (force: boolean = false) => {
    // Only auto-scroll if user is near bottom or if forced
    if (force || isUserNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };
  
  // Check if user is near bottom of messages container
  const checkIfNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    
    const threshold = 100; // pixels from bottom to consider "near bottom"
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    isUserNearBottomRef.current = isNearBottom;
    return isNearBottom;
  };

  const fetchUserInfo = async () => {
    try {
      const response = await authAPI.me();
      setUserEmail(response.email);
      setIsAdmin(response.is_admin);
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch user info:", error);
      window.location.href = "/";
    }
  };

  const loadModels = async () => {
    try {
      const response = await chatAPI.listModels();
      setAvailableModelTypes(response.model_types);
      
      // Set default model type for chat if not already set
      if (!selectedModelType && response.model_types.length > 0) {
        // Default to "standard" if available, otherwise first available
        const defaultType = response.model_types.includes("standard") 
          ? "standard" 
          : response.model_types[0];
        setSelectedModelType(defaultType);
      }
      
      // Set default model type for draft if not already set
      if (!selectedDraftModelType && response.model_types.length > 0) {
        // Default to "standard" if available, otherwise first available
        const defaultType = response.model_types.includes("standard") 
          ? "standard" 
          : response.model_types[0];
        setSelectedDraftModelType(defaultType);
      }
    } catch (error) {
      console.error("Failed to load models:", error);
    }
  };

  const loadBusinessPlan = async () => {
    try {
      const plan = await businessPlanAPI.getBusinessPlan(businessPlanId);
      setBusinessPlan(plan);
    } catch (error) {
      console.error("Failed to load business plan:", error);
      router.push("/dashboard");
    }
  };

  const loadChats = async () => {
    try {
      const response = await chatAPI.listChats(businessPlanId);
      setChats(response.chats);
      // Open last chat by default (first in list as they're sorted by updated_at desc)
      if (response.chats.length > 0 && !selectedChatId) {
        setSelectedChatId(response.chats[0].id);
      }
    } catch (error) {
      console.error("Failed to load chats:", error);
    }
  };

  const loadActiveTask = async () => {
    try {
      const status = await taskAPI.getTaskStatus(businessPlanId);
      if (status) {
        setDraftTaskId(status.task_id);
        setIsGeneratingDraft(true);
        setDraftProgress(status);
        // Start polling if task is still active
        if (status.status === 'queued' || status.status === 'in_progress') {
          startPollingTaskStatus();
        } else {
          // Task is complete, aborted, or has error
          setIsGeneratingDraft(false);
        }
      } else {
        // No active task
        setDraftTaskId(null);
        setIsGeneratingDraft(false);
        setDraftProgress(null);
      }
    } catch (error) {
      console.error("Failed to load active task:", error);
    }
  };

  const loadMessages = async (chatId: string, offset: number = 0, append: boolean = false) => {
    try {
      setIsLoadingMessages(true);
      const response = await chatAPI.listMessages(chatId, messagesLimit, offset, 'created_at', 'desc');
      
      // Messages come in desc order (newest first), but we display oldest first
      const reversedMessages = [...response.messages].reverse();
      
      if (append) {
        // Prepend older messages to the beginning
        setMessages((prev) => [...reversedMessages, ...prev]);
      } else {
        // Replace all messages
        setMessages(reversedMessages);
      }
      
      setMessagesTotal(response.total);
      setMessagesOffset(offset);
      setHasMoreMessages(offset + response.messages.length < response.total);
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const loadMoreMessages = async () => {
    if (!selectedChatId || isLoadingMessages || !hasMoreMessages) return;
    const newOffset = messagesOffset + messagesLimit;
    await loadMessages(selectedChatId, newOffset, true);
  };

  const handleCreateChat = async () => {
    if (isGeneratingDraft) {
      alert('Невозможно создать чат во время генерации драфта. Пожалуйста, дождитесь завершения генерации.');
      return;
    }
    try {
      const newChat = await chatAPI.createChat("Новый чат", businessPlanId);
      setChats([newChat, ...chats]);
      setSelectedChatId(newChat.id);
      setMessages([]);
    } catch (error) {
      console.error("Failed to create chat:", error);
    }
  };

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // If this is the first click, show confirmation
    if (chatToDelete !== chatId) {
      setChatToDelete(chatId);
      return;
    }
    
    // Second click - actually delete
    try {
      await chatAPI.deleteChat(chatId);
      setChats(chats.filter((chat) => chat.id !== chatId));
      if (selectedChatId === chatId) {
        if (chats.length > 1) {
          const remainingChats = chats.filter((chat) => chat.id !== chatId);
          setSelectedChatId(remainingChats[0]?.id || null);
        } else {
          setSelectedChatId(null);
          setMessages([]);
        }
      }
      setChatToDelete(null);
    } catch (error) {
      console.error("Failed to delete chat:", error);
      setChatToDelete(null);
    }
  };
  
  // Cancel deletion confirmation
  const handleCancelDelete = () => {
    setChatToDelete(null);
  };

  const handleSendMessage = async () => {
    // Block sending if there are pending changes
    if (hasPendingChanges) {
      alert('Пожалуйста, примите или отклоните все изменения перед отправкой нового сообщения.');
      return;
    }
    // Block sending if draft is being generated
    if (isGeneratingDraft) {
      alert('Чат недоступен во время генерации драфта. Пожалуйста, дождитесь завершения генерации.');
      return;
    }
    if (!inputMessage.trim() || !selectedChatId || isSending || !selectedModelType) return;

    const messageContent = inputMessage.trim();
    setInputMessage("");
    setIsSending(true);
    setStreamingContent("");
    setStreamingSegments([]);
    lastActivityRef.current = Date.now(); // Reset activity timestamp
    setShowPlanningIndicator(false);
    
    // Reset to auto-scroll when user sends a message
    isUserNearBottomRef.current = true;

    // Check if this is the first message in the chat
    const isFirstMessage = messages.length === 0;

    // Add user message to UI immediately
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      chat_id: selectedChatId,
      user_id: "",
      content: messageContent,
      role: "user",
      created_at: new Date().toISOString(),
    };
    setMessages([...messages, userMessage]);
    
    // Force scroll to bottom when sending
    setTimeout(() => scrollToBottom(true), 0);

    // Add placeholder for assistant response
    const assistantMessageId = `temp-assistant-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      chat_id: selectedChatId,
      user_id: "",
      content: "",
      role: "assistant",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    // Track content locally to avoid state batching issues
    let localStreamingContent = "";
    let localSegments: Array<{ type: 'text' | 'tool'; content: string }> = [];
    
    try {
      // Stream the response
      for await (const chunk of chatAPI.sendMessage(selectedChatId, messageContent, selectedModelType)) {
        if (chunk.type === "response" && chunk.content) {
          localStreamingContent += chunk.content;
          setStreamingContent(localStreamingContent);
        } else if (chunk.type === "tool_start" && chunk.content) {
          // Tool execution started - commit current streaming content as a segment
          if (localStreamingContent.trim()) {
            localSegments = [...localSegments, { type: 'text', content: localStreamingContent }];
            setStreamingSegments(localSegments);
          }
          localStreamingContent = "";
          setStreamingContent("");
          setActiveToolCall(chunk.content);
        } else if (chunk.type === "tool_end") {
          // Tool execution finished - add tool as a completed segment
          localSegments = [...localSegments, { type: 'tool', content: 'Бизнес-план обновлен' }];
          setStreamingSegments(localSegments);
          setActiveToolCall(null);
        } else if (chunk.type === "business_plan_update" && chunk.content) {
          // Update the llm_content (LLM's version) on the canvas
          // Frontend will compute diffs between user_content and llm_content
          setBusinessPlan((prev) => prev ? { ...prev, llm_content: chunk.content! } : null);
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      // Remove the temporary messages on error
      setMessages((prev) => prev.filter((msg) => msg.id !== userMessage.id && msg.id !== assistantMessageId));
    } finally {
      setIsSending(false);
      setStreamingContent("");
      setStreamingSegments([]);
      setActiveToolCall(null);
      setShowPlanningIndicator(false);
      // Reload messages to get the final saved versions (reset to latest)
      setMessagesOffset(0);
      await loadMessages(selectedChatId, 0, false);
      
      // If this was the first message, refetch chats to get the updated name
      if (isFirstMessage) {
        await loadChats();
      }
    }
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Handle draft generation
  const handleGenerateDraft = async () => {
    if (!selectedDraftModelType || isGeneratingDraft) return;

    try {
      setIsGeneratingDraft(true);
      setIsDraftFormOpen(false);

      // Convert form data to backend format
      const formDataPayload = {
        website_url: draftFormData.websiteUrl,
        problem_description: draftFormData.problemDescription,
        solution_description: draftFormData.solutionDescription,
        project_goals: draftFormData.projectGoals,
        project_tasks: draftFormData.projectTasks,
        region: draftFormData.region,
        target_market_description: draftFormData.targetMarketDescription,
        market_volume: draftFormData.marketVolume,
        market_trends: draftFormData.marketTrends,
        competitors_info: draftFormData.competitorsInfo,
        market_share: draftFormData.marketShare,
        ip_description: draftFormData.ipDescription,
        ip_documents: draftFormData.ipDocuments,
        team_members: draftFormData.teamMembers,
        project_stage: draftFormData.projectStage,
        existing_results: draftFormData.existingResults,
        completed_work_stages: draftFormData.completedWorkStages,
        readiness_degree: draftFormData.readinessDegree,
        estimated_salaries: draftFormData.estimatedSalaries,
        estimated_servers: draftFormData.estimatedServers,
        estimated_marketing: draftFormData.estimatedMarketing,
        estimated_operations: draftFormData.estimatedOperations,
        product_service_types: draftFormData.productServiceTypes,
        sales_model: draftFormData.salesModel,
        revenue_model: draftFormData.revenueModel,
        sales_strategy: draftFormData.salesStrategy,
        sales_channels: draftFormData.salesChannels,
        target_audience: draftFormData.targetAudience,
        current_clients: draftFormData.currentClients,
        client_categories: draftFormData.clientCategories,
        customer_profile: draftFormData.customerProfile,
        regional_significance: draftFormData.regionalSignificance,
        economic_significance: draftFormData.economicSignificance,
        social_significance: draftFormData.socialSignificance,
        planned_jobs: draftFormData.plannedJobs,
      };

      // Send request to generate draft
      const response = await taskAPI.generateDraft(
        businessPlanId,
        formDataPayload,
        selectedDraftModelType
      );

      setDraftTaskId(response.task_id);
      setIsGeneratingDraft(true);
      setDraftProgress({
        task_id: response.task_id,
        status: 'queued',
        current_section: 0,
        completed_sections: [],
        total_sections: 12,
        estimated_seconds_remaining: 0,
        error: null,
        business_plan_id: businessPlanId,
      });

      // Start polling
      startPollingTaskStatus();
    } catch (error) {
      console.error("Failed to generate draft:", error);
      alert(`Ошибка при создании драфта: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      setIsGeneratingDraft(false);
    }
  };

  // Poll task status
  const startPollingTaskStatus = () => {
    // Clear any existing interval
    if (draftPollIntervalRef.current) {
      clearInterval(draftPollIntervalRef.current);
      draftPollIntervalRef.current = null;
    }

    // Wait 5 seconds before first poll, then poll every 5 seconds
    setTimeout(() => {
      pollTaskStatus();
      
      draftPollIntervalRef.current = setInterval(() => {
        pollTaskStatus();
      }, 5000) as unknown as NodeJS.Timeout;
    }, 5000);
  };

  const pollTaskStatus = async () => {
    try {
      const status = await taskAPI.getTaskStatus(businessPlanId);
      const previousCompletedCount = draftProgress?.completed_sections.length || 0;
      const isFirstFetch = draftProgress === null || draftProgress.status === 'queued';
      
      if (!status) {
        // No active task anymore
        if (draftPollIntervalRef.current) {
          clearInterval(draftPollIntervalRef.current);
          draftPollIntervalRef.current = null;
        }
        setDraftTaskId(null);
        setIsGeneratingDraft(false);
        setDraftProgress(null);
        return;
      }
      
      setDraftProgress(status);
      setIsGeneratingDraft(true); // Ensure generating state is set when polling

      // Refetch business plan if:
      // 1. This is the first status fetch (was queued, now in_progress)
      // 2. A new section was completed
      // 3. Status is in_progress (to get latest content as it's being generated)
      // 4. Status is complete
      if (
        isFirstFetch || 
        status.completed_sections.length > previousCompletedCount || 
        status.status === 'in_progress' ||
        status.status === 'complete'
      ) {
        await loadBusinessPlan();
      }

      // If complete, aborted, or has error, stop polling
      if (status.status === 'complete' || status.status === 'aborted' || status.error !== null) {
        if (draftPollIntervalRef.current) {
          clearInterval(draftPollIntervalRef.current);
          draftPollIntervalRef.current = null;
        }
        setIsGeneratingDraft(false);
      }
    } catch (error) {
      console.error("Failed to poll task status:", error);
    }
  };

  const cancelTask = async () => {
    if (!isGeneratingDraft || !draftTaskId) return;
    
    try {
      await taskAPI.cancelTask(businessPlanId);
      // Stop polling
      if (draftPollIntervalRef.current) {
        clearInterval(draftPollIntervalRef.current);
        draftPollIntervalRef.current = null;
      }
      setDraftTaskId(null);
      setIsGeneratingDraft(false);
      setDraftProgress(null);
      // Reload business plan to get latest state
      await loadBusinessPlan();
    } catch (error) {
      console.error("Failed to cancel task:", error);
      alert(`Ошибка при отмене задачи: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (draftPollIntervalRef.current) {
        clearInterval(draftPollIntervalRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-secondary)]">
        <div className="text-text-primary">Загрузка...</div>
      </div>
    );
  }

  const selectedChat = chats.find((chat) => chat.id === selectedChatId);
  const displayMessages = [...messages];
  
  // For streaming messages, we handle content display differently
  // We'll mark the streaming message and render segments separately in JSX
  const isCurrentlyStreaming = isSending && (streamingContent || streamingSegments.length > 0 || activeToolCall);

  return (
    <div className="flex h-screen flex-col bg-[var(--surface-secondary)] overflow-hidden">
      {/* Header */}
      <header className="border-b-2 border-[var(--border)] bg-[var(--surface-header)] flex-shrink-0 shadow-sm">
        <div className="w-full px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="p-2 rounded-lg hover:bg-text-primary/5 transition-colors text-text-secondary hover:text-text-primary"
              title="Назад к панели"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-text-primary">
              {businessPlan?.title || "Бизнес-план"}
            </h1>
          </div>

          {/* User Menu */}
          <ProfileDropdown
            userEmail={userEmail}
            isAdmin={isAdmin}
            onLogout={handleLogout}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full overflow-hidden flex">
        {/* Left: Sources Panel */}
        {isSourcesPanelOpen && (
          <div className="w-80 border-r-2 border-[var(--border)] bg-[var(--surface)] flex flex-col overflow-hidden shadow-lg">
            <div className="border-b-2 border-[var(--border-light)] p-3 bg-[var(--surface-secondary)] flex items-center justify-between flex-shrink-0">
              <h2 className="text-sm font-semibold text-text-primary">
                Источники
              </h2>
              <button
                onClick={() => setIsSourcesPanelOpen(false)}
                className="p-1 hover:bg-text-primary/5 rounded transition-colors"
                title="Закрыть панель источников"
              >
                <svg
                  className="w-4 h-4 text-text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="text-center py-12">
                <div className="mb-4">
                  <svg
                    className="w-16 h-16 mx-auto text-[var(--text-tertiary)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-text-primary mb-2">
                  Функция в разработке
                </h3>
                <p className="text-sm text-[var(--text-tertiary)] mb-4 max-w-xs mx-auto">
                  Добавление источников (файлы, ссылки, изображения) для использования в бизнес-плане будет доступно в ближайшее время.
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent/10 border border-accent/30 rounded-lg mb-6">
                  <svg
                    className="w-4 h-4 text-accent"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-xs font-medium text-accent">
                    Запланировано на будущее
                  </span>
                </div>
                <button
                  onClick={() => setIsAddingSource(true)}
                  className="px-4 py-2 text-sm bg-accent text-accent-foreground rounded hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + Добавить источник
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Center: Business Plan Area */}
        <div className="flex-1 overflow-y-auto bg-[var(--surface-secondary)] py-8 px-4">
          <div className="max-w-[210mm] mx-auto">
            {/* AI Note */}
            <div className="mb-4 flex items-center justify-center gap-2 text-xs text-text-secondary">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <span>Этот бизнес-план создан с помощью искусственного интеллекта</span>
            </div>

            {/* Draft Generation Progress */}
            {isGeneratingDraft && draftProgress && (
              <div className="mb-4 p-4 bg-[var(--surface)] border-2 border-accent rounded-lg shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    <span className="font-medium text-text-primary">
                        Генерация драфта: {draftProgress.completed_sections.length} из {draftProgress.total_sections} разделов готово
                    </span>
                  </div>
                  <button
                    onClick={cancelTask}
                    className="px-3 py-1.5 text-sm bg-[var(--error-bg)] text-[var(--error-text)] rounded hover:opacity-90 transition-all"
                  >
                    Отменить
                  </button>
                </div>
                <div className="w-full bg-[var(--surface-secondary)] rounded-full h-2.5 mb-2">
                  <div
                    className="bg-accent h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${(draftProgress.completed_sections.length / draftProgress.total_sections) * 100}%` }}
                  />
                </div>
                <div className="text-sm text-[var(--text-secondary)]">
                  Осталось примерно: {formatEstimatedTime(draftProgress.estimated_seconds_remaining)}
                </div>
                {draftProgress.error && (
                  <div className="mt-2 text-sm text-[var(--error-text)]">
                    Ошибка: {draftProgress.error}
                  </div>
                )}
              </div>
            )}
            
            {/* Pending Changes Banner */}
            {hasPendingChanges && (
              <div className="mb-4 p-4 bg-[var(--warning-background)] border-2 border-[var(--warning-border)] rounded-lg shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-[var(--warning-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-medium text-[var(--warning-text)]">
                      {pendingChanges.length} {pendingChanges.length === 1 ? 'изменение' : pendingChanges.length < 5 ? 'изменения' : 'изменений'} ожидает проверки
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAcceptAll}
                      className="px-3 py-1.5 text-sm bg-[var(--success-button)] hover:bg-[var(--success-button-hover)] text-white rounded-md transition-colors"
                    >
                      Принять все
                    </button>
                    <button
                      onClick={handleRejectAll}
                      className="px-3 py-1.5 text-sm bg-[var(--error-button)] hover:bg-[var(--error-button-hover)] text-white rounded-md transition-colors"
                    >
                      Отклонить все
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Action buttons - Edit/Download/Save/Cancel/Draft */}
            {businessPlan && (
              <div className="flex gap-2 mb-4 justify-end">
                {isEditingMode ? (
                  <>
                    <button
                      onClick={handleSaveEdit}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-[var(--success-button)] hover:bg-[var(--success-button-hover)] disabled:bg-[var(--success-button-disabled)] text-white rounded-lg transition-colors shadow-md"
                    >
                      {isSaving ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      Сохранить
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-[var(--text-tertiary)] hover:opacity-90 disabled:opacity-50 text-white rounded-lg transition-colors shadow-md"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Отменить
                    </button>
                  </>
                ) : (
                  <>
                    {!hasPendingChanges && (
                      <button
                        onClick={handleEnterEditMode}
                        className="flex items-center gap-2 px-4 py-2 bg-accent hover:opacity-90 text-white rounded-lg transition-colors shadow-md"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Редактировать
                      </button>
                    )}
                    {businessPlan.user_content && !hasPendingChanges && (
                      <div className="relative" data-download-dropdown>
                          <button
                            onClick={() => setIsDownloadDropdownOpen(!isDownloadDropdownOpen)}
                            disabled={!!isDownloading}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 dark:bg-slate-500 dark:hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg transition-colors shadow-md"
                          >
                            {isDownloading ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            )}
                            Скачать
                            <svg
                              className={`w-4 h-4 transition-transform ${isDownloadDropdownOpen ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {isDownloadDropdownOpen && (
                            <div className="absolute top-full right-0 mt-1 bg-[var(--surface)] rounded-lg border-2 border-[var(--border)] shadow-xl z-50 min-w-[120px]">
                              <button
                                onClick={() => {
                                  handleDownload('pdf');
                                  setIsDownloadDropdownOpen(false);
                                }}
                                disabled={!!isDownloading}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-text-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                              >
                                {isDownloading === 'pdf' ? (
                                  <div className="w-4 h-4 border-2 border-text-primary border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                )}
                                <span className="text-text-primary">PDF</span>
                              </button>
                              <button
                                onClick={() => {
                                  handleDownload('docx');
                                  setIsDownloadDropdownOpen(false);
                                }}
                                disabled={!!isDownloading}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-text-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border-t border-[var(--border-lighter)]"
                              >
                                {isDownloading === 'docx' ? (
                                  <div className="w-4 h-4 border-2 border-text-primary border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                )}
                                <span className="text-text-primary">DOCX</span>
                              </button>
                            </div>
                          )}
                        </div>
                    )}
                    <button
                      ref={draftButtonRef}
                      onClick={() => {
                        // Pre-fill form with existing data if available
                        if (businessPlan) {
                          setDraftFormData({
                            ...draftFormData,
                            businessPlanTitle: businessPlan.title || '',
                            priorityActivities: businessPlan.priority_activities || [],
                            participationPeriodYears: businessPlan.participation_period_years || 3,
                            plannedSubmissionYear: businessPlan.planned_submission_year || new Date().getFullYear(),
                          });
                        } else {
                          // Reset to defaults if no business plan
                          setDraftFormData({
                            businessPlanTitle: '',
                            priorityActivities: [],
                            participationPeriodYears: 3,
                            plannedSubmissionYear: new Date().getFullYear(),
                            websiteUrl: '',
                            problemDescription: '',
                            solutionDescription: '',
                            projectGoals: '',
                            projectTasks: '',
                            region: '',
                            targetMarketDescription: '',
                            marketVolume: '',
                            marketTrends: '',
                            competitorsInfo: '',
                            marketShare: '',
                            ipDescription: '',
                            ipDocuments: [],
                            teamMembers: [],
                            projectStage: '',
                            existingResults: '',
                            completedWorkStages: '',
                            readinessDegree: '',
                            estimatedSalaries: '',
                            estimatedServers: '',
                            estimatedMarketing: '',
                            estimatedOperations: '',
                            productServiceTypes: '',
                            salesModel: 'B2C',
                            revenueModel: '',
                            salesStrategy: '',
                            salesChannels: '',
                            targetAudience: '',
                            currentClients: '',
                            clientCategories: '',
                            customerProfile: '',
                            regionalSignificance: '',
                            economicSignificance: '',
                            socialSignificance: '',
                            plannedJobs: '',
                          });
                        }
                        setIsDraftFormOpen(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white rounded-lg transition-colors shadow-md"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Создать бизнес план
                    </button>
                  </>
                )}
              </div>
            )}
            {/* Paper-like container - A4 size */}
            <div className="bg-[var(--surface)] shadow-2xl w-[210mm] min-h-[297mm] p-12 mb-8 border-2 border-[var(--border-light)] business-plan-page">
              {/* Business Plan Content with Diff View */}
              {hasPendingChanges ? (
                <div className="prose prose-sm max-w-none dark:prose-invert text-black dark:text-white [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-2 [&_p]:mb-3 [&_ul]:mb-3 [&_ol]:mb-3 [&_li]:mb-1 [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_th]:border [&_th]:border-zinc-300 [&_th]:dark:border-zinc-700 [&_th]:px-4 [&_th]:py-2 [&_th]:bg-zinc-100 [&_th]:dark:bg-zinc-800 [&_th]:font-semibold [&_th]:text-left [&_td]:border [&_td]:border-zinc-300 [&_td]:dark:border-zinc-700 [&_td]:px-4 [&_td]:py-2">
                  {/* Render diff view - collect chunks and render markdown properly */}
                  {(() => {
                    const userLines = (businessPlan?.user_content || '').split('\n');
                    const result: React.ReactNode[] = [];
                    
                    // Build a map of line ranges to changes
                    const changesByLine = new Map<number, ChangeGroup>();
                    pendingChanges.forEach(change => {
                      for (let i = change.oldStartLine; i <= Math.max(change.oldEndLine, change.oldStartLine); i++) {
                        changesByLine.set(i, change);
                      }
                    });
                    
                    // Track which changes we've rendered
                    const renderedChanges = new Set<string>();
                    let lineNum = 1;
                    let unchangedChunk: string[] = [];
                    
                    const flushUnchangedChunk = () => {
                      if (unchangedChunk.length > 0) {
                        const chunkContent = unchangedChunk.join('\n');
                        result.push(
                          <ReactMarkdown key={`unchanged-${lineNum}`} remarkPlugins={[remarkGfm, remarkBreaks]}>
                            {chunkContent}
                          </ReactMarkdown>
                        );
                        unchangedChunk = [];
                      }
                    };
                    
                    const renderChangeBlock = (change: ChangeGroup) => {
                      result.push(
                        <div key={change.id} className="relative my-3 rounded-lg overflow-hidden">
                          {/* Accept/Reject buttons */}
                          <div className="absolute top-2 right-2 flex gap-1 z-10">
                            <button
                              onClick={() => handleAcceptChange(change.id)}
                              className="p-1.5 bg-[var(--success-background)] hover:bg-[var(--success-border)] rounded transition-colors"
                              title="Принять изменение"
                            >
                              <svg className="w-4 h-4 text-[var(--success-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleRejectChange(change.id)}
                              className="p-1.5 bg-[var(--error-background)] hover:bg-[var(--error-border)] rounded transition-colors"
                              title="Отклонить изменение"
                            >
                              <svg className="w-4 h-4 text-[var(--error-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          
                          {/* Old text (removed/modified) */}
                          {(change.type === 'removed' || change.type === 'modified') && change.oldText && (
                            <div className="px-3 py-2 pr-20 bg-red-100 dark:bg-red-900/30 rounded-t-lg [&_*]:text-red-800 dark:[&_*]:text-red-200">
                              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                {change.oldText.replace(/\n$/, '')}
                              </ReactMarkdown>
                            </div>
                          )}
                          
                          {/* New text (added/modified) */}
                          {(change.type === 'added' || change.type === 'modified') && change.newText && (
                            <div className={`px-3 py-2 pr-20 bg-green-100 dark:bg-green-900/30 ${change.type === 'added' ? 'rounded-lg' : 'rounded-b-lg'} [&_*]:text-green-800 dark:[&_*]:text-green-200`}>
                              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                {change.newText.replace(/\n$/, '')}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                      );
                    };
                    
                    while (lineNum <= userLines.length || renderedChanges.size < pendingChanges.length) {
                      const change = changesByLine.get(lineNum);
                      
                      if (change && !renderedChanges.has(change.id)) {
                        // Flush any accumulated unchanged lines first
                        flushUnchangedChunk();
                        
                        renderedChanges.add(change.id);
                        renderChangeBlock(change);
                        
                        // Skip the lines covered by this change
                        lineNum = change.oldEndLine + 1;
                      } else if (lineNum <= userLines.length) {
                        // Accumulate unchanged lines
                        unchangedChunk.push(userLines[lineNum - 1]);
                        lineNum++;
                      } else {
                        // Handle additions at the end
                        flushUnchangedChunk();
                        const remainingChanges = pendingChanges.filter(c => !renderedChanges.has(c.id));
                        remainingChanges.forEach(change => {
                          renderedChanges.add(change.id);
                          renderChangeBlock(change);
                        });
                        break;
                      }
                    }
                    
                    // Flush any remaining unchanged lines
                    flushUnchangedChunk();
                    
                    return result;
                  })()}
                </div>
              ) : isEditingMode ? (
                <MarkdownEditor
                  markdown={editedContent}
                  onChange={setEditedContent}
                />
              ) : (
                <div className="prose prose-sm max-w-none dark:prose-invert text-black dark:text-white [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-2 [&_p]:mb-3 [&_ul]:mb-3 [&_ol]:mb-3 [&_li]:mb-1 [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_th]:border [&_th]:border-zinc-300 [&_th]:dark:border-zinc-700 [&_th]:px-4 [&_th]:py-2 [&_th]:bg-zinc-100 [&_th]:dark:bg-zinc-800 [&_th]:font-semibold [&_th]:text-left [&_td]:border [&_td]:border-zinc-300 [&_td]:dark:border-zinc-700 [&_td]:px-4 [&_td]:py-2">
                  {businessPlan?.user_content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                      {businessPlan.user_content}
                    </ReactMarkdown>
                  ) : businessPlan?.llm_content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                      {businessPlan.llm_content}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-[var(--text-tertiary)]">
                      Ваш бизнес-план появится здесь...
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Chat Panel */}
        {isChatPanelOpen && (
          <div ref={chatPanelRef} className="relative flex flex-col overflow-hidden shadow-lg bg-gradient-to-br from-blue-50 via-blue-100/60 to-blue-200/40 dark:from-black dark:via-blue-950/30 dark:to-blue-900/20" style={{ width: `${chatPanelWidth}px` }}>
            {/* Decorative background shapes */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-accent/10 rounded-bl-none blur-2xl"></div>
              <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full bg-accent/8 rounded-tr-none blur-2xl"></div>
            </div>
            
            {/* Resize Handle */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setIsResizing(true);
              }}
              className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-text-primary/20 transition-colors z-10"
              title="Перетащите для изменения размера"
            />
            <div className="relative z-10 border-l-2 border-[var(--border)] flex flex-col overflow-hidden h-full">
            {/* Chat Selector */}
            <div className="relative z-20 border-b-2 border-[var(--border-light)] p-3 bg-[var(--surface)]/80 backdrop-blur-sm flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setIsChatPanelOpen(false)}
                  className="p-1 hover:bg-text-primary/5 rounded transition-colors flex-shrink-0"
                  title="Закрыть панель чата"
                >
                  <svg
                    className="w-5 h-5 text-text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
                <h2 className="text-sm font-semibold text-text-primary">
                  Чат
                </h2>
              </div>
              <div className="flex items-center gap-2 relative" data-chat-selector>
                {/* Custom Chat Selector */}
                <div className="flex-1 relative">
                  <button
                    onClick={() => {
                      setIsChatSelectorOpen(!isChatSelectorOpen);
                      if (!isChatSelectorOpen) {
                        setChatToDelete(null); // Cancel deletion confirmation when opening dropdown
                      }
                    }}
                    className="w-full px-2 py-1.5 text-sm border-2 border-[var(--border-input)] rounded bg-[var(--input-background)] text-text-primary hover:bg-text-primary/5 transition-colors flex items-center justify-between"
                  >
                    <span className="truncate">
                      {selectedChatId ? chats.find(c => c.id === selectedChatId)?.title || "Выберите чат" : "Выберите чат"}
                    </span>
                    <svg
                      className={`w-4 h-4 transition-transform ${isChatSelectorOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {/* Dropdown Menu */}
                  {isChatSelectorOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface)] rounded-lg border-2 border-[var(--border)] shadow-xl z-[100] max-h-64 overflow-y-auto">
                      {chats.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-[var(--text-tertiary)]">
                          Нет чатов
                        </div>
                      ) : (
                        chats.map((chat) => (
                          <div
                            key={chat.id}
                            className={`px-3 py-2 text-sm transition-colors flex items-center justify-between group ${
                              chatToDelete === chat.id
                                ? 'bg-[var(--error-background)] border-2 border-[var(--error-border)] rounded'
                                : selectedChatId === chat.id
                                ? 'bg-text-primary/10 font-semibold hover:bg-text-primary/5'
                                : 'hover:bg-text-primary/5'
                            }`}
                          >
                            {chatToDelete === chat.id ? (
                              <>
                                <span className="flex-1 text-left font-semibold text-[var(--error-text)]">
                                  Вы уверены?
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={handleCancelDelete}
                                    className="px-2 py-0.5 text-xs border border-[var(--error-border)] rounded bg-[var(--surface)] text-[var(--error-text)] hover:bg-[var(--error-background)] transition-colors"
                                  >
                                    Отмена
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      handleDeleteChat(chat.id, e);
                                    }}
                                    className="p-1 bg-[var(--error-background)] rounded transition-all hover:bg-[var(--error-border)]"
                                    title="Нажмите еще раз для подтверждения"
                                  >
                                    <svg
                                      className="w-4 h-4 text-[var(--error-text)]"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedChatId(chat.id);
                                    setIsChatSelectorOpen(false);
                                    setChatToDelete(null); // Cancel deletion confirmation when selecting another chat
                                  }}
                                  className="flex-1 text-left truncate"
                                >
                                  {chat.title}
                                </button>
                                <button
                                  onClick={(e) => {
                                    handleDeleteChat(chat.id, e);
                                  }}
                                  className="ml-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-[var(--error-background)] rounded transition-opacity"
                                  title="Удалить чат"
                                >
                                  <svg
                                    className="w-4 h-4 text-[var(--error-text)]"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={handleCreateChat}
                disabled={isGeneratingDraft}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-3 bg-accent text-accent-foreground rounded hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title={isGeneratingDraft ? "Невозможно создать чат во время генерации драфта" : "Создать чат"}
              >
                <span className="text-lg font-semibold">+</span>
                <span className="text-sm font-medium">Создать чат</span>
              </button>
            </div>

          {/* Chat Messages Area */}
          {selectedChatId ? (
            <>
              <div 
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-3 space-y-3 bg-[var(--surface)]/50 backdrop-blur-sm"
                onScroll={(e) => {
                  const target = e.target as HTMLDivElement;
                  // Track if user is near bottom for auto-scroll behavior
                  checkIfNearBottom();
                  // Load more when scrolled to top
                  if (target.scrollTop === 0 && hasMoreMessages && !isLoadingMessages) {
                    loadMoreMessages();
                  }
                }}
              >
                {isLoadingMessages && messagesOffset > 0 && (
                  <div className="flex justify-center py-2">
                    <div className="text-xs text-[var(--text-tertiary)]">
                      Загрузка старых сообщений...
                    </div>
                  </div>
                )}
                <div ref={messagesTopRef} />
                {displayMessages.length === 0 ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="text-center text-[var(--text-tertiary)] text-sm">
                      <p>Начните разговор</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {displayMessages.map((message) => {
                      // Check if this is the streaming message
                      const isThisTheStreamingMessage = message.id.startsWith("temp-assistant") && isCurrentlyStreaming && message.role === "assistant";
                      
                      // For streaming message with segments, render segments separately
                      if (isThisTheStreamingMessage) {
                        const hasContent = streamingSegments.length > 0 || streamingContent || activeToolCall;
                        return (
                          <div key={message.id}>
                            {/* Show loading indicator when waiting for first content */}
                            {!hasContent && (
                              <div className="flex justify-start mb-3">
                                <div className="max-w-[85%] px-3 py-2 rounded-lg text-sm bg-[var(--surface)] border border-[var(--border)] shadow-sm text-text-primary">
                                  <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-[var(--text-tertiary)] border-t-transparent rounded-full animate-spin" />
                                    <span className="text-[var(--text-tertiary)]">Думаю...</span>
                                  </div>
                                </div>
                              </div>
                            )}
                            {/* Render completed segments in order */}
                            {streamingSegments.map((segment, index) => {
                              if (segment.type === 'text') {
                                const { cleanContent, reasoningBlocks, streamingReasoning } = parseReasoningBlocks(segment.content, false);
                                return (
                                  <div key={`segment-${index}`}>
                                    {/* Reasoning blocks for this segment */}
                                    {reasoningBlocks.length > 0 && (
                                      <div className="flex justify-start mb-2">
                                        <div className="max-w-[85%] space-y-2">
                                          {reasoningBlocks.map((block, blockIndex) => {
                                            const blockKey = `${message.id}-segment-${index}-${blockIndex}`;
                                            const isExpanded = expandedReasoningBlocks.has(blockKey);
                                            return (
                                              <div
                                                key={blockIndex}
                                                className="px-3 py-2 rounded-lg text-xs bg-[var(--warning-background)] border border-[var(--warning-border)] text-[var(--warning-text)]"
                                              >
                                                <button
                                                  onClick={() => {
                                                    setExpandedReasoningBlocks((prev) => {
                                                      const newSet = new Set(prev);
                                                      if (isExpanded) {
                                                        newSet.delete(blockKey);
                                                      } else {
                                                        newSet.add(blockKey);
                                                      }
                                                      return newSet;
                                                    });
                                                  }}
                                                  className="flex items-center gap-2 w-full text-left hover:opacity-80 transition-opacity"
                                                >
                                                  <span className="text-[var(--warning-text)] font-semibold">💭</span>
                                                  <span className="text-[var(--warning-text)] font-semibold">Размышление</span>
                                                  <svg
                                                    className={`w-3 h-3 text-[var(--warning-text)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                  >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                  </svg>
                                                </button>
                                                {isExpanded && (
                                                  <div className={`mt-2 ${REASONING_MARKDOWN_CLASSES}`}>
                                                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{block}</ReactMarkdown>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                    {/* Text content for this segment */}
                                    {cleanContent && (
                                      <div className="flex justify-start mb-3">
                                        <div className="max-w-[85%] px-3 py-2 rounded-lg text-sm bg-[var(--surface)] border border-[var(--border)] shadow-sm text-black dark:text-white">
                                          <div className={ASSISTANT_MARKDOWN_CLASSES}>
                                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{cleanContent}</ReactMarkdown>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              } else {
                                // Tool call segment
                                return (
                                  <div key={`segment-${index}`} className="flex justify-start mb-3">
                                    <div className="max-w-[85%] px-3 py-2 rounded-lg text-sm bg-[var(--success-background)] text-[var(--success-text)] border border-[var(--success-border)]">
                                      <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>{segment.content}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                            })}
                            
                            {/* Active tool call indicator */}
                            {activeToolCall && (
                              <div className="flex justify-start mb-3">
                                <div className="max-w-[85%] px-3 py-2 rounded-lg text-sm bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Обновляю бизнес-план...</span>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Current streaming content (after last tool call or from start) */}
                            {streamingContent && (() => {
                              const { cleanContent, reasoningBlocks, streamingReasoning } = parseReasoningBlocks(streamingContent, true);
                              return (
                                <>
                                  {/* Streaming reasoning */}
                                  {streamingReasoning !== null && (
                                    <div className="flex justify-start mb-2">
                                      <div className="max-w-[85%]">
                                        <div className="px-3 py-2 rounded-lg text-xs bg-[var(--warning-background)] border border-[var(--warning-border)] text-[var(--warning-text)]">
                                          <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[var(--warning-text)] font-semibold">💭</span>
                                            <span className="text-[var(--warning-text)] font-semibold">Размышляю...</span>
                                            <div className="w-3 h-3 border-2 border-[var(--warning-text)] border-t-transparent rounded-full animate-spin" />
                                          </div>
                                          {streamingReasoning && (
                                            <div className={REASONING_MARKDOWN_CLASSES}>
                                              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{streamingReasoning}</ReactMarkdown>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  {/* Completed reasoning blocks in current stream */}
                                  {reasoningBlocks.length > 0 && (
                                    <div className="flex justify-start mb-2">
                                      <div className="max-w-[85%] space-y-2">
                                        {reasoningBlocks.map((block, blockIndex) => {
                                          const blockKey = `${message.id}-current-${blockIndex}`;
                                          const isExpanded = expandedReasoningBlocks.has(blockKey);
                                          return (
                                            <div
                                              key={blockIndex}
                                              className="px-3 py-2 rounded-lg text-xs bg-[var(--warning-background)] border border-[var(--warning-border)] text-[var(--warning-text)]"
                                            >
                                              <button
                                                onClick={() => {
                                                  setExpandedReasoningBlocks((prev) => {
                                                    const newSet = new Set(prev);
                                                    if (isExpanded) {
                                                      newSet.delete(blockKey);
                                                    } else {
                                                      newSet.add(blockKey);
                                                    }
                                                    return newSet;
                                                  });
                                                }}
                                                className="flex items-center gap-2 w-full text-left hover:opacity-80 transition-opacity"
                                              >
                                                <span className="text-[var(--warning-text)] font-semibold">💭</span>
                                                <span className="text-[var(--warning-text)] font-semibold">Размышление</span>
                                                <svg
                                                  className={`w-3 h-3 text-[var(--warning-text)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                  fill="none"
                                                  stroke="currentColor"
                                                  viewBox="0 0 24 24"
                                                >
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                              </button>
                                              {isExpanded && (
                                                <div className={`mt-2 ${REASONING_MARKDOWN_CLASSES}`}>
                                                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{block}</ReactMarkdown>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                  {/* Text content */}
                                  {cleanContent && (
                                    <div className="flex justify-start mb-3">
                                      <div className="max-w-[85%] px-3 py-2 rounded-lg text-sm bg-[var(--surface)] border border-[var(--border)] shadow-sm text-black dark:text-white">
                                        <div className={ASSISTANT_MARKDOWN_CLASSES}>
                                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{cleanContent}</ReactMarkdown>
                                          <span className="inline-block w-1.5 h-3 ml-1 bg-current animate-pulse" />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        );
                      }
                      
                      // Regular message rendering (non-streaming)
                      const content = message.content || "";
                      const { cleanContent, reasoningBlocks, streamingReasoning } = parseReasoningBlocks(content, false);
                      
                      return (
                        <div key={message.id}>
                          {/* Completed reasoning blocks - collapsed by default, only for assistant messages */}
                          {message.role === "assistant" && reasoningBlocks.length > 0 && (
                            <div className="flex justify-start mb-2">
                              <div className="max-w-[85%] space-y-2">
                                {reasoningBlocks.map((block, index) => {
                                  const blockKey = `${message.id}-${index}`;
                                  const isExpanded = expandedReasoningBlocks.has(blockKey);
                                  
                                  return (
                                    <div
                                      key={index}
                                      className="px-3 py-2 rounded-lg text-xs bg-[var(--warning-background)] border border-[var(--warning-border)] text-[var(--warning-text)]"
                                    >
                                      <button
                                        onClick={() => {
                                          setExpandedReasoningBlocks((prev) => {
                                            const newSet = new Set(prev);
                                            if (isExpanded) {
                                              newSet.delete(blockKey);
                                            } else {
                                              newSet.add(blockKey);
                                            }
                                            return newSet;
                                          });
                                        }}
                                        className="flex items-center gap-2 w-full text-left hover:opacity-80 transition-opacity"
                                      >
                                        <span className="text-[var(--warning-text)] font-semibold">💭</span>
                                        <span className="text-[var(--warning-text)] font-semibold">Размышление</span>
                                        <svg
                                          className={`w-3 h-3 text-[var(--warning-text)] transition-transform ${
                                            isExpanded ? 'rotate-180' : ''
                                          }`}
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 9l-7 7-7-7"
                                          />
                                        </svg>
                                      </button>
                                      {isExpanded && (
                                        <div className={`mt-2 ${REASONING_MARKDOWN_CLASSES}`}>
                                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                            {block}
                                          </ReactMarkdown>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* Message bubble - only show if has content */}
                          {cleanContent && (
                            <div
                              className={`flex ${
                                message.role === "user"
                                  ? "justify-end"
                                  : "justify-start"
                              } mb-3`}
                            >
                              <div
                                className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                                  message.role === "user"
                                    ? "bg-accent text-accent-foreground"
                                    : "bg-[var(--surface)] border border-[var(--border)] shadow-sm text-black dark:text-white"
                                }`}
                              >
                                {message.role === "assistant" ? (
                                  <div className={ASSISTANT_MARKDOWN_CLASSES}>
                                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                      {cleanContent}
                                    </ReactMarkdown>
                                  </div>
                                ) : (
                                  <p className="whitespace-pre-wrap break-words">
                                    {cleanContent}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Tool call bubbles after message */}
                          {message.tool_calls?.map((toolCall) => (
                            <div key={toolCall.id} className="flex justify-start mb-3">
                              <div className="max-w-[85%] px-3 py-2 rounded-lg text-sm bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <div className="flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  <span>Бизнес-план обновлен</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    
                    {/* Planning indicator - shows when waiting for response with no activity for 2+ seconds */}
                    {showPlanningIndicator && (
                      <p className="text-sm text-[var(--text-tertiary)] italic ml-1">
                        <span className="planning-shine-container">
                          Планирую следующие действия...
                          <span className="planning-shine-overlay"></span>
                        </span>
                      </p>
                    )}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <div className="border-t-2 border-[var(--border-light)] p-3 bg-[var(--surface-secondary)] flex-shrink-0">
                {/* Model Selector */}
                <div className="mb-2">
                  <ModelTypeSelector
                    availableModelTypes={availableModelTypes}
                    selectedModelType={selectedModelType}
                    onSelect={setSelectedModelType}
                    dropdownDirection="up"
                  />
                </div>
                
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={textareaRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={
                      isGeneratingDraft 
                        ? "Генерация драфта в процессе. Чат недоступен..." 
                        : hasPendingChanges 
                        ? "Сначала примите или отклоните изменения..." 
                        : "Задайте вопрос..."
                    }
                    disabled={isSending || hasPendingChanges || isGeneratingDraft}
                    rows={1}
                    className="flex-1 px-3 py-2 text-sm border-2 border-[var(--border-input)] rounded bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-text-primary focus:ring-2 focus:ring-text-primary/10 transition-colors disabled:opacity-50 resize-none overflow-y-auto"
                    style={{ minHeight: '32px', maxHeight: '200px' }}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isSending || !inputMessage.trim() || hasPendingChanges || isGeneratingDraft}
                    className="w-8 h-8 flex items-center justify-center bg-accent text-accent-foreground rounded hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    title={
                      isGeneratingDraft 
                        ? "Чат недоступен во время генерации драфта" 
                        : hasPendingChanges 
                        ? "Сначала примите или отклоните изменения" 
                        : "Отправить"
                    }
                  >
                    {isSending ? (
                      <span className="text-xs">...</span>
                    ) : (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                      </svg>
                    )}
                  </button>
                </div>
                
                {/* AI Note */}
                <div className="mt-2 flex items-center justify-center gap-2 text-xs text-[var(--text-tertiary)]">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                  <span>Создано с помощью ИИ</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center text-[var(--text-tertiary)] text-sm">
                <p>Нажмите на + чтобы создать новый чат</p>
              </div>
            </div>
          )}
            </div>
          </div>
        )}

        {/* Panel Toggle Buttons */}
        {!isSourcesPanelOpen && (
          <button
            onClick={() => setIsSourcesPanelOpen(true)}
            className="fixed left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-[var(--surface)] border-r-2 border-y-2 border-[var(--border)] rounded-r-lg shadow-lg hover:bg-[var(--surface-secondary)] transition-colors"
            title="Открыть панель источников"
          >
            <svg
              className="w-5 h-5 text-text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}

        {!isChatPanelOpen && (
          <button
            onClick={() => setIsChatPanelOpen(true)}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-[var(--surface)] border-l-2 border-y-2 border-[var(--border)] rounded-l-lg shadow-lg hover:bg-[var(--surface-secondary)] transition-colors"
            title="Открыть панель чата"
          >
            <svg
              className="w-5 h-5 text-text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}
      </main>

      {/* Add Source Modal */}
      {isAddingSource && (
        <div className="fixed inset-0 bg-[var(--modal-backdrop)] flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--modal-background)] rounded-lg max-w-2xl w-full shadow-2xl border-2 border-[var(--modal-border)]">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-bold text-text-primary">
                    Добавить источник
                  </h2>
                  <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--warning-background)] border border-[var(--warning-border)] rounded-lg">
                    <svg
                      className="w-4 h-4 text-[var(--warning-text)]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <span className="text-xs font-medium text-[var(--warning-text)]">
                      Функция в разработке
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsAddingSource(false);
                    setDraggedFile(null);
                    setNewSourceLink("");
                  }}
                  className="text-[var(--text-tertiary)] hover:text-text-primary transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* File Drop Zone */}
              <div
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDragLeave={() => setIsDragging(false)}
                className="mb-4 p-6 border-2 border-dashed rounded-lg transition-colors border-[var(--border-input)] opacity-50 cursor-not-allowed"
              >
                <input
                  type="file"
                  id="file-input"
                  accept=".pdf,image/*"
                  onChange={handleFileInput}
                  className="hidden"
                  disabled
                />
                {draggedFile ? (
                  <div className="text-center">
                    <p className="text-sm text-text-primary mb-2">
                      {draggedFile?.name}
                    </p>
                    <button
                      onClick={() => setDraggedFile(null)}
                      disabled
                      className="text-sm text-[var(--error-text)] opacity-50 cursor-not-allowed"
                    >
                      Удалить файл
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm text-text-secondary mb-2">
                      Перетащите файл сюда или
                    </p>
                    <label
                      htmlFor="file-input"
                      className="inline-block px-4 py-2 text-sm bg-accent text-accent-foreground rounded transition-all cursor-not-allowed opacity-50"
                    >
                      Выбрать файл
                    </label>
                    <p className="text-xs text-[var(--text-tertiary)] mt-2">
                      PDF или изображения
                    </p>
                  </div>
                )}
              </div>

              {/* Link Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Ссылка (URL)
                </label>
                <input
                  type="url"
                  value={newSourceLink}
                  onChange={(e) => setNewSourceLink(e.target.value)}
                  placeholder="https://example.com"
                  disabled
                  className="w-full px-3 py-2 text-sm border-2 border-[var(--border-input)] rounded bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] opacity-50 cursor-not-allowed"
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setIsAddingSource(false);
                    setDraggedFile(null);
                    setNewSourceLink("");
                  }}
                  className="px-4 py-2 text-sm border-2 border-[var(--border-input)] rounded text-text-primary hover:bg-text-primary/5 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={() => {
                    if (draggedFile || newSourceLink.trim()) {
                      const name = getSourceName(draggedFile || undefined, newSourceLink || undefined);
                      const type = getSourceType(draggedFile || undefined, newSourceLink || undefined);
                      
                      setSources([...sources, {
                        id: `source-${Date.now()}`,
                        name,
                        type,
                        url: newSourceLink.trim() || undefined,
                        file: draggedFile || undefined
                      }]);
                      setDraggedFile(null);
                      setNewSourceLink("");
                      setIsAddingSource(false);
                    }
                  }}
                  disabled={true}
                  className="px-4 py-2 text-sm bg-accent text-accent-foreground rounded transition-all opacity-50 cursor-not-allowed"
                >
                  Добавить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Draft Form Modal */}
      {isDraftFormOpen && (
        <div 
          className="fixed inset-0 bg-[var(--modal-backdrop)] flex items-center justify-center p-4 z-50"
          data-draft-backdrop
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsDraftFormOpen(false);
            }
          }}
        >
          <div 
            className="bg-[var(--modal-background)] rounded-lg max-w-4xl w-full shadow-2xl border-2 border-[var(--modal-border)] max-h-[90vh] overflow-y-auto"
            data-draft-form
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-bold text-text-primary">
                    Создать драфт бизнес-плана
                  </h2>
                </div>
                <button
                  onClick={() => setIsDraftFormOpen(false)}
                  className="text-[var(--text-tertiary)] hover:text-text-primary transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="mb-6">
                <ModelTypeSelector
                  availableModelTypes={availableModelTypes}
                  selectedModelType={selectedDraftModelType}
                  onSelect={setSelectedDraftModelType}
                />
              </div>

              <div className="space-y-6">
                {/* Basic Information Section */}
                <div className="border-b border-[var(--border)] pb-4">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">Основная информация</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Название проекта *
                      </label>
                      <input
                        type="text"
                        value={draftFormData.businessPlanTitle}
                        onChange={(e) => setDraftFormData({ ...draftFormData, businessPlanTitle: e.target.value })}
                        placeholder="Введите название бизнес-плана"
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Приоритетные виды деятельности (ПВД) *
                      </label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={currentPriorityActivity}
                          onChange={(e) => setCurrentPriorityActivity(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && currentPriorityActivity.trim()) {
                              e.preventDefault();
                              setDraftFormData({
                                ...draftFormData,
                                priorityActivities: [...draftFormData.priorityActivities, currentPriorityActivity.trim()],
                              });
                              setCurrentPriorityActivity('');
                            }
                          }}
                          placeholder="Введите вид деятельности и нажмите Enter"
                          className="flex-1 px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
                        />
                        <button
                          onClick={() => {
                            if (currentPriorityActivity.trim()) {
                              setDraftFormData({
                                ...draftFormData,
                                priorityActivities: [...draftFormData.priorityActivities, currentPriorityActivity.trim()],
                              });
                              setCurrentPriorityActivity('');
                            }
                          }}
                          className="px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
                          disabled={!currentPriorityActivity.trim()}
                        >
                          Добавить
                        </button>
                      </div>
                      {draftFormData.priorityActivities.length > 0 && (
                        <div className="space-y-1">
                          {draftFormData.priorityActivities.map((activity: string, index: number) => (
                            <div
                              key={index}
                              className="flex items-center justify-between px-3 py-2 bg-[var(--surface-secondary)] rounded-lg border border-[var(--border)]"
                            >
                              <span className="text-sm text-text-primary">{activity}</span>
                              <button
                                onClick={() => {
                                  setDraftFormData({
                                    ...draftFormData,
                                    priorityActivities: draftFormData.priorityActivities.filter((_: string, i: number) => i !== index),
                                  });
                                }}
                                className="text-[var(--error-text)] hover:opacity-80 transition-opacity"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-2">
                          Срок участия в технопарке (лет) *
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={draftFormData.participationPeriodYears}
                          onChange={(e) => setDraftFormData({ ...draftFormData, participationPeriodYears: parseInt(e.target.value) || 3 })}
                          className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
                          disabled
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-2">
                          Год планируемой подачи *
                        </label>
                        <input
                          type="number"
                          min={new Date().getFullYear()}
                          max={new Date().getFullYear() + 5}
                          value={draftFormData.plannedSubmissionYear}
                          onChange={(e) => setDraftFormData({ ...draftFormData, plannedSubmissionYear: parseInt(e.target.value) || new Date().getFullYear() })}
                          className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
                          disabled
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 1: Project Name */}
                <div className="border-b border-[var(--border)] pb-4">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">1. Наименование проекта</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Ссылка на сайт/приложение (если есть)
                      </label>
                      <input
                        type="url"
                        value={draftFormData.websiteUrl}
                        onChange={(e) => setDraftFormData({ ...draftFormData, websiteUrl: e.target.value })}
                        placeholder="https://example.com"
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Описание проблемы
                      </label>
                      <textarea
                        value={draftFormData.problemDescription}
                        onChange={(e) => setDraftFormData({ ...draftFormData, problemDescription: e.target.value })}
                        placeholder="Опишите проблему, которую решает ваш проект"
                        rows={3}
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Описание решения
                      </label>
                      <textarea
                        value={draftFormData.solutionDescription}
                        onChange={(e) => setDraftFormData({ ...draftFormData, solutionDescription: e.target.value })}
                        placeholder="Опишите ваше решение проблемы"
                        rows={3}
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Цель проекта
                      </label>
                      <textarea
                        value={draftFormData.projectGoals}
                        onChange={(e) => setDraftFormData({ ...draftFormData, projectGoals: e.target.value })}
                        placeholder="Опишите цели и эффекты, которых планируется достичь"
                        rows={3}
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Основные задачи проекта
                      </label>
                      <textarea
                        value={draftFormData.projectTasks}
                        onChange={(e) => setDraftFormData({ ...draftFormData, projectTasks: e.target.value })}
                        placeholder="Перечислите и опишите основные задачи проекта"
                        rows={3}
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Project Location */}
                <div className="border-b border-[var(--border)] pb-4">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">2. Место реализации проекта</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Регион реализации проекта
                      </label>
                      <input
                        type="text"
                        value={draftFormData.region}
                        onChange={(e) => setDraftFormData({ ...draftFormData, region: e.target.value })}
                        placeholder="Например: Казахстан, г. Алматы"
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Общее описание целевого рынка
                      </label>
                      <textarea
                        value={draftFormData.targetMarketDescription}
                        onChange={(e) => setDraftFormData({ ...draftFormData, targetMarketDescription: e.target.value })}
                        placeholder="Опишите целевой рынок"
                        rows={3}
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Оценка объема рынка
                      </label>
                      <textarea
                        value={draftFormData.marketVolume}
                        onChange={(e) => setDraftFormData({ ...draftFormData, marketVolume: e.target.value })}
                        placeholder="Оцените объем целевого рынка"
                        rows={2}
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Тенденции развития рынка
                      </label>
                      <textarea
                        value={draftFormData.marketTrends}
                        onChange={(e) => setDraftFormData({ ...draftFormData, marketTrends: e.target.value })}
                        placeholder="Опишите тенденции развития рынка"
                        rows={2}
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Информация о конкурентах
                      </label>
                      <textarea
                        value={draftFormData.competitorsInfo}
                        onChange={(e) => setDraftFormData({ ...draftFormData, competitorsInfo: e.target.value })}
                        placeholder="Опишите основных конкурентов и отличия вашего проекта"
                        rows={3}
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Текущая и прогнозная доля рынка
                      </label>
                      <textarea
                        value={draftFormData.marketShare}
                        onChange={(e) => setDraftFormData({ ...draftFormData, marketShare: e.target.value })}
                        placeholder="Опишите текущую и планируемую долю рынка"
                        rows={2}
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Intellectual Property */}
                <div className="border-b border-[var(--border)] pb-4">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">3. Права на интеллектуальную собственность</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Описание прав на ИС
                      </label>
                      <textarea
                        value={draftFormData.ipDescription}
                        onChange={(e) => setDraftFormData({ ...draftFormData, ipDescription: e.target.value })}
                        placeholder="Опишите патенты, лицензии, авторские права"
                        rows={3}
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Документы (тип, номер, правообладатель)
                      </label>
                      {!showIPDocumentInputs && draftFormData.ipDocuments.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => setShowIPDocumentInputs(true)}
                          className="px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:opacity-90 transition-colors"
                        >
                          + Добавить документ
                        </button>
                      ) : (
                        <>
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            <input
                              type="text"
                              value={currentIPDocument.type}
                              onChange={(e) => setCurrentIPDocument({ ...currentIPDocument, type: e.target.value })}
                              placeholder="Тип (патент/лицензия)"
                              className="px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
                            />
                            <input
                              type="text"
                              value={currentIPDocument.number}
                              onChange={(e) => setCurrentIPDocument({ ...currentIPDocument, number: e.target.value })}
                              placeholder="Номер документа"
                              className="px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
                            />
                            <input
                              type="text"
                              value={currentIPDocument.owner}
                              onChange={(e) => setCurrentIPDocument({ ...currentIPDocument, owner: e.target.value })}
                              placeholder="Правообладатель"
                              className="px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
                            />
                          </div>
                          <button
                            onClick={() => {
                              if (currentIPDocument.type || currentIPDocument.number || currentIPDocument.owner) {
                                setDraftFormData({
                                  ...draftFormData,
                                  ipDocuments: [...draftFormData.ipDocuments, currentIPDocument],
                                });
                                setCurrentIPDocument({ type: '', number: '', owner: '' });
                                setShowIPDocumentInputs(false);
                              }
                            }}
                            className="px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:opacity-90 transition-colors"
                          >
                            Добавить документ
                          </button>
                          {draftFormData.ipDocuments.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {draftFormData.ipDocuments.map((doc: { type: string; number: string; owner: string }, index: number) => (
                                <div key={index} className="flex items-center justify-between px-3 py-2 bg-[var(--surface-secondary)] rounded-lg border border-[var(--border)]">
                                  <span className="text-sm text-text-primary">
                                    {doc.type} {doc.number && `- ${doc.number}`} {doc.owner && `(${doc.owner})`}
                                  </span>
                                  <button
                                    onClick={() => {
                                      setDraftFormData({
                                        ...draftFormData,
                                        ipDocuments: draftFormData.ipDocuments.filter((_: any, i: number) => i !== index),
                                      });
                                    }}
                                    className="text-[var(--error-text)] hover:opacity-80 transition-opacity"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 4: Team */}
                <div className="border-b border-[var(--border)] pb-4">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">4. Сведения о команде</h3>
                  
                  <div className="space-y-4">
                    {!showTeamMemberInputs && draftFormData.teamMembers.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => setShowTeamMemberInputs(true)}
                        className="px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:opacity-90 transition-colors"
                      >
                        + Добавить члена команды
                      </button>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-text-primary mb-2">ФИО</label>
                            <input
                              type="text"
                              value={currentTeamMember.name}
                              onChange={(e) => setCurrentTeamMember({ ...currentTeamMember, name: e.target.value })}
                              placeholder="Иванов Иван Иванович"
                              className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-text-primary mb-2">Должность/Роль</label>
                            <input
                              type="text"
                              value={currentTeamMember.position}
                              onChange={(e) => setCurrentTeamMember({ ...currentTeamMember, position: e.target.value })}
                              placeholder="CEO, CTO, разработчик"
                              className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-text-primary mb-2">Образование и сертификаты</label>
                          <textarea
                            value={currentTeamMember.education}
                            onChange={(e) => setCurrentTeamMember({ ...currentTeamMember, education: e.target.value })}
                            placeholder="Образование, курсы, сертификаты"
                            rows={2}
                            className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-text-primary mb-2">Опыт работы</label>
                          <textarea
                            value={currentTeamMember.experience}
                            onChange={(e) => setCurrentTeamMember({ ...currentTeamMember, experience: e.target.value })}
                            placeholder="Предыдущие места работы, проекты, конференции"
                            rows={2}
                            className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-text-primary mb-2">Навыки и компетенции</label>
                          <textarea
                            value={currentTeamMember.skills}
                            onChange={(e) => setCurrentTeamMember({ ...currentTeamMember, skills: e.target.value })}
                            placeholder="Ключевые навыки, инструменты, технологии"
                            rows={2}
                            className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-text-primary mb-2">Функции и зона ответственности</label>
                          <textarea
                            value={currentTeamMember.responsibilities}
                            onChange={(e) => setCurrentTeamMember({ ...currentTeamMember, responsibilities: e.target.value })}
                            placeholder="Выполняемые функции в компании"
                            rows={2}
                            className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                          />
                        </div>
                        <button
                          onClick={() => {
                            if (currentTeamMember.name) {
                              setDraftFormData({
                                ...draftFormData,
                                teamMembers: [...draftFormData.teamMembers, currentTeamMember],
                              });
                              setCurrentTeamMember({ name: '', position: '', education: '', experience: '', skills: '', responsibilities: '' });
                              setShowTeamMemberInputs(false);
                            }
                          }}
                          className="px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
                          disabled={!currentTeamMember.name}
                        >
                          Добавить члена команды
                        </button>
                      </>
                    )}
                    {draftFormData.teamMembers.length > 0 && (
                      <div className="space-y-2">
                        {draftFormData.teamMembers.map((member: { name: string; position: string; education: string; experience: string; skills: string; responsibilities: string }, index: number) => (
                          <div key={index} className="p-3 bg-[var(--surface-secondary)] rounded-lg border border-[var(--border)]">
                            <div className="font-medium text-text-primary">{member.name}</div>
                            {member.position && <div className="text-sm text-text-secondary">{member.position}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 5: Project Readiness */}
                <div className="border-b border-[var(--border)] pb-4">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">5. Стадия готовности проекта</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Стадия разработки продукта
                      </label>
                      <input
                        type="text"
                        value={draftFormData.projectStage}
                        onChange={(e) => setDraftFormData({ ...draftFormData, projectStage: e.target.value })}
                        placeholder="Например: MVP, прототип, beta-версия"
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Существующие результаты
                      </label>
                      <textarea
                        value={draftFormData.existingResults}
                        onChange={(e) => setDraftFormData({ ...draftFormData, existingResults: e.target.value })}
                        placeholder="Опишите существующие результаты по проекту"
                        rows={3}
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Основные этапы выполненных работ
                      </label>
                      <textarea
                        value={draftFormData.completedWorkStages}
                        onChange={(e) => setDraftFormData({ ...draftFormData, completedWorkStages: e.target.value })}
                        placeholder="Опишите этапы уже произведенных работ"
                        rows={3}
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Степень готовности к выходу на рынок
                      </label>
                      <input
                        type="text"
                        value={draftFormData.readinessDegree}
                        onChange={(e) => setDraftFormData({ ...draftFormData, readinessDegree: e.target.value })}
                        placeholder="Например: рыночная, операционная"
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 8: Budget */}
                <div className="border-b border-[var(--border)] pb-4">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">8. Смета планируемых расходов</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Зарплатный фонд (₸)
                      </label>
                      <input
                        type="text"
                        value={draftFormData.estimatedSalaries}
                        onChange={(e) => setDraftFormData({ ...draftFormData, estimatedSalaries: e.target.value })}
                        placeholder="Примерная сумма на весь срок участия"
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Аренда серверных мощностей (₸)
                      </label>
                      <input
                        type="text"
                        value={draftFormData.estimatedServers}
                        onChange={(e) => setDraftFormData({ ...draftFormData, estimatedServers: e.target.value })}
                        placeholder="Примерная сумма на весь срок участия"
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Маркетинговые расходы (₸)
                      </label>
                      <input
                        type="text"
                        value={draftFormData.estimatedMarketing}
                        onChange={(e) => setDraftFormData({ ...draftFormData, estimatedMarketing: e.target.value })}
                        placeholder="Примерная сумма на весь срок участия"
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Операционные расходы (₸)
                      </label>
                      <input
                        type="text"
                        value={draftFormData.estimatedOperations}
                        onChange={(e) => setDraftFormData({ ...draftFormData, estimatedOperations: e.target.value })}
                        placeholder="Примерная сумма на весь срок участия"
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 9: Products/Services */}
                <div className="border-b border-[var(--border)] pb-4">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">9. Виды товаров/услуг</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Конкретные виды товаров/услуг
                      </label>
                      <textarea
                        value={draftFormData.productServiceTypes}
                        onChange={(e) => setDraftFormData({ ...draftFormData, productServiceTypes: e.target.value })}
                        placeholder="Опишите товары, работы и услуги"
                        rows={3}
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Модель продаж
                      </label>
                      <select
                        value={draftFormData.salesModel}
                        onChange={(e) => setDraftFormData({ ...draftFormData, salesModel: e.target.value as 'B2C' | 'B2B' | 'B2G' })}
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
                      >
                        <option value="B2C">B2C (Business to Consumer)</option>
                        <option value="B2B">B2B (Business to Business)</option>
                        <option value="B2G">B2G (Business to Government)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Модель получения дохода
                      </label>
                      <textarea
                        value={draftFormData.revenueModel}
                        onChange={(e) => setDraftFormData({ ...draftFormData, revenueModel: e.target.value })}
                        placeholder="Опишите модель получения дохода"
                        rows={3}
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Стратегия развития продаж
                      </label>
                      <textarea
                        value={draftFormData.salesStrategy}
                        onChange={(e) => setDraftFormData({ ...draftFormData, salesStrategy: e.target.value })}
                        placeholder="Опишите стратегию развития продаж и продвижения"
                        rows={3}
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Каналы продаж
                      </label>
                      <textarea
                        value={draftFormData.salesChannels}
                        onChange={(e) => setDraftFormData({ ...draftFormData, salesChannels: e.target.value })}
                        placeholder="Опишите основные и дополнительные каналы продаж"
                        rows={2}
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 10: Clients */}
                <div className="border-b border-[var(--border)] pb-4">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">10. Клиенты/потенциальные клиенты</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Целевая аудитория
                      </label>
                      <textarea
                        value={draftFormData.targetAudience}
                        onChange={(e) => setDraftFormData({ ...draftFormData, targetAudience: e.target.value })}
                        placeholder="Опишите целевую аудиторию и сегменты потребления"
                        rows={3}
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Текущие клиенты
                      </label>
                      <textarea
                        value={draftFormData.currentClients}
                        onChange={(e) => setDraftFormData({ ...draftFormData, currentClients: e.target.value })}
                        placeholder="Опишите текущих клиентов (если есть)"
                        rows={2}
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Категории клиентов
                      </label>
                      <textarea
                        value={draftFormData.clientCategories}
                        onChange={(e) => setDraftFormData({ ...draftFormData, clientCategories: e.target.value })}
                        placeholder="Например: малый и средний бизнес, крупные предприятия"
                        rows={2}
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Портрет клиента/целевой аудитории
                      </label>
                      <textarea
                        value={draftFormData.customerProfile}
                        onChange={(e) => setDraftFormData({ ...draftFormData, customerProfile: e.target.value })}
                        placeholder="Опишите портрет клиента (customer profile)"
                        rows={3}
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 12: Social Significance */}
                <div className="pb-4">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">12. Общественная значимость проекта</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Значимость для региона
                      </label>
                      <textarea
                        value={draftFormData.regionalSignificance}
                        onChange={(e) => setDraftFormData({ ...draftFormData, regionalSignificance: e.target.value })}
                        placeholder="Опишите значимость проекта для региона"
                        rows={2}
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Экономическая значимость
                      </label>
                      <textarea
                        value={draftFormData.economicSignificance}
                        onChange={(e) => setDraftFormData({ ...draftFormData, economicSignificance: e.target.value })}
                        placeholder="Опишите экономическую значимость проекта"
                        rows={2}
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Социальная значимость
                      </label>
                      <textarea
                        value={draftFormData.socialSignificance}
                        onChange={(e) => setDraftFormData({ ...draftFormData, socialSignificance: e.target.value })}
                        placeholder="Опишите социальную значимость (новые специалисты, IT-грамотность и т.д.)"
                        rows={3}
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Планируемое количество рабочих мест
                      </label>
                      <input
                        type="text"
                        value={draftFormData.plannedJobs}
                        onChange={(e) => setDraftFormData({ ...draftFormData, plannedJobs: e.target.value })}
                        placeholder="Количество рабочих мест по годам"
                        className="w-full px-4 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--input-background)] text-text-primary placeholder-[var(--input-placeholder)] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={() => setIsDraftFormOpen(false)}
                  className="px-4 py-2 text-sm border-2 border-[var(--border-input)] rounded text-text-primary hover:bg-text-primary/5 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleGenerateDraft}
                  disabled={isGeneratingDraft || !selectedDraftModelType}
                  className="px-4 py-2 text-sm bg-accent text-accent-foreground rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                >
                  {isGeneratingDraft ? 'Генерация...' : 'Создать'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Overlay */}
      {onboardingStep !== 'none' && onboardingStep !== 'complete' && (
        <OnboardingOverlay
          step={onboardingStep}
          draftButtonRef={draftButtonRef}
          chatPanelRef={chatPanelRef}
          onNext={handleOnboardingNext}
        />
      )}
    </div>
  );
}

// Onboarding Overlay Component
function OnboardingOverlay({
  step,
  draftButtonRef,
  chatPanelRef,
  onNext,
}: {
  step: 'draft-button' | 'chat-panel';
  draftButtonRef: React.RefObject<HTMLButtonElement | null>;
  chatPanelRef: React.RefObject<HTMLDivElement | null>;
  onNext: () => void;
}) {
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);

  // Ensure highlighted elements appear above the dimming overlay
  useEffect(() => {
    const elements: Array<{ el: HTMLElement; originalZIndex: string }> = [];
    
    if (step === 'draft-button' && draftButtonRef.current) {
      const el = draftButtonRef.current;
      elements.push({
        el,
        originalZIndex: el.style.zIndex || '',
      });
      el.style.zIndex = '10000';
    } else if (step === 'chat-panel' && chatPanelRef.current) {
      const el = chatPanelRef.current;
      elements.push({
        el,
        originalZIndex: el.style.zIndex || '',
      });
      el.style.zIndex = '10000';
    }

    return () => {
      elements.forEach(({ el, originalZIndex }) => {
        if (originalZIndex) {
          el.style.zIndex = originalZIndex;
        } else {
          el.style.removeProperty('z-index');
        }
      });
    };
  }, [step, draftButtonRef, chatPanelRef]);

  useEffect(() => {
    const updatePositions = () => {
      let element: HTMLElement | null = null;
      
      if (step === 'draft-button' && draftButtonRef.current) {
        element = draftButtonRef.current;
      } else if (step === 'chat-panel' && chatPanelRef.current) {
        element = chatPanelRef.current;
      }

      if (element) {
        const rect = element.getBoundingClientRect();
        setHighlightRect(rect);
        
        const tooltipWidth = 400; // max-w-[400px]
        const padding = 20;
        
        if (step === 'chat-panel') {
          // Position tooltip to the left of the chat panel, vertically centered
          // Make sure it doesn't go off the left edge
          const leftPosition = Math.max(padding, rect.left - tooltipWidth - padding);
          setTooltipPosition({
            top: rect.top + rect.height / 2,
            left: leftPosition,
          });
        } else {
          // Position tooltip below the element, centered, but keep it on screen
          const tooltipLeft = rect.left + rect.width / 2;
          
          // Clamp to viewport
          const clampedLeft = Math.max(
            padding,
            Math.min(tooltipLeft, window.innerWidth - tooltipWidth / 2 - padding)
          );
          
          setTooltipPosition({
            top: rect.bottom + 20,
            left: clampedLeft,
          });
        }
      }
    };

    updatePositions();
    window.addEventListener('resize', updatePositions);
    window.addEventListener('scroll', updatePositions, true);

    return () => {
      window.removeEventListener('resize', updatePositions);
      window.removeEventListener('scroll', updatePositions, true);
    };
  }, [step, draftButtonRef, chatPanelRef]);

  if (!highlightRect || !tooltipPosition) return null;

  const message = step === 'draft-button' 
    ? 'Здесь вы можете создать бизнес план'
    : 'Здесь вы можете попросить ИИ сделать правки или задать вопросы';

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-auto">
      {/* Dimmed backdrop - four sections around the highlighted element */}
      {/* Top */}
      <div
        className="absolute bg-black/75 pointer-events-auto"
        style={{
          top: 0,
          left: 0,
          right: 0,
          height: highlightRect.top - 8,
        }}
      />
      {/* Bottom */}
      <div
        className="absolute bg-black/75 pointer-events-auto"
        style={{
          top: highlightRect.bottom + 8,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />
      {/* Left */}
      <div
        className="absolute bg-black/75 pointer-events-auto"
        style={{
          top: highlightRect.top - 8,
          left: 0,
          width: highlightRect.left - 8,
          height: highlightRect.height + 16,
        }}
      />
      {/* Right */}
      <div
        className="absolute bg-black/75 pointer-events-auto"
        style={{
          top: highlightRect.top - 8,
          left: highlightRect.right + 8,
          right: 0,
          height: highlightRect.height + 16,
        }}
      />

      {/* Highlight border */}
      <div
        className="absolute border-4 border-accent rounded-lg pointer-events-none z-[10000]"
        style={{
          left: highlightRect.left - 8,
          top: highlightRect.top - 8,
          width: highlightRect.width + 16,
          height: highlightRect.height + 16,
        }}
      />

      {/* Tooltip */}
      <div
        className="absolute bg-[var(--surface)] border-2 border-accent rounded-lg shadow-2xl p-4 min-w-[280px] max-w-[400px] pointer-events-auto"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          transform: step === 'chat-panel' ? 'translateY(-50%)' : 'translateX(-50%)',
        }}
      >
        <p className="text-text-primary mb-4 text-sm">{message}</p>
        <button
          onClick={onNext}
          className="w-full px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:opacity-90 transition-all font-medium"
        >
          {step === 'draft-button' ? 'Далее' : 'Ок'}
        </button>
      </div>
    </div>
  );
}
