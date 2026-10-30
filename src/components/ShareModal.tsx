import { useId, useMemo, useState, type FormEvent } from 'react';
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
  const joinInputId = useId();

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
              ? 'Join our CozyCart household'
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
      title="Friend Codes & privacy"
      subtitle="No accounts or emails. Your Friend Code encrypts every list end-to-end inside your browser."
    >
      <div className="flex flex-col gap-4">
        {/* 3-Tab Switcher */}
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--bg-surface)] p-1">
          <button
            type="button"
            onClick={() => setTab('household')}
            className={`flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-medium transition-colors ${
              tab === 'household'
                ? 'bg-[var(--bg-raised)] text-[var(--text-main)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Home className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Household</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('list')}
            className={`flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-medium transition-colors ${
              tab === 'list'
                ? 'bg-[var(--bg-raised)] text-[var(--text-main)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <ListChecks className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">This list</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('join')}
            className={`flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-medium transition-colors ${
              tab === 'join'
                ? 'bg-[var(--bg-raised)] text-[var(--text-main)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Join code</span>
          </button>
        </div>

        {tab !== 'join' ? (
          <div className="flex flex-col items-center gap-3.5">
            <p className="w-full rounded-xl bg-[var(--accent-soft)] px-3.5 py-2.5 text-center text-[13px] text-[var(--accent-ink)]">
              {tab === 'household' ? (
                <>
                  <strong>Partner code:</strong> Anyone with this code shares{' '}
                  <strong>all</strong> household lists together.
                </>
              ) : (
                <span className="block truncate" title={activeList.title}>
                  <strong>Single-list code:</strong> Shares only &quot;{activeList.title}&quot;, other lists stay private.
                </span>
              )}
            </p>

            {/* Camera-scannable SVG QR Code */}
            <div className="rounded-xl border border-[var(--border-soft)] bg-white p-3.5">
              <QRCodeSVG value={inviteUrl} size={148} level="M" />
            </div>

            {/* Friend Code Readout */}
            <div className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-center">
              <span className="block text-[13px] font-medium text-[var(--text-muted)]">
                {tab === 'household' ? 'Household Friend Code' : 'Single-list Friend Code'}
              </span>
              <code className="mt-0.5 block select-all break-all font-mono text-[15px] font-semibold text-[var(--text-main)]">
                {activeCode}
              </code>
            </div>

            <div className="grid w-full grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => copyText(activeCode, 'code')}
                className="flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[var(--primary-bg)] px-3 text-[14px] font-medium text-[var(--primary-ink)] transition-colors hover:bg-[var(--primary-hover)]"
              >
                {copiedWhat === 'code' ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Copied code</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy code</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => copyText(inviteUrl, 'link')}
                className="flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-raised)] px-3 text-[14px] font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-surface)]"
              >
                {copiedWhat === 'link' ? (
                  <>
                    <Check className="h-4 w-4 text-[var(--accent-bg)]" />
                    <span>Copied link</span>
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4" />
                    <span>Copy invite link</span>
                  </>
                )}
              </button>
            </div>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-surface)] text-[14px] font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-hover)]"
              >
                <Share2 className="h-4 w-4" />
                <span>Send via device share sheet</span>
              </button>
            )}

            <div className="flex w-full items-start gap-2.5 rounded-xl bg-[var(--bg-surface)] p-3 text-left">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-bg)]" />
              <div className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                <strong className="font-medium text-[var(--text-main)]">Zero-knowledge encryption:</strong>{' '}
                Your Friend Code derives an <code>AES-256-GCM</code> key locally and stays in the{' '}
                <code>#hash</code> fragment of invite links, never sent to servers.{' '}
                {!cloudConfigured && (
                  <span>
                    Running in local browser mode (add Firebase keys in <code>.env</code> for cross-device sync).
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleJoinSubmit} className="flex flex-col gap-3.5">
            <div>
              <label
                htmlFor={joinInputId}
                className="mb-1.5 block text-[14px] font-medium text-[var(--text-main)]"
              >
                Enter a Household Code (<code>H-...</code>) or Single-list Code (<code>L-...</code>)
              </label>
              <input
                id={joinInputId}
                type="text"
                value={joinInput}
                onChange={(e) => {
                  setJoinInput(e.target.value);
                  setJoinError(null);
                }}
                placeholder="e.g. H-berry-mochi-7K4P9X2"
                autoComplete="off"
                spellCheck={false}
                className="h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-page)] px-3 text-[15px] text-[var(--text-main)] placeholder:text-[var(--text-faint)] focus:outline-2 focus:outline-[var(--accent-bg)]"
              />
              {joinError && (
                <p
                  role="alert"
                  className="mt-2 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-[13px] font-medium text-[var(--danger-ink)]"
                >
                  {joinError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!joinInput.trim() || joinBusy}
              className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--primary-bg)] text-[14px] font-medium text-[var(--primary-ink)] transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <KeyRound className="h-4 w-4" />
              <span>{joinBusy ? 'Decrypting and joining...' : 'Join shared space'}</span>
            </button>

            <div className="mt-2 border-t border-[var(--border-soft)] pt-3">
              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--danger-text)]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Leave current household and generate a fresh private code</span>
                </button>
              ) : (
                <div className="flex flex-col gap-2.5 rounded-xl bg-[var(--danger-soft)] p-3">
                  <p className="text-[13px] font-medium text-[var(--danger-ink)]">
                    Save your current Friend Code first if you want to rejoin later. Start a fresh household on this device?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onResetHousehold();
                        setConfirmReset(false);
                        onClose();
                      }}
                      className="h-9 cursor-pointer rounded-lg bg-[var(--danger-bg)] px-3.5 text-[13px] font-medium text-white"
                    >
                      Yes, start fresh
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="h-9 cursor-pointer rounded-lg bg-[var(--bg-raised)] px-3.5 text-[13px] font-medium text-[var(--text-main)]"
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
