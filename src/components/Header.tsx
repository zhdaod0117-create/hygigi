import CopyInviteButton from "@/components/CopyInviteButton";
import { signOutAction } from "@/lib/actions/workspace";
import { formatHeaderDate } from "@/lib/date";

export default function Header({ inviteCode }: { inviteCode: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-brown-400/30 bg-cream-100 px-5 py-4 shadow-sm">
      <div>
        <h1 className="text-xl font-bold text-brown-700">🐾 Retriever Nest</h1>
        <p className="text-sm text-brown-500">{formatHeaderDate()}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-full bg-butter-100 px-3 py-1.5">
          <span className="text-xs text-brown-500">초대 코드</span>
          <span className="font-mono text-sm font-bold tracking-widest text-brown-700">
            {inviteCode}
          </span>
          <CopyInviteButton code={inviteCode} />
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-full border border-brown-400/40 px-3 py-1.5 text-xs font-semibold text-brown-500 transition hover:bg-brown-500 hover:text-cream-50"
          >
            로그아웃
          </button>
        </form>
      </div>
    </header>
  );
}
