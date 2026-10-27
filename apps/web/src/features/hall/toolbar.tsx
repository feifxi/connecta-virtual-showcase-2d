'use client';
import { MessageCircle, Mic, MicOff, MonitorUp, Smile, Video, VideoOff } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { REACTIONS } from '@connecta/shared';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useHallCtx } from './context';
import { selectMyBooth, useHall } from './store';

function Tool({ label, icon, active, off, disabled, onClick }: { label: string; icon: ReactNode; active?: boolean; off?: boolean; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'relative flex h-[54px] min-w-[58px] flex-col items-center justify-center gap-0.5 rounded-[10px] bg-toolbar-button px-1.5 text-white transition-[background,transform] hover:-translate-y-0.5 hover:bg-toolbar-hover disabled:cursor-not-allowed disabled:opacity-55 [&_svg]:size-5',
        active && 'bg-blue hover:bg-blue',
        off && 'text-[#ff9b9b]',
      )}
    >
      {icon}
      <span className="text-xs font-semibold max-sm:hidden">{label}</span>
    </button>
  );
}

/** Bottom bar · mic starts off · camera/screen only show up for the presenters of the booth you're standing in */
export function Toolbar() {
  const { media, conn, event } = useHallCtx();
  const mic = useHall((s) => s.mic);
  const camera = useHall((s) => s.camera);
  const sharing = useHall((s) => s.sharing);
  const chatOpen = useHall((s) => s.chatOpen);
  const audioOk = useHall((s) => s.audioOk);
  const hearing = useHall((s) => s.hearing.length);
  const myBooth = useHall(selectMyBooth);
  const booths = useHall((s) => s.booths);
  const set = useHall((s) => s.set);
  const [reacting, setReacting] = useState(false);
  const onStage = !!myBooth && event.myProjectIds.includes(myBooth);
  const boothLabel = myBooth ? booths[myBooth]?.title : null;

  const toggleMic = async () => {
    await media.unlockAudio();
    if (!(await media.setMic(!mic)) && !mic) toast.error('Allow microphone access in your browser to talk.');
  };
  return (
    <div className="absolute bottom-[23px] left-1/2 z-[4] flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-toolbar px-3 py-[9px] text-white shadow-[0_9px_26px_rgb(15_26_58/0.24)] max-sm:bottom-3 max-sm:gap-1.5 max-sm:px-2">
      {audioOk ? <Tool label={mic ? 'Mic on' : 'Mic off'} icon={mic ? <Mic /> : <MicOff />} active={mic} off={!mic} onClick={toggleMic} /> : <Tool label="No audio" icon={<MicOff />} disabled />}
      {onStage && (
        <Tool
          label={camera ? 'Camera on' : 'Camera off'}
          icon={camera ? <Video /> : <VideoOff />}
          active={camera}
          onClick={async () => {
            if (!(await media.setCamera(!camera)) && !camera) toast.error('Allow camera access in your browser.');
          }}
        />
      )}
      {onStage && <Tool label={sharing ? 'Stop share' : 'Share screen'} icon={<MonitorUp />} active={sharing} onClick={() => media.setScreen(!sharing)} />}
      <Tool label="Chat" icon={<MessageCircle />} active={chatOpen} onClick={() => set({ chatOpen: !chatOpen, ...(window.matchMedia('(max-width: 767px)').matches && { side: null, boothOpen: false }) })} />
      <span className="mx-1 h-[30px] w-px bg-[#374360] max-sm:hidden" />
      <div className="min-w-[180px] px-2.5 text-xs text-[#c3cce4] max-md:hidden" aria-live="polite">
        <strong className="mb-0.5 flex items-center gap-1.5 text-sm font-semibold text-white">
          <span className="size-[5px] rounded-full bg-speaking" />
          {myBooth ? `In ${boothLabel ?? 'a booth'}` : `${hearing} ${hearing === 1 ? 'person' : 'people'} near you`}
        </strong>
        {myBooth ? `${hearing + 1} hear each other here` : 'Voices fade with distance'}
      </div>
      <span className="mx-1 h-[30px] w-px bg-[#374360] max-sm:hidden" />
      <div className="relative">
        <Tool label="React" icon={<Smile />} active={reacting} onClick={() => setReacting(!reacting)} />
        {reacting && (
          <div role="menu" aria-label="Reactions" className="absolute bottom-[64px] left-1/2 flex -translate-x-1/2 gap-1 rounded-[14px] bg-white p-1.5 shadow-card">
            {REACTIONS.map((e) => (
              <button
                key={e}
                type="button"
                role="menuitem"
                aria-label={`React ${e}`}
                className="grid size-10 place-items-center rounded-[10px] text-xl hover:bg-subtle"
                onClick={() => {
                  conn.react(e);
                  setReacting(false);
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
