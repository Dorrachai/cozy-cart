import { useMemo, useState, type FormEvent } from 'react';
import {
  Check,
  Copy,
  Home,
  KeyRound,
  Link2,
  ListChecks,
  RefreshCw,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { buildInviteUrl, normalizeFriendCode } from '../lib/crypto';
import { ModalDialog } from './ModalDialog';
import type { ShoppingList } from '../types/shopping';

interface ShareModalProps {
  open: boolean;
  initialTab?: 'household' | 'list' | 'join';
  onClose: () => void;
  householdCode: string;
  activeList: ShoppingList;
  cloudConfigured: boolean;
  onJoinCode: (code: string) => Promise<{ ok: boolean; message: string }>;
  onResetHousehold: () => void;
}

export function ShareModal({
  open,
  initialTab = 'household',
  onClose,
  householdCode,
  activeList,
  cloudConfigured,
  onJoinCode,
  onResetHousehold,
}: ShareModalProps) {
  const [tab, setTab] = useState<'household' | 'list' | 'join'>(initialTab);
  const [copiedWhat, setCopiedWhat] = useState<'code' | 'link' | null>(null);
  const [joinInput, setJoinInput] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const { activeCode, inviteUrl } = useMemo(() => {
    const candidate = tab === 'list' ? activeList.listCode : householdCode;
    const safeCode = normalizeFriendCode(candidate);
    const url = buildInviteUrl(safeCode);
    return { activeCode: safeCode, inviteUrl: url };
  }, [tab, activeList.listCode, householdCode]);

  const copyText = async (val: string, kind: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedWhat(kind);
      setTimeout(() => setCopiedWhat(null), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title:
            tab === 'household'
              ? 'Join our CozyCart Household'
              : `Join "${activeList.title}" on CozyCart`,
          text:
            tab === 'household'
              ? `Use Friend Code ${activeCode} to share our shopping lists:`
              : `Use Friend Code ${activeCode} to edit "${activeList.title}":`,
          url: inviteUrl,
        });
      } catch {
        // User cancelled share sheet
      }
    }
  };

  const handleJoinSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!joinInput.trim()) return;
    setJoinBusy(true);
    setJoinError(null);
    const res = await onJoinCode(joinInput);
    setJoinBusy(false);
    if (res.ok) {
      setJoinInput('');
      onClose();
    } else {
      setJoinError(res.message);
    }
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Friend Codes & Privacy"
      subtitle="No accounts or emails. Your Friend Code encrypts everything end-to-end in your browser."
    >
      <div className="flex flex-col gap-4">
        {/* 3-Tab Switcher */}
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-[var(--bg-subtle)] p-1">
          <button
            type="button"
            onClick={() => setTab('household')}
            className={`flex cursor-pointer items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-extrabold transition ${
              tab === 'household'
                ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Home className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Household</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('list')}
            className={`flex cursor-pointer items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-extrabold transition ${
              tab === 'list'
                ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <ListChecks className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">This List</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('join')}
            className={`flex cursor-pointer items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-extrabold transition ${
              tab === 'join'
                ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Join Code</span>
          </button>
        </div>

        {tab !== 'join' ? (
          <div className="flex flex-col items-center gap-3.5">
            <p className="w-full rounded-2xl bg-[var(--accent-soft)]/70 px-3.5 py-2.5 text-center text-xs font-semibold text-[var(--accent-ink)]">
              {tab === 'household' ? (
                <>
                  <strong>Partner Code:</strong> Anyone with this code shares{' '}
                  <strong>all</strong> your household lists together.
                </>
              ) : (
                <span className="block truncate" title={activeList.title}>
                  <strong>Guest Code:</strong> Shares <em>only</em> &quot;{activeList.title}&quot;—other lists stay private!
                </span>
              )}
            </p>

            {/* Camera-scannable SVG QR Code */}
            <div className="rounded-3xl border border-[var(--border-soft)] bg-white p-3.5 shadow-xs">
              <QRCodeSVG value={inviteUrl} size={148} level="M" />
            </div>

            {/* Friend Code Pill */}
            <div className="w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-page)] px-3.5 py-2.5 text-center">
              <span className="block text-[10px] font-extrabold tracking-wider text-[var(--text-faint)] uppercase">
                {tab === 'household' ? 'Household Friend Code' : 'Single-List Friend Code'}
              </span>
              <code className="mt-0.5 block select-all break-all font-mono text-sm font-extrabold tracking-wide text-[var(--text-main)] sm:text-base">
                {activeCode}
              </code>
            </div>

            <div className="grid w-full grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => copyText(activeCode, 'code')}
                className="flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-[var(--accent-bg)] px-3 text-xs font-extrabold text-white transition hover:bg-[var(--accent-hover)]"
              >
                {copiedWhat === 'code' ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied Code!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy Code
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => copyText(inviteUrl, 'link')}
                className="flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-xs font-extrabold text-[var(--text-main)] transition hover:bg-[var(--bg-subtle)]"
              >
                {copiedWhat === 'link' ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-500" />
                    Copied Link!
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4" />
                    Copy Invite Link
                  </>
                )}
              </button>
            </div>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-subtle)] text-xs font-bold text-[var(--text-main)] transition hover:bg-[var(--bg-hover)]"
              >
                <Share2 className="h-3.5 w-3.5" />
                Send via Phone Share Sheet
              </button>
            )}

            <div className="flex w-full items-start gap-2.5 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-subtle)]/50 p-3 text-left">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="text-[11px] leading-relaxed text-[var(--text-muted)]">
                <strong>Zero-Knowledge Privacy:</strong> Your Friend Code derives an{' '}
                <code>AES-256-GCM</code> key inside your browser and stays in the{' '}
                <code>#hash</code> part of invite links (never sent to GitHub Pages).{' '}
                {!cloudConfigured && (
                  <span>
                    Currently running in <strong>Private Browser Mode</strong> (syncs across tabs; add free Firebase keys in <code>.env</code> for phone-to-phone sync).
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleJoinSubmit} className="flex flex-col gap-3.5">
            <div>
              <label
                htmlFor="join-code-input"
                className="mb-1.5 block text-xs font-extrabold text-[var(--text-muted)]"
              >
                Enter a Household Code (<code>H-…</code>) or Single-List Code (<code>L-…</code>)
              </label>
              <input
                id="join-code-input"
                type="text"
                value={joinInput}
                onChange={(e) => {
                  setJoinInput(e.target.value);
                  setJoinError(null);
                }}
                placeholder="e.g. H-berry-mochi-7K4P9X2"
                autoComplete="off"
                spellCheck={false}
                className="h-11 w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-page)] px-3.5 font-mono text-sm font-bold text-[var(--text-main)] focus:ring-2 focus:ring-[var(--accent-bg)] focus:outline-none"
              />
              {joinError && (
                <p className="mt-2 rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {joinError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!joinInput.trim() || joinBusy}
              className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--accent-bg)] text-sm font-extrabold text-white shadow-xs transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <KeyRound className="h-4 w-4" />
              {joinBusy ? 'Decrypting & Joining…' : 'Join Shared Space'}
            </button>

            <div className="mt-2 border-t border-[var(--border-soft)] pt-3">
              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-rose-500"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Leave current household &amp; generate a fresh private code
                </button>
              ) : (
                <div className="flex flex-col gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3">
                  <p className="text-xs font-semibold">
                    Save your current Friend Code first if you ever want to rejoin! Start a fresh household on this device?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onResetHousehold();
                        setConfirmReset(false);
                        onClose();
                      }}
                      className="cursor-pointer rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Yes, Start Fresh
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="cursor-pointer rounded-xl bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        )}
      </div>
    </ModalDialog>
  );
}
