'use client';
import * as Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import type { HallConnection } from './connection';
import { HallScene } from './game/HallScene';

/** Mounts Phaser once per visit (client only) · destroyed on unmount (S1: no leak across 100 mounts) */
export default function HallGame({ conn, mapJson, title }: { conn: HallConnection; mapJson: Record<string, unknown>; title: string }) {
  const parent = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: parent.current!,
      backgroundColor: '#d6d8df',
      pixelArt: true,
      scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
      scene: [],
      banner: false,
    });
    game.scene.add('hall', HallScene, true, { conn, mapJson, title });
    return () => game.destroy(true);
    // one game per hall visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={parent} className="absolute inset-0" aria-label="The exhibition hall" role="application" />;
}
