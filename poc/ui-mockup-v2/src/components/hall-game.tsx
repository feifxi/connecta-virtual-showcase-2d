"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as Phaser from "phaser";
import { HallEvents, HallScene, type BoothInfo, type Hearing, type HallProject } from "@/game/HallScene";

export type HallControl = { zoom: (z: number) => void; goTo: (no: string) => void; say: (text: string, kind: "reaction" | "chat") => void; showRange: (on: boolean) => void };

// Mounts the Phaser hall (client only) · the page passes callbacks and gets a small control object back
export default function HallGame({ projects, avatar, name, control, onEnter, onLeave, onHearing, onPeek }: {
  projects: HallProject[]; avatar: number; name: string; control: RefObject<HallControl | null>;
  onEnter: (b: BoothInfo) => void; onLeave: () => void; onHearing: (h: Hearing) => void; onPeek: (b: BoothInfo | null) => void;
}) {
  const parent = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onEnter, onLeave, onHearing, onPeek });
  handlers.current = { onEnter, onLeave, onHearing, onPeek };

  useEffect(() => {
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: parent.current!,
      backgroundColor: "#d6d8df",
      pixelArt: true,
      physics: { default: "arcade", arcade: { debug: false } },
      scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
      scene: [],
    });
    game.scene.add("hall", HallScene, true, { projects, avatar, name });
    const scene = () => game.scene.getScene("hall") as HallScene | undefined;
    control.current = { zoom: (z) => scene()?.setZoom(z), goTo: (no) => scene()?.goToBooth(no), say: (t, k) => scene()?.say(t, k), showRange: (on) => scene()?.showRange(on) };
    (window as unknown as { __phaserGame?: Phaser.Game }).__phaserGame = game;
    const enter = (b: BoothInfo) => handlers.current.onEnter(b);
    const leave = () => handlers.current.onLeave();
    const hearing = (h: Hearing) => handlers.current.onHearing(h);
    game.events.on(HallEvents.ENTER, enter);
    game.events.on(HallEvents.LEAVE, leave);
    game.events.on(HallEvents.HEARING, hearing);
    const peek = (b: BoothInfo | null) => handlers.current.onPeek(b);
    game.events.on(HallEvents.PEEK, peek);
    return () => {
      game.events.off(HallEvents.ENTER, enter);
      game.events.off(HallEvents.LEAVE, leave);
      game.events.off(HallEvents.HEARING, hearing);
      game.events.off(HallEvents.PEEK, peek);
      control.current = null;
      game.destroy(true);
    };
    // the hall is created once per page visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={parent} className="hall-canvas" />;
}
