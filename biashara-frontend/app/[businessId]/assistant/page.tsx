"use client";

import React, { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Icons } from "@/components/ui/Icons";

interface Message {
  role: "user" | "assistant";
  text: string;
  toolsUsed?: string[];
}

export default function AssistantPage() {
  const params = useParams();
  const businessId = Number(params.businessId);
  const { t } = useI18n();

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Habari! I am your Biashara AI Assistant. I have live telemetry access to your sales, products, expenses, and debtor records. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestionChips = [
    "How much profit did I make this month?",
    "Which products are selling fastest?",
    "Who owes me money?",
    "What should I restock?",
    "How are my sales performing today?",
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (messageText?: string) => {
    const textToSend = (messageText || input).trim();
    if (!textToSend || isLoading) return;

    setInput("");
    const newMsgList: Message[] = [...messages, { role: "user", text: textToSend }];
    setMessages(newMsgList);
    setIsLoading(true);

    try {
      const res = await api.askAssistant(businessId, textToSend);
      setMessages([
        ...newMsgList,
        {
          role: "assistant",
          text: res.data.reply,
          toolsUsed: res.data.tools_used,
        },
      ]);
    } catch (err) {
      setMessages([
        ...newMsgList,
        {
          role: "assistant",
          text: "Samahani, I couldn't connect to the analytical core right now. Please verify backend connectivity and try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      await api.resetAssistant(businessId);
      setMessages([
        {
          role: "assistant",
          text: "Context buffer cleared. What would you like to investigate in your store ledger?",
        },
      ]);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8.5rem)] flex flex-col space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-[0_0_16px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400/40">
            <span className="font-mono font-bold text-xs">AI</span>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-cosmic-pulse ring-2 ring-[#03060f]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                {t("ai_assistant")}
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                Gemini 2.5 Core
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Live bi-directional store telemetry &amp; predictive analytics
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="text-xs font-mono text-slate-500 hover:text-slate-900 dark:hover:text-white"
        >
          Reset Session
        </Button>
      </div>

      {/* Chat Messages Log */}
      <Card className="flex-1 flex flex-col overflow-hidden border-slate-200/80 dark:border-white/[0.08] shadow-2xl backdrop-blur-2xl">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((m, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.25 }}
                className={`flex gap-3 ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {m.role === "assistant" && (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 text-white flex items-center justify-center font-mono font-bold text-[10px] shrink-0 mt-1 shadow-sm ring-1 ring-cyan-400/30">
                    AI
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed transition-all ${
                    m.role === "user"
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-xs shadow-md shadow-emerald-600/20 font-medium"
                      : "bg-white/80 dark:bg-[#0c1224]/80 text-slate-900 dark:text-slate-100 rounded-bl-xs border border-slate-200/80 dark:border-white/[0.08] shadow-sm backdrop-blur-md"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.text}</div>

                  {m.toolsUsed && m.toolsUsed.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-white/[0.08] flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                        Synthesized via:
                      </span>
                      {m.toolsUsed.map((tool, tIdx) => (
                        <span
                          key={tIdx}
                          className="font-mono text-[9px] px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {m.role === "user" && (
                  <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-white/[0.08] text-slate-700 dark:text-slate-300 flex items-center justify-center font-mono font-bold text-[10px] shrink-0 mt-1 border border-transparent dark:border-white/[0.08]">
                    Op
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3 justify-start"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 text-white flex items-center justify-center font-mono font-bold text-[10px] shrink-0 mt-1 shadow-sm">
                AI
              </div>
              <div className="rounded-2xl rounded-bl-xs px-4 py-3 bg-white/80 dark:bg-[#0c1224]/80 border border-slate-200/80 dark:border-white/[0.08] text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 shadow-sm font-mono">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span>Executing analytical computation...</span>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        <div className="px-4 py-2.5 bg-slate-50/70 dark:bg-[#070b18]/60 border-t border-slate-100 dark:border-white/[0.06] flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0 mr-1">
            Prompt:
          </span>
          {suggestionChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(chip)}
              disabled={isLoading}
              className="text-[11px] px-3 py-1 rounded-full border border-slate-200 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.03] text-slate-600 dark:text-slate-300 hover:border-cyan-500/50 hover:text-cyan-600 dark:hover:text-cyan-300 hover:shadow-[0_0_10px_rgba(6,182,212,0.15)] whitespace-nowrap transition-all duration-200 active:scale-95"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Console Input Dock */}
        <div className="p-3 border-t border-slate-100 dark:border-white/[0.06] bg-white/90 dark:bg-[#050814]/90 backdrop-blur-xl flex items-center gap-2">
          <input
            type="text"
            placeholder={t("ask_ai_placeholder")}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            disabled={isLoading}
            className="flex-1 h-11 px-4 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all font-sans"
          />
          <Button
            size="md"
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="px-5 h-11 font-mono text-xs gap-1.5 shadow-md shadow-emerald-600/20"
          >
            <Icons.Send size={14} />
            <span className="hidden sm:inline">{t("send")}</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}
